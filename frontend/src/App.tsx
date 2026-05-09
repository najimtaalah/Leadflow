import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { LoginPage } from "@/pages/Login";
import { DashboardPage } from "@/pages/Dashboard";
import { AppLayout } from "@/components/ds/AppLayout";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  Calendar,
  FileText,
  Settings,
} from "lucide-react";
import { ToastProvider, ToastViewport } from "@/components/ui/toast";

const NAV_SECTIONS = [
  {
    items: [
      { id: "dashboard", label: "Tableau de bord", href: "/", icon: LayoutDashboard },
      { id: "leads", label: "Leads", href: "/leads", icon: Users },
      { id: "dossiers", label: "Dossiers", href: "/dossiers", icon: FolderOpen },
      { id: "sessions", label: "Sessions", href: "/sessions", icon: Calendar },
      { id: "documents", label: "Documents", href: "/documents", icon: FileText },
    ],
  },
  {
    title: "Administration",
    items: [
      { id: "settings", label: "Paramètres", href: "/settings", icon: Settings },
    ],
  },
];

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <AppLayout
      sidebarSections={NAV_SECTIONS}
      sidebarLogo={
        <span className="text-[14px] font-bold text-foreground tracking-tight">LeadFlow+</span>
      }
    >
      {children}
    </AppLayout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedLayout>
              <DashboardPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedLayout>
              <div className="p-6 text-foreground-muted text-[13px]">
                Page en construction — Lot 0 socle uniquement.
              </div>
            </ProtectedLayout>
          }
        />
      </Routes>
      <ToastViewport />
    </ToastProvider>
  );
}
