import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionCoursById, getAffectationsBySession } from "@/lib/db/sessions";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { Badge } from "@/components/ui/badge";
import {
  formatDate, SESSION_STATUT_LABELS, SESSION_STATUT_VARIANT,
  TYPE_PRESENCE_LABELS, FORMATION_TYPE_LABELS, DOSSIER_STATUT_LABELS, DOSSIER_STATUT_VARIANT,
} from "@/lib/format";
import { ChevronLeft, MapPin, Users } from "lucide-react";
import { AffecterDialog } from "./affecter-dialog";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SessionCoursApprenantsPage({ params }: Props) {
  const { id } = await params;
  const [session, affectations, user] = await Promise.all([
    getSessionCoursById(id),
    getAffectationsBySession('cours', id),
    getCurrentUser(),
  ]);

  if (!session) notFound();

  const canEdit = ['gestionnaire', 'admin', 'super_admin'].includes(user.role);
  const placesRestantes = session.capacite_max - session.nb_affectations;

  return (
    <>
      <PageHeader
        title={
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/sessions/cours" className="text-foreground-muted hover:text-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="text-[14px] font-semibold text-foreground truncate">{session.titre}</span>
            <Badge variant={SESSION_STATUT_VARIANT[session.statut] as Parameters<typeof Badge>[0]['variant']}>
              {SESSION_STATUT_LABELS[session.statut]}
            </Badge>
          </div>
        }
        description={
          <span className="flex items-center gap-3 text-[12px] text-foreground-muted">
            <span>{TYPE_PRESENCE_LABELS[session.type_presence]}</span>
            <span>{formatDate(session.date_debut)} → {formatDate(session.date_fin)}</span>
            {session.lieu && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{session.lieu}</span>}
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{affectations.length}/{session.capacite_max}</span>
          </span>
        }
        actions={canEdit && placesRestantes > 0 ? <AffecterDialog sessionType="cours" sessionId={id} /> : undefined}
      />
      <PageContent>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Apprenant</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Email</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Formation</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Statut dossier</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Affecté le</th>
              </tr>
            </thead>
            <tbody>
              {affectations.map((a) => (
                <tr key={a.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-2 font-medium text-foreground">
                    <Link href={`/dossiers/${a.dossier_id}`} className="hover:text-accent">
                      {a.apprenant_prenom} {a.apprenant_nom}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-foreground-muted">{a.apprenant_email}</td>
                  <td className="px-4 py-2 text-foreground-muted">{FORMATION_TYPE_LABELS[a.dossier_formation_type] ?? a.dossier_formation_type}</td>
                  <td className="px-4 py-2">
                    <Badge variant={DOSSIER_STATUT_VARIANT[a.dossier_statut] as Parameters<typeof Badge>[0]['variant']}>
                      {DOSSIER_STATUT_LABELS[a.dossier_statut]}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-foreground-muted tabular-nums">{formatDate(a.created_at)}</td>
                </tr>
              ))}
              {affectations.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-foreground-muted">Aucun apprenant affecté à cette session</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PageContent>
    </>
  );
}
