"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, canValidateBlocAdmin, canValidateBlocFinancier, canActivateApprenant } from "@/lib/auth";
import { updateBlocStatut, activerApprenant } from "@/lib/db/dossiers";
import { creerNouvelletentative } from "@/lib/db/tentatives";
import { genererDocument, signerDocument } from "@/lib/db/documents";
import { prisma } from "@/lib/db/prisma";
import type { BlocStatut, TypeDocument } from "@/lib/db/types";

export async function actionUpdateBlocStatut(
  dossierId: string,
  bloc: 'admin' | 'financier',
  action: 'soumettre' | 'valider' | 'rejeter',
  motif?: string
) {
  const user = await getCurrentUser();

  if (action === 'valider' || action === 'rejeter') {
    if (bloc === 'admin' && !canValidateBlocAdmin(user)) throw new Error('Non autorisé');
    if (bloc === 'financier' && !canValidateBlocFinancier(user)) throw new Error('Non autorisé');
    if (action === 'rejeter' && (!motif || motif.length < 20)) throw new Error('Le motif doit contenir au moins 20 caractères');
  }

  const STATUT_MAP: Record<string, BlocStatut> = {
    soumettre: 'soumis',
    valider: 'valide',
    rejeter: 'rejete',
  };

  await updateBlocStatut(dossierId, bloc, STATUT_MAP[action], user.id, motif);
  revalidatePath(`/dossiers/${dossierId}`);
  revalidatePath('/dossiers');
}

export async function actionActiverApprenant(dossierId: string) {
  const user = await getCurrentUser();
  if (!canActivateApprenant(user)) throw new Error('Seul un Admin peut activer un apprenant');
  await activerApprenant(dossierId, user.id);
  revalidatePath(`/dossiers/${dossierId}`);
  revalidatePath('/dossiers');
  revalidatePath('/leads');
  revalidatePath('/apprenants');
}

export async function actionCreerNouvelleTentative(dossierId: string) {
  const user = await getCurrentUser();
  if (!['gestionnaire', 'admin', 'super_admin'].includes(user.role)) {
    throw new Error('Non autorisé');
  }
  await creerNouvelletentative(dossierId, user.id);
  revalidatePath(`/dossiers/${dossierId}`);
}

// ─── Lot 6 — Documents ────────────────────────────────────────────────────────

export async function actionGenererDocument(dossierId: string, typeDocument: TypeDocument) {
  const user = await getCurrentUser();
  if (!['gestionnaire', 'admin', 'super_admin'].includes(user.role)) {
    throw new Error('Non autorisé');
  }
  await genererDocument(dossierId, typeDocument, user.id);
  revalidatePath(`/dossiers/${dossierId}`);
}

export async function actionSignerDocument(dossierId: string, typeDocument: TypeDocument) {
  const user = await getCurrentUser();
  if (!['gestionnaire', 'admin', 'super_admin'].includes(user.role)) {
    throw new Error('Non autorisé');
  }
  await signerDocument(dossierId, typeDocument, user.id);
  revalidatePath(`/dossiers/${dossierId}`);
}

export async function actionUpdateDossierConformite(
  dossierId: string,
  objectif_formation: string,
  evaluation_pre_formation: string,
) {
  const user = await getCurrentUser();
  if (!['gestionnaire', 'admin', 'super_admin'].includes(user.role)) {
    throw new Error('Non autorisé');
  }
  await prisma.dossier.update({
    where: { id: dossierId },
    data: {
      objectif_formation: objectif_formation || null,
      evaluation_pre_formation: evaluation_pre_formation || null,
      evaluation_pre_formation_at: evaluation_pre_formation ? new Date() : undefined,
    },
  });
  await prisma.auditLog.create({
    data: {
      id: crypto.randomUUID(),
      dossier_id: dossierId,
      type_action: 'modification_champ',
      detail: 'Objectif de formation et évaluation pré-formation mis à jour',
      auteur_id: user.id,
    },
  });
  revalidatePath(`/dossiers/${dossierId}`);
}
