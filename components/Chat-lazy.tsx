/**
 * Lazy-loaded Chat Component
 * 
 * Dynamically imports the Chat component to reduce initial bundle size
 */

'use client'

import dynamic from 'next/dynamic'
import { Card, CardContent } from './ui/card'
import { Skeleton } from './ui/skeleton'

// Lazy load chat component with loading fallback
export const Chat = dynamic(
  () => import('./Chat').then((mod) => ({ default: mod.Chat })),
  {
    loading: () => (
      <Card className="h-full flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ))}
        </CardContent>
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
      </Card>
    ),
    ssr: false, // Chat is client-only
  }
)

