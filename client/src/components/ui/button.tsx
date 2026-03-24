import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md shadow-teal-500/20 hover:from-teal-600 hover:to-emerald-600 hover:shadow-lg hover:shadow-teal-500/30",
        destructive:
          "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/20 hover:from-rose-600 hover:to-pink-600",
        outline:
          "border border-slate-200/80 bg-white/80 backdrop-blur-sm hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300",
        secondary:
          "bg-slate-100 text-slate-700 hover:bg-slate-200",
        ghost: "hover:bg-slate-100/80 hover:text-slate-900",
        link: "text-teal-500 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-xl px-3.5",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
