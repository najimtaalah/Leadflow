import * as React from "react";
import { Sidebar, type SidebarSection } from "./Sidebar";

interface AppLayoutProps {
  sidebarSections: SidebarSection[];
  sidebarLogo?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  children: React.ReactNode;
}

export function AppLayout({
  sidebarSections,
  sidebarLogo,
  sidebarFooter,
  children,
}: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        sections={sidebarSections}
        logo={sidebarLogo}
        footer={sidebarFooter}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
