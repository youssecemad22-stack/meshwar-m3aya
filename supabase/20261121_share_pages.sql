-- 2026-11-21 share pages: regenerate the static GitHub Pages share card for a
-- ride whenever it changes. Reuses app_config + the push hook secret.
insert into public.app_config(key, value) values
  ('share_function_url', 'https://dbvzfcerkbhdolmocujm.supabase.co/functions/v1/share-pages')
on conflict (key) do nothing;

create or replace function public.share_page_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_id bigint;
begin
  v_id := coalesce(NEW.id, OLD.id);
  select value into v_url from public.app_config where key = 'share_function_url';
  select value into v_secret from public.app_config where key = 'push_hook_secret';
  if v_url is null or v_secret is null then
    return coalesce(NEW, OLD);
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    body := jsonb_build_object('ride_id', v_id)
  );
  return coalesce(NEW, OLD);
end;
$$;
revoke all on function public.share_page_dispatch() from public, anon, authenticated;

drop trigger if exists rides_share_page on public.rides;
create trigger rides_share_page after insert or update or delete on public.rides
  for each row execute function public.share_page_dispatch();
