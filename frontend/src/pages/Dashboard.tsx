import { useAuthStore } from "@/stores/auth.store";
import { Badge } from "@/components/ui/badge";

const ROLE_LABELS: Record<string, string> = {
  COMMERCIAL: "Commercial",
  CLOSER: "Closer",
  GESTIONNAIRE: "Gestionnaire",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-[18px] font-semibold text-foreground">Tableau de bord</h1>
        <p className="text-[13px] text-foreground-muted mt-0.5">
          Bienvenue, {user?.firstName} {user?.lastName}
          <Badge variant="blue" className="ml-2">
            {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
          </Badge>
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Leads", count: 0, variant: "blue" as const },
          { label: "Dossiers en cours", count: 0, variant: "orange" as const },
          { label: "Sessions planifiées", count: 0, variant: "green" as const },
          { label: "Examens à venir", count: 0, variant: "gray" as const },
        ].map((card) => (
          <div key={card.label} className="bg-background border border-border rounded-lg p-4">
            <p className="text-[12px] text-foreground-muted">{card.label}</p>
            <p className="text-[28px] font-bold text-foreground mt-1">{card.count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
