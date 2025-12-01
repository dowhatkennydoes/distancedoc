# Doctor Dashboard Preview - Complete

## Overview

The `DoctorDashboardPreview` model has been created and integrated into the seed script to populate dashboard metrics for each doctor.

## Schema Changes

### New Model: `DoctorDashboardPreview`

Added to `prisma/schema.prisma`:

```prisma
model DoctorDashboardPreview {
  id        String   @id @default(cuid())
  doctorId  String   @unique
  clinicId  String   // Tenant isolation - clinic identifier

  // Dashboard Metrics
  totalPatients         Int @default(0)
  upcomingAppointments  Int @default(0)
  unresolvedMessages    Int @default(0)
  pendingLabs           Int @default(0)

  // Relationships
  doctor Doctor @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Indexes for efficient queries
  @@index([doctorId])
  @@index([clinicId])
  @@index([clinicId, doctorId])
  @@map("doctor_dashboard_preview")
}
```

### Updated Model: `Doctor`

Added relationship:

```prisma
model Doctor {
  // ... existing fields ...
  dashboardPreview DoctorDashboardPreview?
  // ... existing fields ...
}
```

## Seed Script Updates

### New Function: `createDashboardPreview()`

Generates random metrics for each doctor:

```typescript
async function createDashboardPreview(doctorId: string): Promise<void> {
  // Generate random metrics
  const metrics = {
    totalPatients: getRandomInt(15, 150),
    upcomingAppointments: getRandomInt(2, 25),
    unresolvedMessages: getRandomInt(0, 15),
    pendingLabs: getRandomInt(0, 10),
  }
  
  // Create or update preview
  // ...
}
```

### Random Number Generator

```typescript
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
```

### Metrics Ranges

- **totalPatients**: 15-150
- **upcomingAppointments**: 2-25
- **unresolvedMessages**: 0-15
- **pendingLabs**: 0-10

## Data Insertion Flow

The seed script now:

1. Creates/updates doctor in Supabase Auth
2. Creates/updates `user_roles` entry
3. Creates/updates Doctor record in database
4. Creates availability blocks
5. **Creates dashboard preview with random metrics** (NEW)

## Migration Files

### 1. Standard Migration

**Location**: `prisma/migrations/add_doctor_dashboard_preview/migration.sql`

This is the standard Prisma migration format.

### 2. Dashboard Application Script

**Location**: `prisma/migrations/add_doctor_dashboard_preview/APPLY-VIA-DASHBOARD.sql`

This version includes:
- `IF NOT EXISTS` checks
- `DO $$ ... END $$` blocks for conditional creation
- Error handling
- Success notification

**To apply via Supabase Dashboard:**

1. Go to Supabase Dashboard > SQL Editor
2. Paste the contents of `APPLY-VIA-DASHBOARD.sql`
3. Run the script

## Usage

After running the seed script:

```bash
npx tsx scripts/seedDoctors.ts
```

Each doctor will have a dashboard preview with random metrics generated automatically.

## Example Output

```
   5. Creating dashboard preview...
   ✅ Created dashboard preview with random metrics
      - Total Patients: 87
      - Upcoming Appointments: 12
      - Unresolved Messages: 5
      - Pending Labs: 3
```

## Database Structure

### Table: `doctor_dashboard_preview`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Unique identifier |
| `doctorId` | TEXT (UNIQUE, FK) | References `doctors.id` |
| `clinicId` | TEXT | Tenant isolation |
| `totalPatients` | INTEGER | Total patient count |
| `upcomingAppointments` | INTEGER | Upcoming appointments count |
| `unresolvedMessages` | INTEGER | Unresolved messages count |
| `pendingLabs` | INTEGER | Pending lab orders count |
| `createdAt` | TIMESTAMP | Record creation time |
| `updatedAt` | TIMESTAMP | Last update time |

### Indexes

- Primary key on `id`
- Unique index on `doctorId`
- Index on `doctorId` for fast lookups
- Index on `clinicId` for tenant isolation
- Composite index on `(clinicId, doctorId)` for efficient queries

### Foreign Key

- `doctorId` → `doctors.id` (CASCADE delete)

## Next Steps

1. **Apply Migration**: Run the SQL migration in Supabase Dashboard
2. **Regenerate Prisma Client**: `npx prisma generate`
3. **Run Seed Script**: `npx tsx scripts/seedDoctors.ts`
4. **Verify**: Check that dashboard preview records are created for each doctor

## Notes

- The preview metrics are generated with random numbers for demo purposes
- In production, these would be calculated from actual data
- The `updatedAt` field is automatically updated via trigger
- The relationship uses `onDelete: Cascade` to maintain referential integrity

