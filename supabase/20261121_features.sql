-- 2026-11-21 feature pass: route alerts, referral rewards, driver public stats.
-- Adds NEW objects only. No existing table, policy, trigger or RPC is changed.

-- 1) Route alerts: a rider saves a route (+optional time) and gets notified when a
--    matching ride is published. Owner-only rows.
create table if not exists public.route_alerts(
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p integer not null,
  d integer not null,
  t text,
  created_at timestamptz not null default now()
);
alter table public.route_alerts enable row level security;
drop policy if exists route_alerts_own on public.route_alerts;
create policy route_alerts_own on public.route_alerts
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create index if not exists route_alerts_user_idx on public.route_alerts(user_id);

-- 2) Referrals: one row per referred account, written only by apply_referral.
create table if not exists public.referrals(
  id bigint generated always as identity primary key,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null unique references auth.users(id) on delete cascade,
  rewarded boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.referrals enable row level security;
drop policy if exists referrals_read_own on public.referrals;
create policy referrals_read_own on public.referrals
  for select to authenticated
  using (auth.uid() = referrer_id or auth.uid() = referred_id);
-- No insert/update/delete policy on purpose: only the RPC below may write.

-- 3) apply_referral: credits 20 EGP commission-wallet credit to both sides.
--    Anti-abuse: the referred account must have a saved email (anonymous guests
--    get rejected), one code per account, no self-referral, and a referrer earns
--    from at most 10 referrals. Credits are wallet balance only (no payout rail).
create or replace function public.apply_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_email text;
  v_ref uuid;
  v_count int;
  v_amount int := 20;
  v_max int := 10;
begin
  if v_me is null then
    raise exception 'سجل دخولك الأول.';
  end if;
  select email into v_email from auth.users where id = v_me;
  if v_email is null or v_email = '' then
    raise exception 'احفظ حسابك بالإيميل الأول من صفحة حسابي، وبعدين طبّق الكود.';
  end if;
  select id into v_ref from public.profiles
    where upper(ref_code) = upper(trim(coalesce(p_code, '')));
  if v_ref is null then
    raise exception 'كود الدعوة ده مش صحيح.';
  end if;
  if v_ref = v_me then
    raise exception 'مينفعش تستخدم كودك بنفسك.';
  end if;
  if exists(select 1 from public.referrals where referred_id = v_me) then
    raise exception 'اتطبق كود دعوة على حسابك قبل كده.';
  end if;
  select count(*) into v_count from public.referrals
    where referrer_id = v_ref and rewarded;
  insert into public.referrals(referrer_id, referred_id, rewarded)
    values (v_ref, v_me, v_count < v_max);
  if v_count >= v_max then
    return jsonb_build_object('rewarded', false, 'reason', 'cap');
  end if;
  update public.profiles set balance = balance + v_amount where id in (v_me, v_ref);
  insert into public.transactions(user_id, kind, amount, label, status) values
    (v_me, 'in', v_amount, 'مكافأة دعوة صاحب', 'ok'),
    (v_ref, 'in', v_amount, 'مكافأة دعوة صحابك', 'ok');
  return jsonb_build_object('rewarded', true, 'amount', v_amount);
end;
$$;
revoke all on function public.apply_referral(text) from public, anon;
grant execute on function public.apply_referral(text) to authenticated;

-- 4) driver_public_stats: public aggregate per driver (completed non-demo trips).
--    Read-only; powers the "N رحلة" line on ride cards. Ratings still come from
--    driver_ratings_summary; the verified badge still comes only from
--    driver_verification_status = approved.
create or replace view public.driver_public_stats as
select d.driver_id,
  coalesce(t.trips, 0)::int as trips
from (select distinct driver_id from public.rides where not coalesce(is_demo, false)) d
left join (
  select r.driver_id, count(*) as trips
  from public.bookings b
  join public.rides r on r.id = b.ride_id
  where b.status = 'done' and not coalesce(r.is_demo, false)
  group by r.driver_id
) t on t.driver_id = d.driver_id;
grant select on public.driver_public_stats to authenticated, anon;
