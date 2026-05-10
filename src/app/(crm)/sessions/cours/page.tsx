import Link from "next/link";
import { getSessionsCours } from "@/lib/db/sessions";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, SESSION_STATUT_LABELS, SESSION_STATUT_VARIANT, TYPE_PRESENCE_LABELS } from "@/lib/format";
import { Users, MapPin } from "lucide-react";
import { CreateSessionCoursDialog } from "./create-dialog";

export default async function SessionsCoursPage() {
  const user = await getCurrentUser();
  const sessions = await getSessionsCours();
  const canCreate = ['gestionnaire', 'admin', 'super_admin'].includes(user.role);

  return (
    <>
      <PageHeader
        title="Sessions de formation"
        description={`${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
        actions={canCreate ? <CreateSessionCoursDialog /> : undefined}
      />
      <PageContent>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Titre</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Dates</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Modalité</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Lieu / Formateur</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Capacité</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Statut</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-2">
                    <Link href={`/sessions/cours/${s.id}/apprenants`} className="font-medium text-foreground hover:text-accent">
                      {s.titre}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-foreground-muted tabular-nums">
                    {formatDate(s.date_debut)} → {formatDate(s.date_fin)}
                  </td>
                  <td className="px-4 py-2 text-foreground-muted">
                    {TYPE_PRESENCE_LABELS[s.type_presence]}
                  </td>
                  <td className="px-4 py-2 text-foreground-muted">
                    {s.lieu && <span className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{s.lieu}</span>}
                    {s.formateur && <span className="text-foreground-subtle">{s.formateur}</span>}
                    {!s.lieu && !s.formateur && <span className="text-foreground-subtle">—</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-1 text-foreground-muted">
                      <Users className="h-3 w-3 shrink-0" />
                      {s.nb_affectations} / {s.capacite_max}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={SESSION_STATUT_VARIANT[s.statut] as Parameters<typeof Badge>[0]['variant']}>
                      {SESSION_STATUT_LABELS[s.statut]}
                    </Badge>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-foreground-muted">Aucune session de formation</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PageContent>
    </>
  );
}
