-- Smart Civic Resource Dashboard schema for Supabase PostgreSQL.
-- Run this file once in the Supabase SQL Editor before running seed.sql.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'viewer'
    check (role in ('admin', 'municipal_officer', 'department_officer', 'viewer')),
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  description text,
  population integer not null default 0 check (population >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  complaint_number text not null unique,
  title text not null,
  description text not null default '',
  notes text not null default '',
  category text not null check (category in (
    'Roads', 'Streetlights', 'Water Supply', 'Drainage',
    'Waste Management', 'Public Safety', 'Other'
  )),
  location text not null,
  area_id uuid not null references public.areas(id) on delete restrict,
  priority text not null default 'Medium'
    check (priority in ('Low', 'Medium', 'High', 'Critical')),
  status text not null default 'Pending'
    check (status in ('Pending', 'In Progress', 'Resolved', 'Rejected')),
  reported_by uuid references public.profiles(id) on delete set null,
  assigned_department text,
  assigned_officer text,
  reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.infrastructure (
  id uuid primary key default gen_random_uuid(),
  asset_number text not null unique,
  asset_type text not null check (asset_type in (
    'Road', 'Streetlight', 'Water Pipeline', 'Drainage',
    'Public Building', 'Bridge', 'Other'
  )),
  name text not null,
  location text not null,
  area_id uuid not null references public.areas(id) on delete restrict,
  condition text not null default 'Good'
    check (condition in ('Good', 'Fair', 'Poor', 'Critical')),
  status text not null default 'Operational'
    check (status in ('Operational', 'Needs Maintenance', 'Under Repair', 'Non Operational')),
  assigned_department text,
  last_inspection date,
  next_maintenance date,
  description text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sanitation (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id) on delete restrict,
  location text not null,
  waste_level text not null default 'Low'
    check (waste_level in ('Low', 'Medium', 'High', 'Critical')),
  collection_status text not null default 'Scheduled'
    check (collection_status in ('Scheduled', 'Collected', 'Delayed', 'Missed')),
  last_collection timestamptz,
  next_collection timestamptz,
  assigned_team text,
  assigned_department text,
  condition text not null default 'Clean'
    check (condition in ('Clean', 'Moderate', 'Needs Attention', 'Critical')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance (
  id uuid primary key default gen_random_uuid(),
  maintenance_number text not null unique,
  title text not null,
  description text not null default '',
  category text not null,
  location text not null,
  area_id uuid not null references public.areas(id) on delete restrict,
  assigned_department text,
  assigned_team text,
  priority text not null default 'Medium'
    check (priority in ('Low', 'Medium', 'High', 'Critical')),
  status text not null default 'Planned'
    check (status in ('Planned', 'In Progress', 'Completed', 'Delayed', 'Cancelled')),
  start_date date,
  expected_completion date,
  actual_completion date,
  progress integer not null default 0 check (progress between 0 and 100),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists complaints_status_idx on public.complaints(status);
create index if not exists complaints_priority_idx on public.complaints(priority);
create index if not exists complaints_category_idx on public.complaints(category);
create index if not exists complaints_area_idx on public.complaints(area_id);
create index if not exists complaints_reported_at_idx on public.complaints(reported_at desc);
create index if not exists complaints_updated_at_idx on public.complaints(updated_at desc);
create index if not exists infrastructure_condition_idx on public.infrastructure(condition);
create index if not exists infrastructure_area_idx on public.infrastructure(area_id);
create index if not exists sanitation_collection_status_idx on public.sanitation(collection_status);
create index if not exists sanitation_area_idx on public.sanitation(area_id);
create index if not exists maintenance_status_idx on public.maintenance(status);
create index if not exists maintenance_area_idx on public.maintenance(area_id);
create index if not exists notifications_user_read_idx on public.notifications(user_id, is_read, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists areas_set_updated_at on public.areas;
create trigger areas_set_updated_at before update on public.areas
for each row execute function public.set_updated_at();
drop trigger if exists complaints_set_updated_at on public.complaints;
create trigger complaints_set_updated_at before update on public.complaints
for each row execute function public.set_updated_at();
drop trigger if exists infrastructure_set_updated_at on public.infrastructure;
create trigger infrastructure_set_updated_at before update on public.infrastructure
for each row execute function public.set_updated_at();
drop trigger if exists sanitation_set_updated_at on public.sanitation;
create trigger sanitation_set_updated_at before update on public.sanitation
for each row execute function public.set_updated_at();
drop trigger if exists maintenance_set_updated_at on public.maintenance;
create trigger maintenance_set_updated_at before update on public.maintenance
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, department)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    'viewer',
    nullif(new.raw_user_meta_data ->> 'department', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        department = coalesce(public.profiles.department, excluded.department),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for any existing auth users who registered before the trigger was installed:
insert into public.profiles (id, full_name, email, role, department)
select
  u.id,
  nullif(u.raw_user_meta_data ->> 'full_name', ''),
  u.email,
  'admin',
  nullif(u.raw_user_meta_data ->> 'department', '')
from auth.users u
on conflict (id) do update
set email = excluded.email,
    role = case when public.profiles.role is null or public.profiles.role = 'viewer' then 'admin' else public.profiles.role end,
    updated_at = now();

create or replace function public.user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.user_department()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select department from public.profiles where id = auth.uid()
$$;

alter table public.profiles enable row level security;
alter table public.areas enable row level security;
alter table public.complaints enable row level security;
alter table public.infrastructure enable row level security;
alter table public.sanitation enable row level security;
alter table public.maintenance enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "profiles_read_self_or_admin" on public.profiles;
create policy "profiles_read_self_or_admin" on public.profiles
for select to authenticated
using (id = auth.uid() or public.user_role() = 'admin');
drop policy if exists "profiles_admin_manage" on public.profiles;
create policy "profiles_admin_manage" on public.profiles
for all to authenticated
using (public.user_role() = 'admin')
with check (public.user_role() = 'admin');

drop policy if exists "areas_read_authenticated" on public.areas;
create policy "areas_read_authenticated" on public.areas
for select to authenticated using (true);
drop policy if exists "areas_admin_or_municipal_write" on public.areas;
create policy "areas_admin_or_municipal_write" on public.areas
for all to authenticated
using (public.user_role() in ('admin', 'municipal_officer'))
with check (public.user_role() in ('admin', 'municipal_officer'));

drop policy if exists "complaints_read_authenticated" on public.complaints;
create policy "complaints_read_authenticated" on public.complaints
for select to authenticated using (true);
drop policy if exists "complaints_create_authorized" on public.complaints;
create policy "complaints_create_authorized" on public.complaints
for insert to authenticated
with check (public.user_role() in ('admin', 'municipal_officer'));
drop policy if exists "complaints_update_assigned" on public.complaints;
create policy "complaints_update_assigned" on public.complaints
for update to authenticated
using (
  public.user_role() in ('admin', 'municipal_officer')
  or (public.user_role() = 'department_officer' and assigned_department = public.user_department())
)
with check (
  public.user_role() in ('admin', 'municipal_officer')
  or (public.user_role() = 'department_officer' and assigned_department = public.user_department())
);
drop policy if exists "complaints_admin_delete" on public.complaints;
create policy "complaints_admin_delete" on public.complaints
for delete to authenticated using (public.user_role() = 'admin');

drop policy if exists "infrastructure_read_authenticated" on public.infrastructure;
create policy "infrastructure_read_authenticated" on public.infrastructure
for select to authenticated using (true);
drop policy if exists "infrastructure_create_authorized" on public.infrastructure;
create policy "infrastructure_create_authorized" on public.infrastructure
for insert to authenticated with check (public.user_role() in ('admin', 'municipal_officer'));
drop policy if exists "infrastructure_update_assigned" on public.infrastructure;
create policy "infrastructure_update_assigned" on public.infrastructure
for update to authenticated
using (
  public.user_role() in ('admin', 'municipal_officer')
  or (public.user_role() = 'department_officer' and assigned_department = public.user_department())
)
with check (
  public.user_role() in ('admin', 'municipal_officer')
  or (public.user_role() = 'department_officer' and assigned_department = public.user_department())
);
drop policy if exists "infrastructure_admin_delete" on public.infrastructure;
create policy "infrastructure_admin_delete" on public.infrastructure
for delete to authenticated using (public.user_role() = 'admin');

drop policy if exists "sanitation_read_authenticated" on public.sanitation;
create policy "sanitation_read_authenticated" on public.sanitation
for select to authenticated using (true);
drop policy if exists "sanitation_create_authorized" on public.sanitation;
create policy "sanitation_create_authorized" on public.sanitation
for insert to authenticated with check (public.user_role() in ('admin', 'municipal_officer'));
drop policy if exists "sanitation_update_assigned" on public.sanitation;
create policy "sanitation_update_assigned" on public.sanitation
for update to authenticated
using (
  public.user_role() in ('admin', 'municipal_officer')
  or (public.user_role() = 'department_officer' and assigned_department = public.user_department())
)
with check (
  public.user_role() in ('admin', 'municipal_officer')
  or (public.user_role() = 'department_officer' and assigned_department = public.user_department())
);
drop policy if exists "sanitation_admin_delete" on public.sanitation;
create policy "sanitation_admin_delete" on public.sanitation
for delete to authenticated using (public.user_role() = 'admin');

drop policy if exists "maintenance_read_authenticated" on public.maintenance;
create policy "maintenance_read_authenticated" on public.maintenance
for select to authenticated using (true);
drop policy if exists "maintenance_create_authorized" on public.maintenance;
create policy "maintenance_create_authorized" on public.maintenance
for insert to authenticated with check (public.user_role() in ('admin', 'municipal_officer'));
drop policy if exists "maintenance_update_assigned" on public.maintenance;
create policy "maintenance_update_assigned" on public.maintenance
for update to authenticated
using (
  public.user_role() in ('admin', 'municipal_officer')
  or (public.user_role() = 'department_officer' and assigned_department = public.user_department())
)
with check (
  public.user_role() in ('admin', 'municipal_officer')
  or (public.user_role() = 'department_officer' and assigned_department = public.user_department())
);
drop policy if exists "maintenance_admin_delete" on public.maintenance;
create policy "maintenance_admin_delete" on public.maintenance
for delete to authenticated using (public.user_role() = 'admin');

drop policy if exists "notifications_read_own_or_admin" on public.notifications;
create policy "notifications_read_own_or_admin" on public.notifications
for select to authenticated
using (user_id = auth.uid() or public.user_role() = 'admin');
drop policy if exists "notifications_update_own_or_admin" on public.notifications;
create policy "notifications_update_own_or_admin" on public.notifications
for update to authenticated
using (user_id = auth.uid() or public.user_role() = 'admin')
with check (user_id = auth.uid() or public.user_role() = 'admin');

create or replace function public.notify_civic_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_row jsonb := to_jsonb(new);
  old_row jsonb;
  notification_title text;
  notification_message text;
  notification_type text;
  event_department text;
begin
  old_row := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  event_department := nullif(new_row ->> 'assigned_department', '');

  if tg_table_name = 'complaints'
     and new_row ->> 'priority' = 'Critical'
     and (tg_op = 'INSERT' or old_row ->> 'priority' is distinct from new_row ->> 'priority') then
    notification_title := 'Critical complaint reported';
    notification_message := coalesce(new_row ->> 'title', 'Complaint') || ' — ' || coalesce(new_row ->> 'location', 'Location not set');
    notification_type := 'critical_complaint';
  elsif tg_table_name = 'infrastructure'
     and new_row ->> 'condition' = 'Critical'
     and (tg_op = 'INSERT' or old_row ->> 'condition' is distinct from new_row ->> 'condition') then
    notification_title := 'Critical infrastructure condition';
    notification_message := coalesce(new_row ->> 'name', 'Infrastructure asset') || ' — ' || coalesce(new_row ->> 'location', 'Location not set');
    notification_type := 'critical_infrastructure';
  elsif tg_table_name = 'sanitation'
     and (
       (new_row ->> 'collection_status' = 'Missed' and (tg_op = 'INSERT' or old_row ->> 'collection_status' is distinct from new_row ->> 'collection_status'))
       or (new_row ->> 'condition' = 'Critical' and (tg_op = 'INSERT' or old_row ->> 'condition' is distinct from new_row ->> 'condition'))
       or (new_row ->> 'waste_level' in ('High', 'Critical') and (tg_op = 'INSERT' or old_row ->> 'waste_level' is distinct from new_row ->> 'waste_level'))
     ) then
    notification_title := case
      when new_row ->> 'collection_status' = 'Missed' then 'Missed waste collection'
      when new_row ->> 'condition' = 'Critical' then 'Critical sanitation condition'
      else 'High waste level'
    end;
    notification_message := coalesce(new_row ->> 'location', 'Location not set');
    notification_type := 'sanitation_alert';
  elsif tg_table_name = 'maintenance'
     and (
       (new_row ->> 'status' = 'Delayed' and (tg_op = 'INSERT' or old_row ->> 'status' is distinct from new_row ->> 'status'))
       or (
         new_row ->> 'status' in ('Planned', 'In Progress')
         and (new_row ->> 'expected_completion')::date between current_date and current_date + 3
         and (tg_op = 'INSERT' or old_row ->> 'expected_completion' is distinct from new_row ->> 'expected_completion')
       )
     ) then
    notification_title := case
      when new_row ->> 'status' = 'Delayed' then 'Maintenance delayed'
      else 'Upcoming maintenance completion'
    end;
    notification_message := coalesce(new_row ->> 'title', 'Maintenance task') || ' — ' || coalesce(new_row ->> 'expected_completion', 'date not set');
    notification_type := case when new_row ->> 'status' = 'Delayed' then 'delayed_maintenance' else 'upcoming_maintenance' end;
  else
    return new;
  end if;

  insert into public.notifications (user_id, title, message, type)
  select p.id, notification_title, notification_message, notification_type
  from public.profiles p
  where p.role in ('admin', 'municipal_officer', 'department_officer')
    and (
      p.role <> 'department_officer'
      or event_department is null
      or p.department = event_department
    );
  return new;
end;
$$;

drop trigger if exists complaints_notify_critical on public.complaints;
create trigger complaints_notify_critical after insert or update on public.complaints
for each row execute function public.notify_civic_event();
drop trigger if exists infrastructure_notify_critical on public.infrastructure;
create trigger infrastructure_notify_critical after insert or update on public.infrastructure
for each row execute function public.notify_civic_event();
drop trigger if exists sanitation_notify_alerts on public.sanitation;
create trigger sanitation_notify_alerts after insert or update on public.sanitation
for each row execute function public.notify_civic_event();
drop trigger if exists maintenance_notify_schedule on public.maintenance;
create trigger maintenance_notify_schedule after insert or update on public.maintenance
for each row execute function public.notify_civic_event();

-- Aggregation stays in PostgreSQL; SECURITY INVOKER keeps the caller's RLS
-- policies active while avoiding large dashboard table downloads.
create or replace function public.get_dashboard_stats()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with critical_rows as (
    select jsonb_build_object(
      'id', c.id, 'complaint_number', c.complaint_number, 'title', c.title,
      'category', c.category, 'location', c.location, 'area_id', c.area_id,
      'area_name', a.name, 'priority', c.priority, 'status', c.status,
      'reported_at', c.reported_at, 'created_at', c.created_at
    ) as record
    from public.complaints c
    left join public.areas a on a.id = c.area_id
    where c.priority = 'Critical'
    union all
    select jsonb_build_object(
      'id', i.id, 'asset_number', i.asset_number, 'asset_type', i.asset_type,
      'name', i.name, 'title', i.name, 'location', i.location, 'area_id', i.area_id,
      'area_name', a.name, 'condition', i.condition, 'status', i.status,
      'created_at', i.created_at
    )
    from public.infrastructure i
    left join public.areas a on a.id = i.area_id
    where i.condition = 'Critical'
    union all
    select jsonb_build_object(
      'id', s.id, 'title', 'Sanitation alert', 'location', s.location,
      'area_id', s.area_id, 'area_name', a.name, 'condition', s.condition,
      'waste_level', s.waste_level, 'collection_status', s.collection_status,
      'created_at', s.created_at
    )
    from public.sanitation s
    left join public.areas a on a.id = s.area_id
    where s.condition = 'Critical'
    union all
    select jsonb_build_object(
      'id', m.id, 'maintenance_number', m.maintenance_number, 'title', m.title,
      'category', m.category, 'location', m.location, 'area_id', m.area_id,
      'area_name', a.name, 'priority', m.priority, 'status', m.status,
      'expected_completion', m.expected_completion, 'progress', m.progress,
      'created_at', m.created_at
    )
    from public.maintenance m
    left join public.areas a on a.id = m.area_id
    where m.priority = 'Critical'
  )
  select jsonb_build_object(
    'total_complaints', (select count(*) from public.complaints),
    'pending_complaints', (select count(*) from public.complaints where status = 'Pending'),
    'in_progress_complaints', (select count(*) from public.complaints where status = 'In Progress'),
    'resolved_complaints', (select count(*) from public.complaints where status = 'Resolved'),
    'infrastructure_issues', (select count(*) from public.infrastructure where condition in ('Poor', 'Critical')),
    'sanitation_issues', (select count(*) from public.sanitation where condition in ('Needs Attention', 'Critical')),
    'active_maintenance', (select count(*) from public.maintenance where status in ('Planned', 'In Progress', 'Delayed')),
    'critical_issue_count', (select count(*) from critical_rows),
    'complaints_by_category', coalesce((
      select jsonb_agg(jsonb_build_object('name', category, 'count', count) order by count desc)
      from (select category, count(*) as count from public.complaints group by category) q
    ), '[]'::jsonb),
    'complaints_by_status', coalesce((
      select jsonb_agg(jsonb_build_object('name', status, 'count', count) order by count desc)
      from (select status, count(*) as count from public.complaints group by status) q
    ), '[]'::jsonb),
    'complaints_by_area', coalesce((
      select jsonb_agg(jsonb_build_object('name', a.name, 'count', q.count) order by q.count desc)
      from (
        select area_id, count(*) as count from public.complaints group by area_id
      ) q
      left join public.areas a on a.id = q.area_id
    ), '[]'::jsonb),
    'monthly_trends', coalesce((
      select jsonb_agg(jsonb_build_object('name', month, 'count', count) order by month)
      from (
        select to_char(date_trunc('month', reported_at), 'YYYY-MM') as month,
               count(*) as count
        from public.complaints
        where reported_at >= date_trunc('month', now()) - interval '5 months'
        group by date_trunc('month', reported_at)
      ) q
    ), '[]'::jsonb),
    'infrastructure_condition', coalesce((
      select jsonb_agg(jsonb_build_object('name', condition, 'count', count) order by condition)
      from (select condition, count(*) as count from public.infrastructure group by condition) q
    ), '[]'::jsonb),
    'sanitation_condition', coalesce((
      select jsonb_agg(jsonb_build_object('name', condition, 'count', count) order by count desc)
      from (select condition, count(*) as count from public.sanitation group by condition) q
    ), '[]'::jsonb),
    'maintenance_progress', coalesce((
      select jsonb_agg(jsonb_build_object('name', status, 'count', average_progress) order by status)
      from (
        select status, round(avg(progress)::numeric, 1) as average_progress
        from public.maintenance
        group by status
      ) q
    ), '[]'::jsonb),
    'priority_distribution', coalesce((
      select jsonb_agg(jsonb_build_object('name', priority, 'count', count) order by count desc)
      from (select priority, count(*) as count from public.complaints group by priority) q
    ), '[]'::jsonb),
    'recent_complaints', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.reported_at desc)
      from (
        select c.id, c.complaint_number, c.title, c.category, c.location,
               c.area_id, a.name as area_name, c.priority, c.status,
               c.reported_at, c.created_at
        from public.complaints c
        left join public.areas a on a.id = c.area_id
        order by c.reported_at desc
        limit 8
      ) q
    ), '[]'::jsonb),
    'critical_issues', coalesce((
      select jsonb_agg(record order by record ->> 'created_at' desc)
      from (select record from critical_rows limit 12) q
    ), '[]'::jsonb)
  );
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.areas, public.complaints,
  public.infrastructure, public.sanitation, public.maintenance, public.notifications,
  public.profiles to authenticated;
grant execute on function public.user_role() to authenticated;
grant execute on function public.user_department() to authenticated;
grant execute on function public.get_dashboard_stats() to authenticated;

