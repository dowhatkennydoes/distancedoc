# Database Setup Analysis

## Executive Summary

The DistanceDoc project uses a **hybrid database architecture** with multiple database systems:

1. **Primary Database**: PostgreSQL (via Prisma ORM)
   - Currently configured for Supabase (based on env.example)
   - Designed for Cloud SQL on GCP (connection strings present)
   - Schema includes 13 models with comprehensive relationships

2. **Authentication Database**: Supabase Auth + custom `user_roles` table
   - Row Level Security (RLS) enabled
   - Tenant isolation via `clinic_id`

3. **NoSQL Database**: Firestore (stub implementation)
   - Planned for real-time chat functionality
   - Not yet fully implemented

4. **Migration Strategy**: Dual migration system
   - Prisma migrations for main schema
   - Supabase migrations for auth/tenant setup

---

## 1. Database Architecture Overview

### 1.1 Primary Database: PostgreSQL (Prisma)

**Location**: `prisma/schema.prisma`

**Connection Methods**:
- **Prisma Client** (`db/prisma.ts`) - Main ORM
- **Raw PostgreSQL Pool** (`lib/gcp/gcp-sql.ts`) - Direct connections
- **Cloud Functions Prisma** (`functions/src/lib/database.ts`) - Serverless

**Database Providers**:
- **Supabase** (current): `postgresql://postgres:...@db.vhwvejtjrajjsluutrqv.supabase.co:5432/postgres`
- **Cloud SQL** (planned): `postgresql://postgres:...@/distancedoc?host=/cloudsql/distancedoc:us-central1:distancedoc-db`

### 1.2 Authentication Database: Supabase

**Location**: `supabase/migrations/`

**Key Features**:
- Supabase Auth for user management
- Custom `user_roles` table linking Supabase users to application roles
- Row Level Security (RLS) policies
- Tenant isolation with `clinic_id`

### 1.3 NoSQL Database: Firestore

**Location**: `db/firestore.ts`, `lib/firestore/client.ts`

**Status**: Stub implementation (commented out TODOs)
**Planned Use**: Real-time chat, notifications

---

## 2. Database Schema Analysis

### 2.1 Prisma Schema Models (13 Total)

#### Core Models

1. **Doctor** (`doctors`)
   - Healthcare provider information
   - Key indexes: `userId`, `licenseNumber`, `npiNumber`, `clinicId`
   - Relationships: Appointments, Consultations, VisitNotes, LabOrders, Messages

2. **Patient** (`patients`)
   - Patient medical information
   - Key indexes: `userId`, `dateOfBirth`, `clinicId`
   - Relationships: Appointments, Consultations, VisitNotes, IntakeForms, Medications, LabOrders, FileRecords, Messages, Payments

3. **Appointment** (`appointments`)
   - Scheduled visits
   - Key indexes: `doctorId`, `patientId`, `clinicId`, `scheduledAt`, `status`
   - Enums: `AppointmentStatus`, `VisitType`

4. **Consultation** (`consultations`)
   - Active visit sessions
   - One-to-one with Appointment
   - Stores transcription and recording URLs

5. **VisitNote** (`visit_notes`)
   - SOAP note clinical documentation
   - AI support: `aiGenerated`, `aiModel` fields
   - One-to-one with Appointment/Consultation

6. **IntakeForm** (`intake_forms`)
   - Pre-visit patient forms
   - Flexible JSON structure (`formData`)
   - Enums: `IntakeFormType`, `IntakeFormStatus`

#### Supporting Models

7. **Medication** (`medications`)
8. **LabOrder** (`lab_orders`)
9. **FileRecord** (`file_records`)
10. **MessageThread** (`message_threads`)
11. **Message** (`messages`)
12. **Payment** (`payments`)
13. **Notification** (`notifications`)

### 2.2 Tenant Isolation

**Implementation**: `clinic_id` field added to core models
- `Doctor`, `Patient`, `Appointment`, `VisitNote`, `MessageThread`
- Added via Supabase migration `002_add_clinic_id.sql`
- Composite indexes for efficient querying: `(clinicId, userId)`, `(clinicId, doctorId)`

**Migration Status**:
- ✅ Supabase migration applied
- ⚠️ Prisma schema includes `clinicId` but migration may be missing

### 2.3 Indexes and Performance

**Strengths**:
- Foreign key indexes on all relationships
- Composite indexes for common query patterns
- Status and date indexes for filtering

**Example Composite Indexes**:
- `(clinicId, doctorId)` on appointments
- `(clinicId, patientId)` on appointments
- `(doctorId, scheduledAt)` on appointments

---

## 3. Connection Management

### 3.1 Prisma Client Configuration

**File**: `db/prisma.ts`

**Issues Identified**:
```typescript
// TODO: Implement singleton pattern for Prisma Client
// Currently creates new instance on every import
export const prisma = new PrismaClient()
```

**Problems**:
- ❌ No singleton pattern (critical for serverless/Next.js)
- ❌ No connection pooling configuration
- ❌ No error handling
- ❌ Missing development logging configuration

**Recommended Fix**:
```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### 3.2 Cloud Functions Database

**File**: `functions/src/lib/database.ts`

**Status**: ✅ Better implementation
- Singleton pattern implemented
- Proper cleanup with `closeDatabase()`
- Environment-based logging

### 3.3 Raw PostgreSQL Pool

**File**: `lib/gcp/gcp-sql.ts`

**Features**:
- Singleton pool pattern
- Unix socket support for Cloud SQL
- TCP fallback for local development
- Connection pooling (max 10 connections)
- Transaction support

**Status**: ✅ Well-implemented, but not currently used

---

## 4. Migration Management

### 4.1 Prisma Migrations

**Location**: `prisma/migrations/`

**Current State**:
- ✅ Initial migration: `20251129190254_init/`
- Creates all 13 models, enums, indexes, foreign keys
- Missing tenant isolation fields (`clinicId`)

**Issue**: Prisma schema includes `clinicId` but migration doesn't create it

### 4.2 Supabase Migrations

**Location**: `supabase/migrations/`

**Migrations**:
1. `001_user_roles.sql` - Creates `user_roles` table with RLS
2. `002_add_clinic_id.sql` - Adds `clinicId` to multiple tables

**Status**: ✅ Applied to Supabase database

### 4.3 Migration Sync Issue

**Problem**: Two separate migration systems
- Prisma manages main schema
- Supabase migrations add auth and tenant fields
- Risk of schema drift

**Recommendation**: 
- Consolidate to single source of truth
- Either use Prisma for all migrations OR Supabase for all migrations

---

## 5. Authentication Integration

### 5.1 Supabase Auth

**Configuration**: `lib/supabase/server.ts`, `lib/supabase/client.ts`

**Features**:
- Server-side client with cookie handling
- Client-side client for browser
- Integration with Next.js App Router

### 5.2 User Roles Table

**Schema**:
```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('doctor', 'patient', 'admin')),
  approved BOOLEAN DEFAULT false,
  clinic_id TEXT NOT NULL DEFAULT 'default-clinic',
  doctor_id TEXT,  -- References Prisma doctors.id
  patient_id TEXT,  -- References Prisma patients.id
  ...
)
```

**RLS Policies**:
- Users can view own role
- Service role full access

---

## 6. Security Considerations

### 6.1 Row Level Security (RLS)

**Status**: ✅ Enabled on `user_roles` table
**Missing**: ⚠️ RLS not configured on Prisma-managed tables

**Recommendation**: Add RLS policies to all Prisma tables for HIPAA compliance

### 6.2 Connection Security

**Cloud SQL**: Uses Unix sockets in production (secure)
**Local Dev**: TCP connections (appropriate for development)

### 6.3 Environment Variables

**Exposed in `env.example`**:
- ⚠️ Passwords visible in connection strings
- ⚠️ Service account key (base64 encoded)
- ✅ Uses environment variable substitution where possible

---

## 7. Firestore Integration

**Status**: 🔴 Not Implemented

**Files**: 
- `db/firestore.ts` - Empty stub
- `lib/firestore/client.ts` - Has implementation

**Planned Use**: Real-time chat functionality

**Recommendation**: Decide if needed or remove unused code

---

## 8. Critical Issues & Recommendations

### 🚨 High Priority Issues

1. **Prisma Client Singleton Missing**
   - **Impact**: Connection exhaustion in serverless environment
   - **Fix**: Implement singleton pattern in `db/prisma.ts`
   - **Priority**: Critical

2. **Schema Drift Between Prisma and Supabase**
   - **Impact**: Data inconsistency, migration conflicts
   - **Fix**: Consolidate migrations or sync schema
   - **Priority**: High

3. **Missing RLS on Prisma Tables**
   - **Impact**: HIPAA compliance risk
   - **Fix**: Add RLS policies to all tables
   - **Priority**: High

4. **Tenant Isolation Incomplete**
   - **Impact**: Data leakage between clinics
   - **Fix**: Ensure all queries filter by `clinicId`
   - **Priority**: High

### ⚠️ Medium Priority Issues

5. **Connection Pool Configuration**
   - Prisma Client missing connection pool settings
   - Cloud SQL pool configured but not used

6. **Migration Scripts**
   - Multiple migration scripts for same purpose
   - Need clear documentation on which to use

7. **Environment Configuration**
   - Multiple database URLs (Supabase vs Cloud SQL)
   - Unclear which is active

### 💡 Recommendations

1. **Implement Prisma Singleton Pattern**
   ```typescript
   // db/prisma.ts
   const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
   
   export const prisma = globalForPrisma.prisma || new PrismaClient({
     log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
   })
   
   if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
   ```

2. **Add Connection Pool Configuration**
   ```typescript
   export const prisma = new PrismaClient({
     datasources: {
       db: {
         url: process.env.DATABASE_URL,
       },
     },
     log: [...],
   })
   ```

3. **Create Unified Migration Strategy**
   - Use Prisma migrations for schema changes
   - Use Supabase migrations only for auth/RLS setup
   - Document the split clearly

4. **Add RLS Policies**
   - Create migration to add RLS to all Prisma tables
   - Test policies thoroughly

5. **Remove Unused Code**
   - Firestore stub if not planning to use
   - Unused connection utilities

6. **Environment Configuration**
   - Single source of truth for database URL
   - Clear documentation on which DB is active

---

## 9. Database URLs & Connection Strings

### Current Configuration (env.example)

**Supabase**:
```
DATABASE_URL="postgresql://postgres:$DistanceDoc2423@db.vhwvejtjrajjsluutrqv.supabase.co:5432/postgres"
```

**Cloud SQL (Planned)**:
```
DATABASE_URL="postgresql://postgres:$Google2423@/distancedoc?host=/cloudsql/distancedoc:us-central1:distancedoc-db"
```

### Recommendation

**Single Active Database**: Choose one and remove the other
- **Option A**: Use Supabase (simpler, includes auth)
- **Option B**: Use Cloud SQL (more control, separate auth)

---

## 10. Summary

### Strengths ✅
- Comprehensive schema with 13 well-designed models
- Good use of indexes and relationships
- Tenant isolation concept implemented
- Multiple connection options available

### Weaknesses ⚠️
- Missing Prisma singleton pattern (critical)
- Schema drift between Prisma and Supabase migrations
- Missing RLS on Prisma tables
- Unclear which database is active
- Unused Firestore stub

### Next Steps
1. Fix Prisma Client singleton (critical)
2. Decide on single database strategy
3. Add RLS policies
4. Consolidate migrations
5. Remove unused code

---

## Appendix: File Locations

### Database Configuration Files
- `prisma/schema.prisma` - Main database schema
- `db/prisma.ts` - Prisma Client (needs singleton)
- `db/firestore.ts` - Firestore stub
- `lib/gcp/gcp-sql.ts` - Raw PostgreSQL pool
- `functions/src/lib/database.ts` - Cloud Functions Prisma

### Migration Files
- `prisma/migrations/20251129190254_init/` - Initial Prisma migration
- `supabase/migrations/001_user_roles.sql` - Auth setup
- `supabase/migrations/002_add_clinic_id.sql` - Tenant isolation

### Documentation
- `docs/PRISMA-SCHEMA.md` - Schema documentation
- `db/README.md` - Database directory README

