import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
  helperText?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, helperText, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
    const textareaId = props.id || React.useId()
    const helperTextId = helperText ? `${textareaId}-helper` : undefined
    const errorId = error ? `${textareaId}-error` : undefined
    const describedBy = [ariaDescribedBy, helperTextId, errorId].filter(Boolean).join(" ") || undefined

    return (
      <div className="w-full">
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground transition-colors resize-y",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "aria-invalid:border-destructive aria-invalid:ring-destructive",
            // Mobile: ensure minimum touch target size
            "min-h-[88px] sm:min-h-[80px]",
            // Error state
            error
              ? "border-destructive focus-visible:ring-destructive"
              : "border-input",
            className
          )}
          ref={ref}
          aria-invalid={error || ariaInvalid}
          aria-describedby={describedBy}
          {...props}
        />
        {helperText && !error && (
          <p id={helperTextId} className="mt-1.5 text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
        {error && (
          <p id={errorId} className="mt-1.5 text-xs text-destructive" role="alert">
            {helperText || "This field has an error"}
          </p>
        )}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }

