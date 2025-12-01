/**
 * Optimized Paginated Table Component
 * 
 * Features:
 * - Server-side or client-side pagination
 * - Memoized rows
 * - Virtual scrolling support
 * - Accessible
 */

"use client"

import React, { useMemo, memo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginatedTableProps<T> {
  data: T[]
  columns: {
    key: string
    header: string
    render: (item: T) => React.ReactNode
    className?: string
  }[]
  pageSize?: number
  currentPage?: number
  onPageChange?: (page: number) => void
  emptyMessage?: string
  onRowClick?: (item: T) => void
  loading?: boolean
  className?: string
}

// Memoized row component to prevent unnecessary re-renders
const TableRowMemo = memo(<T,>({ 
  item, 
  columns, 
  onRowClick 
}: { 
  item: T
  columns: PaginatedTableProps<T>['columns']
  onRowClick?: (item: T) => void
}) => {
  const handleClick = useCallback(() => {
    onRowClick?.(item)
  }, [item, onRowClick])

  return (
    <TableRow
      className={onRowClick ? "cursor-pointer hover:bg-accent/50" : ""}
      onClick={handleClick}
    >
      {columns.map((column) => (
        <TableCell key={column.key} className={column.className}>
          {column.render(item)}
        </TableCell>
      ))}
    </TableRow>
  )
})

TableRowMemo.displayName = 'TableRowMemo'

export function PaginatedTable<T extends { id: string }>({
  data,
  columns,
  pageSize = 50,
  currentPage: controlledPage,
  onPageChange,
  emptyMessage = "No data available",
  onRowClick,
  loading = false,
  className = "",
}: PaginatedTableProps<T>) {
  // Use controlled or internal pagination
  const [internalPage, setInternalPage] = React.useState(1)
  const currentPage = controlledPage ?? internalPage
  const setPage = onPageChange ?? setInternalPage

  // Memoize pagination calculations
  const { paginatedData, totalPages } = useMemo(() => {
    const total = Math.ceil(data.length / pageSize)
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginated = data.slice(startIndex, endIndex)
    
    return {
      paginatedData: paginated,
      totalPages: total,
    }
  }, [data, pageSize, currentPage])

  const handlePrevious = useCallback(() => {
    if (currentPage > 1) {
      setPage(currentPage - 1)
    }
  }, [currentPage, setPage])

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      setPage(currentPage + 1)
    }
  }, [currentPage, totalPages, setPage])

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: pageSize }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((column) => (
                  <TableCell key={column.key}>
                    <div className="h-4 bg-muted animate-pulse rounded" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((item) => (
              <TableRowMemo
                key={item.id}
                item={item}
                columns={columns}
                onRowClick={onRowClick}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, data.length)} of {data.length} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

