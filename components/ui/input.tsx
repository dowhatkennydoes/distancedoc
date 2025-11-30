import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  helperText?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, helperText, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
    const inputId = props.id || React.useId()
    const helperTextId = helperText ? `${inputId}-helper` : undefined
    const errorId = error ? `${inputId}-error` : undefined
    const describedBy = [ariaDescribedBy, helperTextId, errorId].filter(Boolean).join(" ") || undefined

    return (
      <div className="w-full">
        <input
          type={type}
          id={inputId}
          className={cn(
            "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "aria-invalid:border-destructive aria-invalid:ring-destructive",
            // Mobile: ensure minimum touch target size (44x44px)
            "min-h-[44px] sm:min-h-[40px]",
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
Input.displayName = "Input"

export { Input }

