-- LGU Emergency Attendance System
-- Run this in Supabase SQL Editor.
-- IMPORTANT: Replace/configure office coordinates in the app .env file.
-- This schema intentionally keeps employee PIN/password authentication
-- out of the employees table. For a production deployment, use Supabase Auth
-- or an approved office identity provider for employee authentication.

create extension if not exists pgcrypto;

create type public.emergency_status as enum ('ACTIVE','CLOSED');
create type public.attendance_type as enum ('MORNING_IN','MORNING_OUT','AFTERNOON_IN','AFTERNOON_OUT');
create type public.verification_status as enum ('PENDING','APPROVED','REJECTED');

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_no text unique not null,
  full_name text not null,
  department text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now()
);

create table if not exists public.emergency_events (
  id uuid primary key default gen_random_uuid(),
  event_date date not null default ((now() at time zone 'Asia/Manila')::date),
  reason text not null,
  status public.emergency_status not null default 'ACTIVE',
  activated_by uuid references auth.users(id),
  activated_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  emergency_event_id uuid not null references public.emergency_events(id) on delete restrict,
  attendance_date date not null,
  attendance_type public.attendance_type not null,
  attendance_time timestamptz not null default now(),
  latitude double precision not null,
  longitude double precision not null,
  gps_accuracy double precision,
  gps_distance_meters double precision,
  photo_path text not null,
  attendance_method text not null default 'EMERGENCY_WEB',
  verification_status public.verification_status not null default 'PENDING',
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique(employee_id, attendance_date, attendance_type)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  table_name text,
  record_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists attendance_date_idx on public.attendance(attendance_date);
create index if not exists attendance_employee_date_idx on public.attendance(employee_id, attendance_date);
create index if not exists emergency_events_status_idx on public.emergency_events(status);

alter table public.employees enable row level security;
alter table public.emergency_events enable row level security;
alter table public.attendance enable row level security;
alter table public.audit_logs enable row level security;

-- MVP policies:
-- Public employee lookup is intentionally limited to active employee identity fields.
-- Do NOT put confidential employee data in this table.
create policy "active employees can be looked up"
on public.employees for select
to anon, authenticated
using (status = 'ACTIVE');

-- Active emergency event is readable so the attendance page can determine availability.
create policy "active emergency event is readable"
on public.emergency_events for select
to anon, authenticated
using (status = 'ACTIVE');

-- Authenticated admins can manage emergency events.
create policy "authenticated users manage emergency events"
on public.emergency_events for all
to authenticated
using (true)
with check (true);

-- Attendance submission from the public emergency page.
create policy "emergency attendance can be inserted"
on public.attendance for insert
to anon, authenticated
with check (
  attendance_method = 'EMERGENCY_WEB'
  and verification_status = 'PENDING'
);

-- Authenticated admins can read/update attendance for review.
create policy "authenticated users review attendance"
on public.attendance for select
to authenticated
using (true);

create policy "authenticated users update attendance"
on public.attendance for update
to authenticated
using (true)
with check (true);

create policy "authenticated users read audit logs"
on public.audit_logs for select
to authenticated
using (true);

-- Storage bucket for attendance photos.
insert into storage.buckets (id, name, public)
values ('attendance-photos', 'attendance-photos', false)
on conflict (id) do nothing;

-- Employees need to upload photos, but not browse the entire bucket.
create policy "emergency attendance photo upload"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'attendance-photos');

-- Authenticated admin can read photos.
create policy "admins can read attendance photos"
on storage.objects for select
to authenticated
using (bucket_id = 'attendance-photos');

-- Authenticated admin can delete photos when required.
create policy "admins can delete attendance photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'attendance-photos');

-- Example employee records:
-- insert into public.employees(employee_no, full_name, department)
-- values
-- ('EMP-0001','Juan Dela Cruz','Office of the Mayor'),
-- ('EMP-0002','Maria Santos','HRMO');

-- IMPORTANT PRODUCTION NOTE:
-- For stronger security, replace the public insert policy with a Supabase
-- Edge Function that performs server-side validation of Philippine time,
-- active emergency event, attendance window, employee status, duplicate
-- attendance, and geofence coordinates. Browser-side validation alone
-- should not be treated as tamper-proof.
