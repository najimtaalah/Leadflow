import { notFound } from "next/navigation";
import Link from "next/link";
import { getDossierById, getPiecesJustificatives, getAuditLog, computeQualiopiCriteres } from "@/lib/db/dossiers";
import { getTentativesByDossier } from "@/lib/db/tentatives";
import { computeDocumentsList } from "@/lib/db/documents";
import { computeQualiopiConformite } from "@/lib/db/qualiopi";
import { getCurrentUser, getAllUsers, canValidateBlocAdmin, canValidateBlocFinancier, canSaisieBlocFinancier, canActivateApprenant, canViewAllLeads } from "@/lib/auth";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { Badge } from "@/components/ui/badge";
import { DossierDetailClient } from "./dossier-detail-client";
import {
  DOSSIER_STATUT_LABELS, DOSSIER_STATUT_VARIANT,
  FORMATION_TYPE_LABELS
} from "@/lib/format";

interface Props { params: Promise<{ id: string }> }

export default async function DossierPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  const dossier = await getDossierById(id);
  if (!dossier) notFound();

  const [pieces, auditLog, qualiopi, allUsers, tentatives, documentsList, qualiopiConformite] = await Promise.all([
    getPiecesJustificatives(id),
    getAuditLog(id),
    computeQualiopiCriteres(id),
    getAllUsers(),
    getTentativesByDossier(id),
    computeDocumentsList(id),
    computeQualiopiConformite(id),
  ]);

  const permissions = {
    canValidateBlocAdmin: canValidateBlocAdmin(user),
    canValidateBlocFinancier: canValidateBlocFinancier(user),
    canSaisieBlocFinancier: canSaisieBlocFinancier(user),
    canActivateApprenant: canActivateApprenant(user) && dossier.statut_bloc_admin === 'valide' && dossier.statut_bloc_financier === 'valide',
    canViewAll: canViewAllLeads(user),
  };

  return (
    <>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <Link href="/dossiers" className="text-foreground-muted hover:text-foreground text-[13px]">Dossiers</Link>
            <span className="text-foreground-subtle">/</span>
            <span>{dossier.apprenant_prenom} {dossier.apprenant_nom}</span>
            <Badge variant={DOSSIER_STATUT_VARIANT[dossier.statut] as Parameters<typeof Badge>[0]['variant']}>
              {DOSSIER_STATUT_LABELS[dossier.statut]}
            </Badge>
            <span className="text-[12px] text-foreground-muted">{FORMATION_TYPE_LABELS[dossier.formation_type]}</span>
          </div>
        }
      />
      <PageContent className="overflow-hidden flex flex-col">
        <DossierDetailClient
          dossier={dossier}
          pieces={pieces}
          auditLog={auditLog}
          qualiopi={qualiopi}
          tentatives={tentatives}
          documentsList={documentsList}
          qualiopiConformite={qualiopiConformite}
          currentUser={user}
          allUsers={allUsers}
          permissions={permissions}
        />
      </PageContent>
    </>
  );
}
