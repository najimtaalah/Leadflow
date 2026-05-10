"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors cursor-pointer select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-accent-foreground hover:bg-accent-hover",
        secondary:
          "bg-surface-hover text-foreground border border-border hover:bg-surface-active",
        ghost:
          "text-foreground hover:bg-surface-hover",
        destructive:
          "bg-destructive text-destructive-foreground hover:opacity-90",
        link:
          "text-accent underline-offset-4 hover:underline",
        outline:
          "border border-border bg-surface text-foreground hover:bg-surface-hover",
      },
      size: {
        xs: "h-[22px] px-2 text-[11px] rounded-[3px]",
        sm: "h-[26px] px-2.5 text-[12px] rounded-[4px]",
        default: "h-[30px] px-3 text-[13px] rounded-[5px]",
        md: "h-[32px] px-3.5 text-[13px] rounded-[5px]",
        icon: "h-[28px] w-[28px] rounded-[5px]",
        "icon-sm": "h-[24px] w-[24px] rounded-[4px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
