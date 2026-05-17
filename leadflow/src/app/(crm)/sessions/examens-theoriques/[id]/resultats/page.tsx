import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionExamenTheoriqueById } from "@/lib/db/sessions";
import { getAffectationsSessionWithTentative } from "@/lib/db/tentatives";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { Badge } from "@/components/ui/badge";
import {
  formatDate,
  SESSION_STATUT_LABELS, SESSION_STATUT_VARIANT,
  FORMATION_TYPE_LABELS, DOSSIER_STATUT_LABELS, DOSSIER_STATUT_VARIANT,
  SESSION_STATUT_LABELS_EXAMEN, SESSION_STATUT_VARIANT_EXAMEN,
} from "@/lib/format";
import { ChevronLeft, MapPin, Users } from "lucide-react";
import { ResultatsTheoriqueClient } from "./resultats-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SessionExamenTheoriqueResultatsPage({ params }: Props) {
  const { id } = await params;
  const [session, affectations, user] = await Promise.all([
    getSessionExamenTheoriqueById(id),
    getAffectationsSessionWithTentative('theorique', id),
    getCurrentUser(),
  ]);

  if (!session) notFound();

  const canSaisir = ['admin', 'super_admin'].includes(user.role);
  const isSuperAdmin = user.role === 'super_admin';

  const sessionStatutLabel = SESSION_STATUT_LABELS_EXAMEN[session.statut] ?? SESSION_STATUT_LABELS[session.statut] ?? session.statut;
  const sessionStatutVariant = SESSION_STATUT_VARIANT_EXAMEN[session.statut] ?? SESSION_STATUT_VARIANT[session.statut] ?? 'gray';

  const nbResultats = affectations.filter((a) => a.resultat_detail_resultat !== null).length;
  const totalCandidats = affectations.length;

  return (
    <>
      <PageHeader
        title={
          <div className="flex items-center gap-2 min-w-0">
            <Link href={`/sessions/examens-theoriques/${id}/apprenants`} className="text-foreground-muted hover:text-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="text-[14px] font-semibold text-foreground">Résultats — Examen théorique {formatDate(session.date_examen)}</span>
            <Badge variant={sessionStatutVariant as Parameters<typeof Badge>[0]['variant']}>
              {sessionStatutLabel}
            </Badge>
          </div>
        }
        description={
          <span className="flex items-center gap-3 text-[12px] text-foreground-muted">
            {session.lieu && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{session.lieu}</span>}
            {session.organisme && <span>{session.organisme}</span>}
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{totalCandidats} candidat(s)</span>
            <span className="font-medium text-foreground">{nbResultats}/{totalCandidats} résultats saisis</span>
          </span>
        }
      />
      <PageContent>
        {session.statut === 'annule' && (
          <div className="mx-4 mb-4 rounded-[6px] border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-[12px] px-3 py-2">
            Session annulée — saisie désactivée
          </div>
        )}
        <ResultatsTheoriqueClient
          sessionId={id}
          affectations={affectations}
          canSaisir={canSaisir && session.statut !== 'annule'}
          isSuperAdmin={isSuperAdmin}
          sessionClosed={session.statut === 'resultats_saisis'}
        />
      </PageContent>
    </>
  );
}
