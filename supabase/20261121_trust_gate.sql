-- Applied to production on 2026-11-21. Keep admin review RPCs and RLS unchanged.
create or replace function public.block_demo_booking()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from rides where id=new.ride_id and is_demo) then
    raise exception 'Demo rides cannot be booked.';
  end if;
  return new;
end;
$$;
drop trigger if exists block_demo_booking on public.bookings;
create trigger block_demo_booking before insert or update of ride_id
on public.bookings for each row execute function public.block_demo_booking();

-- Exact, identified fixtures only. Preserve booking/history when removing test stars.
delete from public.driver_verifications
where driver_id='1566c1ce-6c06-4a02-b775-e244e5fc7368'
  and license_photo like 'https://placehold.co/%'
  and nid_photo like 'https://placehold.co/%';
update public.bookings set stars=null where id=4 and ride_id=2 and stars=5;
update public.rides set is_demo=true where id=5 and who='probe';
