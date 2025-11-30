# DistanceDoc UI System

A comprehensive global frontend UI system built with Next.js 15, Shadcn UI, and TailwindCSS.

## Features

### Theme
- **Medical Theme**: Clean whites, soft blues, and subtle gradients
- Custom color palette optimized for healthcare applications
- Responsive design with mobile-first approach
- Typography system with consistent heading styles

### Layout Components

#### `<AppLayout />`
Basic layout for public pages with navbar and breadcrumbs.

```tsx
import { AppLayout } from "@/components/layouts"

<AppLayout breadcrumbs={[{ label: "Home" }, { label: "About" }]}>
  {children}
</AppLayout>
```

#### `<DashboardLayout />`
Full dashboard layout with navbar, sidebar, and breadcrumbs for authenticated users.

```tsx
import { DashboardLayout } from "@/components/layouts"

<DashboardLayout>
  {children}
</DashboardLayout>
```

#### `<PatientLayout />`
Patient portal layout with patient-specific navigation.

```tsx
import { PatientLayout } from "@/components/layouts"

<PatientLayout>
  {children}
</PatientLayout>
```

### Navigation Components

#### `<Navbar />`
Responsive navbar with user menu, authentication state, and mobile menu toggle.

#### `<Sidebar />`
Collapsible sidebar with role-based navigation (doctor/patient/admin).

#### `<Breadcrumbs />`
Automatic breadcrumb navigation based on current route.

### UI Components

All Shadcn UI components are available in `components/ui/`:
- Button (with variants and sizes)
- Card
- Input
- Toast (with useToast hook)
- Skeleton
- Avatar
- Breadcrumb
- Dropdown Menu
- Separator

### Loading Skeletons

Pre-built skeleton components for common UI patterns:
- `<PageSkeleton />` - Full page loading state
- `<TableSkeleton />` - Table loading state
- `<CardSkeleton />` - Card loading state
- `<FormSkeleton />` - Form loading state
- `<DashboardSkeleton />` - Dashboard loading state

### Auth Guards

#### `<AuthGuard />`
Protects routes requiring authentication and optional role/approval checks.

```tsx
import { AuthGuard } from "@/components/auth"

<AuthGuard requiredRole="doctor" requireApproval>
  {children}
</AuthGuard>
```

#### `<PublicOnly />`
Ensures routes are only accessible to unauthenticated users.

```tsx
import { PublicOnly } from "@/components/auth"

<PublicOnly>
  {children}
</PublicOnly>
```

### Toast Notifications

Use the `useToast` hook to show notifications:

```tsx
import { useToast } from "@/components/ui/use-toast"

const { toast } = useToast()

toast({
  title: "Success",
  description: "Operation completed successfully",
  variant: "success", // or "default", "destructive", "warning"
})
```

## Usage Examples

### Protected Dashboard Page

```tsx
"use client"

import { DashboardLayout } from "@/components/layouts"
import { AuthGuard } from "@/components/auth"

export default function DashboardPage() {
  return (
    <AuthGuard requiredRole="doctor">
      <DashboardLayout>
        <h1>Dashboard</h1>
      </DashboardLayout>
    </AuthGuard>
  )
}
```

### Public Landing Page

```tsx
"use client"

import { AppLayout } from "@/components/layouts"
import { PublicOnly } from "@/components/auth"

export default function LandingPage() {
  return (
    <PublicOnly>
      <AppLayout>
        <h1>Welcome to DistanceDoc</h1>
      </AppLayout>
    </PublicOnly>
  )
}
```

## Styling

The medical theme is defined in `app/globals.css` with:
- Primary blue: `hsl(210 100% 50%)`
- Soft backgrounds with subtle gradients
- Medical-friendly color palette
- Responsive container utilities

Use the `container-responsive` class for responsive containers:

```tsx
<div className="container-responsive">
  {/* Content */}
</div>
```

## Dependencies

All required dependencies have been installed:
- @radix-ui/react-* (UI primitives)
- lucide-react (Icons)
- class-variance-authority (Component variants)
- tailwindcss-animate (Animations)

