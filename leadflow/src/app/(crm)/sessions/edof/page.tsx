import Link from "next/link";
import { getSessionsEdof } from "@/lib/db/sessions";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { Badge } from "@/components/ui/badge";
import { formatDate, SESSION_EDOF_STATUT_LABELS, SESSION_EDOF_STATUT_VARIANT } from "@/lib/format";
import { Users } from "lucide-react";
import { CreateSessionEdofDialog } from "./create-dialog";

export default async function SessionsEdofPage() {
  const user = await getCurrentUser();
  const sessions = await getSessionsEdof();
  const canCreate = ['gestionnaire', 'admin', 'super_admin'].includes(user.role);

  return (
    <>
      <PageHeader
        title="Sessions EDOF / CPF"
        description={`${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
        actions={canCreate ? <CreateSessionEdofDialog /> : undefined}
      />
      <PageContent>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Référence EDOF</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Dates session</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Date fin CPF</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Capacité</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Statut</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-2">
                    <Link href={`/sessions/edof/${s.id}/apprenants`} className="font-medium text-foreground hover:text-accent font-mono">
                      {s.reference_edof ?? <span className="text-foreground-subtle italic">—</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-foreground-muted tabular-nums">
                    {formatDate(s.date_debut)} → {formatDate(s.date_fin)}
                  </td>
                  <td className="px-4 py-2 text-foreground-muted tabular-nums">
                    {s.date_fin_cpf ? formatDate(s.date_fin_cpf) : <span className="text-foreground-subtle">—</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-1 text-foreground-muted">
                      <Users className="h-3 w-3 shrink-0" />
                      {s.nb_affectations} / {s.capacite_max}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={SESSION_EDOF_STATUT_VARIANT[s.statut] as Parameters<typeof Badge>[0]['variant']}>
                      {SESSION_EDOF_STATUT_LABELS[s.statut]}
                    </Badge>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-foreground-muted">Aucune session EDOF</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PageContent>
    </>
  );
}
