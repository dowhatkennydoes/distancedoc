/**
 * Lightweight Date Utilities
 * 
 * Replaces heavy date-fns imports with minimal, tree-shakeable functions
 * Only includes functions we actually use
 */

/**
 * Format date to string
 * Replaces date-fns format function
 */
export function formatDate(date: Date | string, formatStr: string = 'PP'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  
  if (isNaN(d.getTime())) {
    return ''
  }

  // Simple format implementation for common formats
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')

  return formatStr
    .replace('yyyy', String(year))
    .replace('MM', month)
    .replace('dd', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
    .replace('PP', `${month}/${day}/${year}`)
    .replace('P', `${month}/${day}/${year}`)
    .replace('p', `${hours}:${minutes}`)
}

/**
 * Parse ISO date string
 */
export function parseISO(isoString: string): Date {
  return new Date(isoString)
}

/**
 * Check if date is today
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date
  const today = new Date()
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date
  return d < new Date()
}

/**
 * Add days to date
 */
export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? parseISO(date) : date
  const result = new Date(d)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Get start of week
 */
export function startOfWeek(date: Date | string): Date {
  const d = typeof date === 'string' ? parseISO(date) : date
  const result = new Date(d)
  const day = result.getDay()
  const diff = result.getDate() - day
  result.setDate(diff)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Get end of week
 */
export function endOfWeek(date: Date | string): Date {
  const d = typeof date === 'string' ? parseISO(date) : date
  const result = startOfWeek(d)
  result.setDate(result.getDate() + 6)
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * Get start of month
 */
export function startOfMonth(date: Date | string): Date {
  const d = typeof date === 'string' ? parseISO(date) : date
  const result = new Date(d)
  result.setDate(1)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Get end of month
 */
export function endOfMonth(date: Date | string): Date {
  const d = typeof date === 'string' ? parseISO(date) : date
  const result = new Date(d)
  result.setMonth(result.getMonth() + 1)
  result.setDate(0)
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : date1
  const d2 = typeof date2 === 'string' ? parseISO(date2) : date2
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  )
}

