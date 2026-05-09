import * as React from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface SidebarNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  count?: number;
}

export interface SidebarSection {
  title?: string;
  items: SidebarNavItem[];
}

interface SidebarProps {
  sections: SidebarSection[];
  collapsed?: boolean;
  logo?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Sidebar({ sections, collapsed = false, logo, footer }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar-bg border-r border-sidebar-border shrink-0 transition-all duration-200",
        collapsed ? "w-[48px]" : "w-[200px]",
      )}
    >
      {logo && (
        <div
          className={cn(
            "flex items-center h-[44px] px-3 border-b border-sidebar-border shrink-0",
            collapsed && "justify-center",
          )}
        >
          {logo}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-1">
        {sections.map((section, i) => (
          <div key={i} className="mb-1">
            {section.title && !collapsed && (
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.id}
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-2 mx-1 px-2 h-[30px] rounded-[5px] text-[13px] transition-colors",
                      isActive
                        ? "bg-sidebar-item-active text-foreground font-medium"
                        : "text-foreground-muted hover:bg-sidebar-item-hover hover:text-foreground",
                      collapsed && "justify-center px-0 w-[36px]",
                    )
                  }
                  title={collapsed ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn(
                          "shrink-0 transition-colors",
                          collapsed ? "h-[15px] w-[15px]" : "h-[14px] w-[14px]",
                          isActive ? "text-foreground" : "text-sidebar-icon group-hover:text-foreground",
                        )}
                      />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.count !== undefined && (
                            <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-muted text-foreground-muted text-[11px] font-medium tabular-nums flex items-center justify-center">
                              {item.count}
                            </span>
                          )}
                        </>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {footer && (
        <div className="shrink-0 border-t border-sidebar-border p-2">{footer}</div>
      )}
    </aside>
  );
}
