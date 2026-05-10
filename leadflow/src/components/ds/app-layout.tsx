import * as React from "react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AppLayout({ sidebar, children, className }: AppLayoutProps) {
  return (
    <div className={cn("flex h-screen w-full overflow-hidden bg-background", className)}>
      {sidebar}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, tabs, className }: PageHeaderProps) {
  return (
    <header className={cn("shrink-0 border-b border-border bg-surface", className)}>
      <div className="flex items-center justify-between px-4 h-[44px]">
        <div className="flex items-center gap-2 min-w-0">
          {typeof title === "string" ? (
            <h1 className="text-[14px] font-semibold text-foreground truncate">{title}</h1>
          ) : title}
          {description && (
            <span className="text-[12px] text-foreground-muted truncate">{description}</span>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-1.5 shrink-0 ml-4">{actions}</div>
        )}
      </div>
      {tabs && <div>{tabs}</div>}
    </header>
  );
}

interface PageContentProps {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}

export function PageContent({ children, className, padded = false }: PageContentProps) {
  return (
    <main className={cn("flex-1 overflow-auto", padded && "p-4", className)}>
      {children}
    </main>
  );
}
