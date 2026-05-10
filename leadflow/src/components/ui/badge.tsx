import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 px-1.5 py-0 text-[11px] font-medium leading-[18px] rounded-full border border-transparent select-none",
  {
    variants: {
      variant: {
        default: "bg-status-gray-bg text-status-gray",
        gray: "bg-status-gray-bg text-status-gray",
        blue: "bg-status-blue-bg text-status-blue",
        orange: "bg-status-orange-bg text-status-orange",
        green: "bg-status-green-bg text-status-green",
        red: "bg-status-red-bg text-status-red",
        violet: "bg-status-violet-bg text-status-violet",
        outline: "border-border bg-transparent text-foreground-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
