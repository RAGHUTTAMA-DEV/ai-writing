import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95",
  {
    variants: {
      variant: {
        default:
          "bg-primary-solid text-primary-foreground shadow-soft hover:bg-primary-hover hover:shadow-medium transform hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/90 hover:shadow-medium focus-visible:ring-destructive/20 transform hover:-translate-y-0.5",
        outline:
          "border border-border bg-background shadow-soft hover:bg-muted/80 hover:shadow-medium transform hover:-translate-y-0.5",
        secondary:
          "bg-secondary text-secondary-foreground shadow-soft hover:bg-secondary-hover hover:shadow-medium transform hover:-translate-y-0.5",
        ghost:
          "hover:bg-muted/80 hover:text-foreground transition-colors",
        link: 
          "text-primary-solid underline-offset-4 hover:underline hover:text-primary-hover transition-colors",
        gradient:
          "gradient-primary text-white shadow-medium hover:shadow-strong transform hover:-translate-y-0.5 hover:scale-105",
        success:
          "bg-success text-success-foreground shadow-soft hover:bg-success/90 hover:shadow-medium transform hover:-translate-y-0.5",
        warning:
          "bg-warning text-warning-foreground shadow-soft hover:bg-warning/90 hover:shadow-medium transform hover:-translate-y-0.5",
      },
      size: {
        xs: "h-7 px-2 text-xs rounded-md gap-1",
        sm: "h-8 px-3 text-xs rounded-md gap-1.5",
        default: "h-10 px-4 py-2",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-8 text-lg",
        icon: "size-9 p-0",
        'icon-sm': "size-8 p-0",
        'icon-lg': "size-12 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
