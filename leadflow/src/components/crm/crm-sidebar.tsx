"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Users, FolderOpen, Bell, DollarSign, BarChart2,
  GraduationCap, Zap, CalendarDays, ClipboardList, BookOpen, Car, ShieldCheck
} from "lucide-react";
import { Sidebar } from "@/components/ds/sidebar";
import type { SidebarSection } from "@/components/ds/sidebar";

interface CrmSidebarProps {
  relancesEnRetard: number;
  currentUserRole: string;
  currentUserName: string;
}

export function CrmSidebar({ relancesEnRetard, currentUserRole, currentUserName }: CrmSidebarProps) {
  const pathname = usePathname();

  const getActiveId = () => {
    if (pathname.startsWith('/leads')) return 'leads';
    if (pathname.startsWith('/apprenants')) return 'apprenants';
    if (pathname.startsWith('/dossiers')) return 'dossiers';
    if (pathname.startsWith('/relances')) return 'relances';
    if (pathname.startsWith('/commissions')) return 'commissions';
    if (pathname.startsWith('/performance')) return 'performance';
    if (pathname.startsWith('/sessions/cours')) return 'sessions-cours';
    if (pathname.startsWith('/sessions/edof')) return 'sessions-edof';
    if (pathname.startsWith('/sessions/examens-theoriques')) return 'sessions-theoriques';
    if (pathname.startsWith('/sessions/examens-pratiques')) return 'sessions-pratiques';
    if (pathname.startsWith('/qualiopi/actions')) return 'qualiopi-actions';
    return '';
  };

  const sections: SidebarSection[] = [
    {
      title: 'CRM Commercial',
      items: [
        { id: 'leads', label: 'Leads', href: '/leads', icon: Users },
        { id: 'relances', label: 'Relances', href: '/relances', icon: Bell, count: relancesEnRetard > 0 ? relancesEnRetard : undefined, badge: relancesEnRetard > 0 ? '!' : undefined },
        { id: 'commissions', label: 'Commissions', href: '/commissions', icon: DollarSign },
        { id: 'performance', label: 'Performance', href: '/performance', icon: BarChart2 },
      ],
    },
    {
      title: 'Apprenants',
      items: [
        { id: 'apprenants', label: 'Apprenants', href: '/apprenants', icon: GraduationCap },
        { id: 'dossiers', label: 'Dossiers', href: '/dossiers', icon: FolderOpen },
      ],
    },
    {
      title: 'Sessions',
      items: [
        { id: 'sessions-cours', label: 'Formations', href: '/sessions/cours', icon: CalendarDays },
        { id: 'sessions-edof', label: 'EDOF / CPF', href: '/sessions/edof', icon: ClipboardList },
        { id: 'sessions-theoriques', label: 'Examens théoriques', href: '/sessions/examens-theoriques', icon: BookOpen },
        { id: 'sessions-pratiques', label: 'Examens pratiques', href: '/sessions/examens-pratiques', icon: Car },
      ],
    },
    {
      title: 'Qualiopi',
      items: [
        { id: 'qualiopi-actions', label: 'Actions', href: '/qualiopi/actions', icon: ShieldCheck },
      ],
    },
  ];

  return (
    <Sidebar
      sections={sections}
      activeId={getActiveId()}
      logo={
        <div className="flex items-center gap-2">
          <Zap className="h-[15px] w-[15px] text-accent shrink-0" />
          <span className="text-[13px] font-semibold text-foreground tracking-tight">LeadFlow</span>
        </div>
      }
      footer={
        <div className="flex items-center gap-2 px-1">
          <div className="w-[22px] h-[22px] rounded-full bg-accent-subtle flex items-center justify-center shrink-0">
            <span className="text-[10px] font-semibold text-accent">{currentUserName[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-foreground truncate">{currentUserName}</p>
            <p className="text-[10px] text-foreground-muted truncate">{currentUserRole.replace('_', ' ')}</p>
          </div>
          <a href="/login" className="text-[10px] text-foreground-subtle hover:text-foreground transition-colors shrink-0" title="Changer de compte">⇄</a>
        </div>
      }
    />
  );
}
