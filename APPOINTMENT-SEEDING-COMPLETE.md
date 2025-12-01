# Appointment Seeding Extension - Complete

## Overview

The `seedDoctors.ts` script has been extended to create demo patients and appointments.

## What Was Added

### 1. Demo Patient Creation

The script now creates 5 demo patients with the following details:

- **Sarah Johnson** (`sarah.johnson@demo.com`)
- **Kevin Brooks** (`kevin.brooks@demo.com`)
- **Alicia Martinez** (`alicia.martinez@demo.com`)
- **Jordan Lee** (`jordan.lee@demo.com`)
- **Naomi Ellis** (`naomi.ellis@demo.com`)

Each patient:
- Has a Supabase Auth user account
- Has a `user_roles` entry with `role='patient'`
- Has a `Patient` record in the database
- Is assigned to `clinicId='demo-clinic-001'`

### 2. Appointment Creation

The script creates 6 appointments:

#### Doctor 1 (Marcus Walters - Internal Medicine):
1. **Tomorrow at 10:00** → Sarah Johnson (Routine checkup)
2. **Tomorrow at 12:30** → Kevin Brooks (Follow-up appointment)

#### Doctor 2 (Linda Patel - Dermatology):
3. **Next Tuesday at 11:00** → Sarah Johnson (Dermatology consultation)
4. **Next Tuesday at 14:00** → Alicia Martinez (Skin condition review)

#### Doctor 3 (Daniel Kim - Psychiatry):
5. **Next Friday at 09:30** → Jordan Lee (Initial psychiatric consultation)
6. **Next Friday at 12:00** → Naomi Ellis (Therapy session)

All appointments:
- Are assigned to `clinicId='demo-clinic-001'`
- Have `status='SCHEDULED'`
- Have `visitType='VIDEO'`
- Have `duration=30` minutes
- Include a reason/description

## New Functions

### `createPatient(patientData)`
Creates a demo patient with:
- Supabase Auth user
- `user_roles` entry
- `Patient` database record

### `getNextWeekday(dayOfWeek)`
Calculates the next occurrence of a specific weekday (0=Sunday, 1=Monday, etc.)

### `createAppointmentDateTime(baseDate, timeString)`
Creates a Date object with a specific time on a given date

### `createAppointment(doctorId, patientId, scheduledAt, reason?)`
Creates an appointment record in the database

## Updated Seed Process

The `seedDoctors()` function now runs in 3 steps:

1. **Step 1**: Create all doctors (existing functionality)
2. **Step 2**: Create all demo patients (new)
3. **Step 3**: Create all appointments (new)

## Usage

Run the script as before:

```bash
npx tsx scripts/seedDoctors.ts
```

The script will:
- Create/update all 3 doctors
- Create all 5 demo patients
- Create all 6 appointments
- Show a summary of all created records

## Notes

- The script is idempotent - running it multiple times will update existing records rather than creating duplicates
- Demo patients use password `demo123` (not intended for production use)
- Appointment dates are calculated dynamically:
  - "Tomorrow" = current date + 1 day
  - "Next Tuesday" = next occurrence of Tuesday
  - "Next Friday" = next occurrence of Friday

## Summary Output

After running, you'll see:

```
✅ Doctors: 3/3
✅ Patients: 5/5
✅ Appointments: 6/6
```

