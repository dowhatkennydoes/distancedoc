"use client"

import { PatientPortalLayout } from "@/components/layouts/PatientPortalLayout"

export default function PatientPortalLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return <PatientPortalLayout>{children}</PatientPortalLayout>
}

