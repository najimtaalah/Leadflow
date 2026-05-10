"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, canValidateBlocAdmin, canValidateBlocFinancier, canActivateApprenant } from "@/lib/auth";
import { updateBlocStatut, activerApprenant } from "@/lib/db/dossiers";
import type { BlocStatut } from "@/lib/db/types";

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
