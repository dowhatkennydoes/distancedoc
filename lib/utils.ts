import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// TODO: Install clsx and tailwind-merge packages
// TODO: Add utility functions for date formatting
// TODO: Add utility functions for form validation
// TODO: Add utility functions for file size formatting
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

