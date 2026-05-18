import { useAuthStore } from "@/stores/auth.store";
import { Badge } from "@/components/ui/badge";

const ROLE_LABELS: Record<string, string> = {
  COMMERCIAL: "Commercial",
  CLOSER: "Closer",
  GESTIONNAIRE: "Gestionnaire",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

const KPI_CARDS = [
  { label: "Leads", count: 0, accentClass: "border-l-status-blue" },
  { label: "Dossiers en cours", count: 0, accentClass: "border-l-status-orange" },
  { label: "Sessions planifiées", count: 0, accentClass: "border-l-status-green" },
  { label: "Examens à venir", count: 0, accentClass: "border-l-border" },
] as const;

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="p-6 bg-muted/30 min-h-full">
      <div className="mb-6">
        <h1 className="text-[20px] font-bold text-foreground tracking-tight">Tableau de bord</h1>
        <p className="text-[13px] text-foreground-muted mt-0.5">
          Bienvenue, {user?.firstName} {user?.lastName}
          <Badge variant="blue" className="ml-2">
            {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
          </Badge>
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {KPI_CARDS.map((card) => (
          <div
            key={card.label}
            className={`bg-background border border-border border-l-2 ${card.accentClass} rounded-[var(--radius)] p-4 shadow-sm`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">{card.label}</p>
            <p className="text-[32px] font-bold text-foreground mt-1 leading-none">{card.count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
