import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary-solid/20 selection:text-foreground flex h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium shadow-soft transition-all duration-200 outline-none",
        "focus:border-primary-solid focus:ring-2 focus:ring-primary-solid/20 focus:shadow-medium",
        "hover:border-border/80 hover:shadow-medium",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
