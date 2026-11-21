begin;
create table public.trip_reports (
 id bigint generated always as identity primary key,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 booking_id bigint references public.bookings(id),
 kind text not null check (kind in ('safety','driver','rider','payment','other')),
 body text not null check (length(trim(body)) between 10 and 2000),
 status text not null default 'open' check (status in ('open','reviewing','resolved')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.trip_reports enable row level security;
create policy report_read on public.trip_reports for select to authenticated using (user_id=auth.uid());
create policy report_insert on public.trip_reports for insert to authenticated with check (
 user_id=auth.uid() and status='open' and (booking_id is null or exists (
 select 1 from public.bookings b join public.rides r on r.id=b.ride_id
 where b.id=trip_reports.booking_id and (b.passenger_id=auth.uid() or r.driver_id=auth.uid())
 ))
);
revoke all on public.trip_reports from anon,authenticated;
grant select on public.trip_reports to authenticated;
grant insert (booking_id,kind,body) on public.trip_reports to authenticated;
grant usage on sequence public.trip_reports_id_seq to authenticated;
create index on public.trip_reports(user_id,created_at desc);
create or replace function public.admin_trip_reports() returns setof public.trip_reports
language plpgsql security definer set search_path=public as $$
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Not authorized'; end if;
 return query select * from public.trip_reports order by created_at desc limit 100;
end;
$$;
create or replace function public.admin_report_status(p_id bigint,p_status text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Not authorized'; end if;
 if p_status not in ('open','reviewing','resolved') then raise exception 'Invalid status'; end if;
 update public.trip_reports set status=p_status,updated_at=now() where id=p_id;
 if not found then raise exception 'Report not found'; end if;
end;
$$;
revoke all on function public.admin_trip_reports() from public,anon;
revoke all on function public.admin_report_status(bigint,text) from public,anon;
grant execute on function public.admin_trip_reports() to authenticated;
grant execute on function public.admin_report_status(bigint,text) to authenticated;
commit;
