"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  badge,
  actions,
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("w-full", className)}>
      <div className="flex items-center justify-between group">
        <CollapsibleTrigger className="flex items-center gap-1.5 py-1.5 px-1 rounded-[4px] hover:bg-surface-hover transition-colors flex-1 min-w-0 cursor-pointer">
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-foreground-subtle shrink-0 transition-transform duration-150",
              open && "rotate-90"
            )}
          />
          <span className="text-[12px] font-semibold text-foreground-muted uppercase tracking-wider truncate">
            {title}
          </span>
          {badge && <span className="ml-1 text-foreground-subtle">{badge}</span>}
        </CollapsibleTrigger>
        {actions && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pr-1">
            {actions}
          </div>
        )}
      </div>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
