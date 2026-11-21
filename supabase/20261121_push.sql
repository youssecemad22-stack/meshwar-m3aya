-- 2026-11-21 web push notifications.
-- Adds NEW objects only. No existing table, policy, trigger or RPC is changed.

-- 1) push_subscriptions: one row per device/browser the user opted in on.
create table if not exists public.push_subscriptions(
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  ua text,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subs_select_own on public.push_subscriptions;
create policy push_subs_select_own on public.push_subscriptions
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists push_subs_insert_own on public.push_subscriptions;
create policy push_subs_insert_own on public.push_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists push_subs_update_own on public.push_subscriptions;
create policy push_subs_update_own on public.push_subscriptions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists push_subs_delete_own on public.push_subscriptions;
create policy push_subs_delete_own on public.push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);
create index if not exists push_subs_user_idx on public.push_subscriptions(user_id);

-- 2) app_config: private key/value store. RLS enabled with NO policies, so only
--    the owner (security-definer functions, service role) can read it. The
--    push_hook_secret value is inserted out-of-band and never committed.
create table if not exists public.app_config(
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;
insert into public.app_config(key, value) values
  ('push_function_url', 'https://dbvzfcerkbhdolmocujm.supabase.co/functions/v1/push-dispatch')
on conflict (key) do nothing;

-- 3) pg_net for async HTTP from triggers.
create extension if not exists pg_net;

-- 4) push_dispatch(): fires the push-dispatch edge function with a minimal,
--    privacy-safe payload. Security definer so it can read app_config; it runs
--    as the owner and is not callable by clients.
create or replace function public.push_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_payload jsonb;
  v_actor uuid;
begin
  if TG_TABLE_NAME = 'messages' and TG_OP = 'INSERT' then
    v_payload := jsonb_build_object('kind', 'message', 'booking_id', NEW.booking_id, 'sender', NEW.sender, 'body', left(coalesce(NEW.body, ''), 120));
  elsif TG_TABLE_NAME = 'bookings' and TG_OP = 'INSERT' then
    v_payload := jsonb_build_object('kind', 'booking_new', 'booking_id', NEW.id, 'ride_id', NEW.ride_id, 'passenger', NEW.passenger_id, 'status', NEW.status, 'price', NEW.price);
  elsif TG_TABLE_NAME = 'bookings' and TG_OP = 'UPDATE' then
    if NEW.status is distinct from OLD.status or (NEW.arrived_at is not null and OLD.arrived_at is null) then
      v_payload := jsonb_build_object('kind', 'booking_update', 'booking_id', NEW.id, 'ride_id', NEW.ride_id, 'passenger', NEW.passenger_id, 'status', NEW.status, 'old_status', OLD.status, 'price', NEW.price, 'arrived', (NEW.arrived_at is not null and OLD.arrived_at is null));
    else
      return NEW;
    end if;
  else
    return coalesce(NEW, OLD);
  end if;
  select value into v_url from public.app_config where key = 'push_function_url';
  select value into v_secret from public.app_config where key = 'push_hook_secret';
  if v_url is null or v_secret is null then
    return coalesce(NEW, OLD);
  end if;
  begin
    v_actor := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub';
  exception when others then
    v_actor := null;
  end;
  v_payload := v_payload || jsonb_build_object('actor', v_actor);
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    body := v_payload
  );
  return coalesce(NEW, OLD);
end;
$$;
revoke all on function public.push_dispatch() from public, anon, authenticated;

-- 5) Triggers.
drop trigger if exists push_message on public.messages;
create trigger push_message after insert on public.messages
  for each row execute function public.push_dispatch();
drop trigger if exists push_booking_ins on public.bookings;
create trigger push_booking_ins after insert on public.bookings
  for each row execute function public.push_dispatch();
drop trigger if exists push_booking_upd on public.bookings;
create trigger push_booking_upd after update on public.bookings
  for each row execute function public.push_dispatch();
