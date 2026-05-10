import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-0.5">
        <input
          type={type}
          className={cn(
            "h-[30px] w-full rounded-[5px] border bg-surface px-2.5 text-[13px] text-foreground placeholder:text-foreground-subtle",
            "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            error ? "border-destructive" : "border-border hover:border-border-strong",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-[11px] text-destructive">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
