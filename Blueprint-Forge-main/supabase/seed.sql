-- Idempotent demo records for a fictional Indian municipality.
-- Run after schema.sql. All people and locations are fictional.

insert into public.areas (name, code, description, population)
values
  ('Central Zone', 'CZ', 'Civic and commercial centre', 82400),
  ('North Zone', 'NZ', 'Residential and institutional district', 67300),
  ('South Zone', 'SZ', 'Mixed residential and industrial district', 71200),
  ('East Zone', 'EZ', 'Transit and market district', 58600),
  ('West Zone', 'WZ', 'Residential expansion district', 49100)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    population = excluded.population;

insert into public.complaints (
  complaint_number, title, description, category, location, area_id,
  priority, status, assigned_department, assigned_officer, reported_at, resolved_at
)
select
  'SC-2026-' || lpad(n::text, 4, '0'),
  (array[
    'Pothole repair required', 'Streetlight not working', 'Low water pressure',
    'Blocked storm drain', 'Missed waste pickup', 'Damaged road surface',
    'Unsafe crossing signal', 'Water leak reported', 'Overflowing community bin',
    'Footpath needs repair'
  ])[((n - 1) % 10) + 1],
  'Reported for municipal inspection and follow-up.',
  (array['Roads', 'Streetlights', 'Water Supply', 'Drainage', 'Waste Management', 'Public Safety', 'Other'])[((n - 1) % 7) + 1],
  (array[
    'Main Road', 'Market Area', 'Bus Stand Road', 'Railway Station Road',
    'Government Hospital Road', 'College Road', 'Temple Street',
    'Residential Zone', 'Industrial Area', 'Lakeview Junction'
  ])[((n - 1) % 10) + 1],
  (select id from public.areas where code = (array['CZ', 'NZ', 'SZ', 'EZ', 'WZ'])[((n - 1) % 5) + 1]),
  (array['Low', 'Medium', 'High', 'Critical'])[((n - 1) % 4) + 1],
  (array['Pending', 'In Progress', 'Resolved', 'Pending', 'In Progress', 'Rejected'])[((n - 1) % 6) + 1],
  (array['Public Works', 'Electrical', 'Water Services', 'Sanitation', 'Public Safety'])[((n - 1) % 5) + 1],
  (array['Field Team A', 'Field Team B', 'Zone Officer', 'Works Desk', 'Response Unit'])[((n - 1) % 5) + 1],
  now() - ((n * 17) % 180) * interval '1 day',
  case when n % 6 = 2 then now() - ((n * 9) % 60) * interval '1 day' else null end
from generate_series(1, 50) as seq(n)
where not exists (
  select 1 from public.complaints c
  where c.complaint_number = 'SC-2026-' || lpad(n::text, 4, '0')
);

insert into public.infrastructure (
  asset_number, asset_type, name, location, area_id, condition, status,
  assigned_department, last_inspection, next_maintenance, description
)
select
  'AST-' || lpad(n::text, 4, '0'),
  (array['Road', 'Streetlight', 'Water Pipeline', 'Drainage', 'Public Building', 'Bridge', 'Other'])[((n - 1) % 7) + 1],
  (array['Central connector road', 'Ward streetlight', 'Water distribution line', 'Stormwater channel', 'Community service centre', 'Canal bridge', 'Public facility'])[((n - 1) % 7) + 1],
  (array[
    'Main Road', 'Market Area', 'Bus Stand Road', 'Railway Station Road',
    'Government Hospital Road', 'College Road', 'Temple Street',
    'Residential Zone', 'Industrial Area', 'Lakeview Junction'
  ])[((n - 1) % 10) + 1],
  (select id from public.areas where code = (array['CZ', 'NZ', 'SZ', 'EZ', 'WZ'])[((n - 1) % 5) + 1]),
  (array['Good', 'Fair', 'Poor', 'Critical'])[((n - 1) % 4) + 1],
  (array['Operational', 'Operational', 'Needs Maintenance', 'Under Repair', 'Non Operational'])[((n - 1) % 5) + 1],
  (array['Public Works', 'Electrical', 'Water Services', 'Sanitation', 'Facilities'])[((n - 1) % 5) + 1],
  current_date - ((n * 11) % 220),
  current_date + ((n * 13) % 90),
  'Municipal asset record for inspection and maintenance planning.'
from generate_series(1, 25) as seq(n)
where not exists (
  select 1 from public.infrastructure i
  where i.asset_number = 'AST-' || lpad(n::text, 4, '0')
);

insert into public.sanitation (
  area_id, location, waste_level, collection_status, last_collection,
  next_collection, assigned_team, assigned_department, condition, notes
)
select
  (select id from public.areas where code = (array['CZ', 'NZ', 'SZ', 'EZ', 'WZ'])[((n - 1) % 5) + 1]),
  (array[
    'Main Road', 'Market Area', 'Bus Stand Road', 'Railway Station Road',
    'Government Hospital Road', 'College Road', 'Temple Street',
    'Residential Zone', 'Industrial Area', 'Lakeview Junction'
  ])[((n - 1) % 10) + 1],
  (array['Low', 'Medium', 'High', 'Critical'])[((n - 1) % 4) + 1],
  (array['Scheduled', 'Collected', 'Delayed', 'Missed', 'Scheduled'])[((n - 1) % 5) + 1],
  now() - ((n * 7) % 60) * interval '1 day',
  now() + ((n * 5) % 12) * interval '1 day',
  (array['Green Team North', 'City Clean Team', 'Zone Collection A', 'Rapid Sanitation', 'Ward Services'])[((n - 1) % 5) + 1],
  'Sanitation',
  (array['Clean', 'Moderate', 'Needs Attention', 'Critical'])[((n - 1) % 4) + 1],
  'Monitoring point ' || lpad(n::text, 2, '0')
from generate_series(1, 25) as seq(n)
where not exists (
  select 1 from public.sanitation s
  where s.location = (array[
    'Main Road', 'Market Area', 'Bus Stand Road', 'Railway Station Road',
    'Government Hospital Road', 'College Road', 'Temple Street',
    'Residential Zone', 'Industrial Area', 'Lakeview Junction'
  ])[((n - 1) % 10) + 1]
    and s.area_id = (select id from public.areas where code = (array['CZ', 'NZ', 'SZ', 'EZ', 'WZ'])[((n - 1) % 5) + 1])
    and s.notes = 'Monitoring point ' || lpad(n::text, 2, '0')
);

insert into public.maintenance (
  maintenance_number, title, description, category, location, area_id,
  assigned_department, assigned_team, priority, status, start_date,
  expected_completion, actual_completion, progress
)
select
  'MNT-' || lpad(n::text, 4, '0'),
  (array[
    'Resurface damaged carriageway', 'Replace streetlight fixtures',
    'Repair water distribution line', 'Desilt stormwater drain',
    'Restore footpath and kerb'
  ])[((n - 1) % 5) + 1],
  'Scheduled municipal works with field inspection and completion tracking.',
  (array['Roads', 'Streetlights', 'Water Supply', 'Drainage', 'Public Works'])[((n - 1) % 5) + 1],
  (array[
    'Main Road', 'Market Area', 'Bus Stand Road', 'Railway Station Road',
    'Government Hospital Road', 'College Road', 'Temple Street',
    'Residential Zone', 'Industrial Area', 'Lakeview Junction'
  ])[((n - 1) % 10) + 1],
  (select id from public.areas where code = (array['CZ', 'NZ', 'SZ', 'EZ', 'WZ'])[((n - 1) % 5) + 1]),
  (array['Public Works', 'Electrical', 'Water Services', 'Sanitation', 'Public Works'])[((n - 1) % 5) + 1],
  (array['Works Crew A', 'Works Crew B', 'Electrical Team', 'Water Team', 'Zone Crew'])[((n - 1) % 5) + 1],
  (array['Low', 'Medium', 'High', 'Critical'])[((n - 1) % 4) + 1],
  (array['Planned', 'In Progress', 'Completed', 'Delayed', 'Cancelled'])[((n - 1) % 5) + 1],
  current_date - ((n * 3) % 60),
  current_date + ((n * 4) % 45) - 7,
  case when n % 5 = 3 then current_date - ((n * 2) % 15) else null end,
  case
    when n % 5 = 3 then 100
    when n % 5 = 1 then 0
    when n % 5 = 4 then 45
    when n % 5 = 5 then 0
    else 20 + ((n * 7) % 70)
  end
from generate_series(1, 25) as seq(n)
where not exists (
  select 1 from public.maintenance m
  where m.maintenance_number = 'MNT-' || lpad(n::text, 4, '0')
);
