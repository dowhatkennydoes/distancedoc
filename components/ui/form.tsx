"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function FormField({ label, error, required, children, className }: FormFieldProps) {
  const childId = React.isValidElement(children) && children.props.id ? children.props.id : undefined
  const errorId = error ? `${childId || 'field'}-error` : undefined
  
  return (
    <div className={cn("space-y-1.5 sm:space-y-2", className)}>
      <Label 
        htmlFor={childId}
        className={cn(error && "text-destructive")}
      >
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-label="required">
            *
          </span>
        )}
      </Label>
      {React.isValidElement(children) 
        ? React.cloneElement(children as React.ReactElement<any>, {
            'aria-invalid': error ? true : undefined,
            'aria-describedby': errorId,
            error: error ? true : undefined,
          })
        : children
      }
      {error && (
        <p 
          id={errorId}
          className="text-xs sm:text-sm text-destructive flex items-center gap-1.5" 
          role="alert"
        >
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

interface FormErrorProps {
  message?: string
  className?: string
}

export function FormError({ message, className }: FormErrorProps) {
  if (!message) return null
  return (
    <div 
      className={cn("rounded-md bg-destructive/10 border border-destructive/20 p-3 sm:p-4", className)}
      role="alert"
      aria-live="polite"
    >
      <p className="text-sm text-destructive flex items-start gap-2">
        <span aria-hidden="true" className="mt-0.5">⚠</span>
        <span>{message}</span>
      </p>
    </div>
  )
}

