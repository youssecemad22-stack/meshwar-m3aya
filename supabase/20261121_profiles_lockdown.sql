-- Lock down profiles: owner-only row access + a minimal public name directory.
-- Ride cards, chat and booking lists only ever need (id, name) of other users;
-- balance, ref_code and everything else stay readable by the owner alone.

-- 1) Minimal public directory: id + display name only.
create or replace view public.public_profile_names as
  select id, name from public.profiles;

grant select on public.public_profile_names to authenticated, anon;

-- 2) profiles rows: only the owner can read.
drop policy if exists profiles_select_all on public.profiles;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
