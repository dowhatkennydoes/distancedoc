/**
 * Lazy-loaded Calendar Component
 * 
 * Dynamically imports the Calendar component to reduce initial bundle size
 */

'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from './skeleton'

// Lazy load calendar component with loading fallback
export const Calendar = dynamic(
  () => import('./calendar').then((mod) => ({ default: mod.Calendar })),
  {
    loading: () => (
      <div className="p-3 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-7" />
            <Skeleton className="h-7 w-7" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-9" />
          ))}
        </div>
      </div>
    ),
    ssr: false, // Calendar is client-only
  }
)

