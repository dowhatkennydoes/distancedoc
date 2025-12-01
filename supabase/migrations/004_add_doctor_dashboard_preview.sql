-- ============================================================================
-- Migration: Add Doctor Dashboard Preview Table
-- ============================================================================
-- 
-- Creates the doctor_dashboard_preview table for storing dashboard metrics
-- preview data for doctors.
--
-- ============================================================================

-- Create doctor_dashboard_preview table
create table if not exists public.doctor_dashboard_preview (
    id text not null,
    "doctorId" text not null,
    "clinicId" text not null,
    "totalPatients" integer not null default 0,
    "upcomingAppointments" integer not null default 0,
    "unresolvedMessages" integer not null default 0,
    "pendingLabs" integer not null default 0,
    "createdAt" timestamptz not null default now(),
    "updatedAt" timestamptz not null default now(),
    
    primary key (id)
);

-- Create unique index on doctorId (one preview per doctor)
create unique index if not exists doctor_dashboard_preview_doctorId_key 
on public.doctor_dashboard_preview ("doctorId");

-- Create indexes for efficient queries
create index if not exists doctor_dashboard_preview_clinicId_idx 
on public.doctor_dashboard_preview ("clinicId");

create index if not exists doctor_dashboard_preview_clinicId_doctorId_idx 
on public.doctor_dashboard_preview ("clinicId", "doctorId");

-- Add foreign key constraint to doctors table (if doctors table exists)
do $$ 
begin
    if exists (select 1 from information_schema.tables where table_name = 'doctors' and table_schema = 'public') then
        if not exists (
            select 1 from information_schema.table_constraints 
            where constraint_name = 'doctor_dashboard_preview_doctorId_fkey'
            and table_name = 'doctor_dashboard_preview'
        ) then
            alter table public.doctor_dashboard_preview 
            add constraint doctor_dashboard_preview_doctorId_fkey 
            foreign key ("doctorId") references public.doctors(id) 
            on delete cascade;
        end if;
    end if;
end $$;

-- Create trigger function for updatedAt (only if it doesn't exist)
create or replace function public.update_doctor_dashboard_preview_updated_at()
returns trigger as $$
begin
    new."updatedAt" = now();
    return new;
end;
$$ language plpgsql;

-- Create trigger (drop first if exists)
drop trigger if exists update_doctor_dashboard_preview_updated_at 
on public.doctor_dashboard_preview;

create trigger update_doctor_dashboard_preview_updated_at
    before update on public.doctor_dashboard_preview
    for each row
    execute function public.update_doctor_dashboard_preview_updated_at();

-- Add RLS policy (Row Level Security)
alter table public.doctor_dashboard_preview enable row level security;

-- Policy: Users can only access their own doctor dashboard preview
create policy "Users can access own doctor dashboard preview" on public.doctor_dashboard_preview
    for all using (
        exists (
            select 1 from public.user_roles ur
            where ur.user_id = auth.uid()
            and ur.doctor_id = doctor_dashboard_preview."doctorId"
        )
        or
        exists (
            select 1 from public.user_roles ur
            where ur.user_id = auth.uid()
            and ur.role = 'admin'
        )
    );

-- Grant necessary permissions
grant select, insert, update, delete on public.doctor_dashboard_preview to authenticated;
grant usage on schema public to authenticated;

