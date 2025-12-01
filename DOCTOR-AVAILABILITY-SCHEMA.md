# Doctor Availability Schema

## Overview

A new `DoctorAvailability` model has been added to track when doctors are available for appointments.

## Prisma Schema Changes

### New Enum: `DayOfWeek`

```prisma
enum DayOfWeek {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}
```

### New Model: `DoctorAvailability`

```prisma
model DoctorAvailability {
  id        String    @id @default(cuid())
  doctorId  String
  clinicId  String // Tenant isolation - clinic identifier
  dayOfWeek DayOfWeek
  startTime String // Format: "HH:mm" (e.g., "09:00")
  endTime   String // Format: "HH:mm" (e.g., "17:00")

  // Relationships
  doctor Doctor @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Indexes for efficient queries
  @@index([doctorId])
  @@index([clinicId])
  @@index([dayOfWeek])
  @@index([clinicId, doctorId])
  @@index([doctorId, dayOfWeek])
  @@map("doctor_availability")
}
```

### Updated Model: `Doctor`

Added relationship to availability:

```prisma
model Doctor {
  // ... existing fields ...
  availability  DoctorAvailability[]
  // ... rest of model ...
}
```

## Database Table

Table name: `doctor_availability`

Columns:
- `id` (String, Primary Key)
- `doctorId` (String, Foreign Key → `doctors.id`)
- `clinicId` (String, Tenant isolation)
- `dayOfWeek` (DayOfWeek enum)
- `startTime` (String, format: "HH:mm")
- `endTime` (String, format: "HH:mm")
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

## Indexes

The following indexes are created for performance:
- `doctorId` - Fast lookup by doctor
- `clinicId` - Tenant isolation queries
- `dayOfWeek` - Filter by day of week
- `[clinicId, doctorId]` - Composite for clinic-scoped doctor queries
- `[doctorId, dayOfWeek]` - Composite for doctor's schedule by day

## Seed Data

The `seedDoctors.ts` script now creates availability blocks for each doctor:

### Doctor 1 (Marcus Walters)
- **Monday**: 09:00–13:00
- **Wednesday**: 12:00–17:00

### Doctor 2 (Linda Patel)
- **Tuesday**: 09:00–15:00
- **Thursday**: 10:00–14:00

### Doctor 3 (Daniel Kim)
- **Monday**: 14:00–18:00
- **Friday**: 09:00–13:00

## Migration Steps

1. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

2. **Create Migration:**
   ```bash
   npx prisma migrate dev --name add_doctor_availability
   ```

3. **Or Push Schema (Development):**
   ```bash
   npx prisma db push
   ```

## Usage Example

```typescript
// Query doctor availability
const availability = await prisma.doctorAvailability.findMany({
  where: {
    doctorId: 'doctor-id',
    dayOfWeek: 'MONDAY',
  },
})

// Create availability block
await prisma.doctorAvailability.create({
  data: {
    doctorId: 'doctor-id',
    clinicId: 'demo-clinic-001',
    dayOfWeek: 'MONDAY',
    startTime: '09:00',
    endTime: '13:00',
  },
})
```

## Notes

- Times are stored as strings in "HH:mm" format (24-hour)
- Cascade delete: When a doctor is deleted, their availability is automatically removed
- Tenant isolation: All queries should filter by `clinicId` for security
- Multiple blocks per day: A doctor can have multiple time blocks on the same day

