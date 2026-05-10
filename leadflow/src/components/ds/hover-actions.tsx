import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

export interface HoverAction {
  id: string;
  icon: LucideIcon;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant?: "default" | "destructive";
}

interface HoverActionsProps {
  actions: HoverAction[];
  className?: string;
}

export function HoverActions({ actions, className }: HoverActionsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            variant="ghost"
            size="icon-sm"
            title={action.label}
            aria-label={action.label}
            onClick={action.onClick}
            className={cn(
              action.variant === "destructive" && "hover:text-destructive hover:bg-status-red-bg"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        );
      })}
    </div>
  );
}
