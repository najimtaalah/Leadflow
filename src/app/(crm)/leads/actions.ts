"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, canModifyLead, canOpenPreDossier, canUnlockCommission } from "@/lib/auth";
import { updateLeadStatut, createRelance, markRelanceFaite, reprogramRelance, deleteRelance, upsertCommission, unlockCommission } from "@/lib/db/leads";
import { ouvrirPreDossier, type PreDossierInput } from "@/lib/db/dossiers";
import type { LeadStatut, RelanceType, FormationType, Formule } from "@/lib/db/types";

const VALID_TRANSITIONS: Record<LeadStatut, LeadStatut[]> = {
  nouveau: ['qualifie', 'perdu'],
  qualifie: ['en_cours', 'perdu'],
  en_cours: ['perdu'],
  gagne: [],
  perdu: [],
};

export async function actionChangerStatutLead(leadId: string, newStatut: LeadStatut, commercialId: string, oldStatut: string) {
  const user = await getCurrentUser();
  if (!canModifyLead(user, commercialId)) throw new Error('Non autorisé');
  if (newStatut === 'gagne') throw new Error('Transition système uniquement');
  const allowed = VALID_TRANSITIONS[oldStatut as LeadStatut] ?? [];
  if (!allowed.includes(newStatut)) throw new Error(`Transition ${oldStatut} → ${newStatut} non autorisée`);
  updateLeadStatut(leadId, newStatut, user.id, oldStatut);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/leads');
}

export async function actionCreerRelance(data: {
  lead_id: string; type: RelanceType; date_prevue: string; notes?: string; commercial_id: string;
}) {
  const user = await getCurrentUser();
  createRelance({ ...data, commercial_id: user.id });
  revalidatePath(`/leads/${data.lead_id}`);
  revalidatePath('/relances');
}

export async function actionMarquerRelanceFaite(relanceId: string, leadId: string) {
  markRelanceFaite(relanceId);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/relances');
}

export async function actionOuvrirPreDossier(formData: FormData) {
  const user = await getCurrentUser();
  if (!canOpenPreDossier(user)) throw new Error('Non autorisé');

  const lead_id = formData.get('lead_id') as string;
  const commission = formData.get('commission') ? parseFloat(formData.get('commission') as string) : null;

  const input: PreDossierInput = {
    lead_id,
    prenom: formData.get('prenom') as string,
    nom: formData.get('nom') as string,
    email: formData.get('email') as string,
    telephone: formData.get('telephone') as string,
    date_naissance: formData.get('date_naissance') as string,
    formation_type: formData.get('formation_type') as FormationType,
    formule: formData.get('formule') as Formule,
    commercial_id: user.id,
    commission,
    notes: (formData.get('notes') as string) || undefined,
  };

  const { dossierId } = ouvrirPreDossier(input);
  revalidatePath(`/leads/${lead_id}`);
  revalidatePath('/leads');
  revalidatePath('/dossiers');
  return { dossierId };
}

export async function actionUpsertCommission(leadId: string, commercialId: string, montant: number | null) {
  const user = await getCurrentUser();
  if (!canModifyLead(user, commercialId)) throw new Error('Non autorisé');
  upsertCommission(leadId, user.id, montant);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/commissions');
}

export async function actionUnlockCommission(leadId: string, dossierId: string, motif: string) {
  const user = await getCurrentUser();
  if (!canUnlockCommission(user)) throw new Error('Seul un Admin peut déverrouiller une commission');
  if (motif.length < 20) throw new Error('Le motif doit contenir au moins 20 caractères');
  unlockCommission(leadId, motif, user.id, dossierId);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/commissions');
}
