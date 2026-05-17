"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  createSessionCours,
  createSessionEdof,
  createSessionExamenTheorique,
  createSessionExamenPratique,
  affecterSession,
  setResultatExamen,
  type CreateSessionCoursInput,
  type CreateSessionEdofInput,
  type CreateSessionExamenTheoriqueInput,
  type CreateSessionExamenPratiqueInput,
} from "@/lib/db/sessions";
import {
  saisirResultatExamen,
  creerNouvelletentative,
  transitionnerSessionConvocations,
  type SaisirResultatInput,
} from "@/lib/db/tentatives";
import type { ResultatExamen, SessionTypeExamen, SaisieResultat } from "@/lib/db/types";

export async function actionCreateSessionCours(input: CreateSessionCoursInput) {
  const user = await getCurrentUser();
  if (!['gestionnaire', 'admin', 'super_admin'].includes(user.role)) {
    throw new Error('Non autorisé');
  }
  if (new Date(input.date_debut) >= new Date(input.date_fin)) {
    throw new Error('La date de début doit être antérieure à la date de fin.');
  }
  const id = await createSessionCours(input);
  revalidatePath('/sessions/cours');
  return id;
}

export async function actionCreateSessionEdof(input: CreateSessionEdofInput) {
  const user = await getCurrentUser();
  if (!['gestionnaire', 'admin', 'super_admin'].includes(user.role)) {
    throw new Error('Non autorisé');
  }
  if (new Date(input.date_debut) >= new Date(input.date_fin)) {
    throw new Error('La date de début doit être antérieure à la date de fin.');
  }
  // RM-L3-05: date_fin session ≤ date_fin dossier CPF
  if (input.date_fin_cpf && new Date(input.date_fin) > new Date(input.date_fin_cpf)) {
    throw new Error('La date de fin de session EDOF doit être ≤ à la date de fin du dossier CPF.');
  }
  const id = await createSessionEdof(input);
  revalidatePath('/sessions/edof');
  return id;
}

export async function actionCreateSessionExamenTheorique(input: CreateSessionExamenTheoriqueInput) {
  const user = await getCurrentUser();
  if (!['gestionnaire', 'admin', 'super_admin'].includes(user.role)) {
    throw new Error('Non autorisé');
  }
  const id = await createSessionExamenTheorique(input);
  revalidatePath('/sessions/examens-theoriques');
  return id;
}

export async function actionCreateSessionExamenPratique(input: CreateSessionExamenPratiqueInput) {
  const user = await getCurrentUser();
  if (!['gestionnaire', 'admin', 'super_admin'].includes(user.role)) {
    throw new Error('Non autorisé');
  }
  const id = await createSessionExamenPratique(input);
  revalidatePath('/sessions/examens-pratiques');
  return id;
}

export async function actionAffecterSession(
  dossierId: string,
  sessionType: 'cours' | 'edof' | 'theorique' | 'pratique',
  sessionId: string,
) {
  const user = await getCurrentUser();
  if (!['gestionnaire', 'admin', 'super_admin'].includes(user.role)) {
    throw new Error('Non autorisé');
  }
  await affecterSession({ dossier_id: dossierId, session_type: sessionType, session_id: sessionId, auteur_id: user.id });
  revalidatePath(`/dossiers/${dossierId}`);
  revalidatePath('/sessions/cours');
  revalidatePath('/sessions/edof');
  revalidatePath('/sessions/examens-theoriques');
  revalidatePath('/sessions/examens-pratiques');
}

export async function actionSetResultatExamen(
  dossierId: string,
  type: 'theorique' | 'pratique',
  resultat: ResultatExamen,
) {
  const user = await getCurrentUser();
  if (!['gestionnaire', 'admin', 'super_admin'].includes(user.role)) {
    throw new Error('Non autorisé');
  }
  await setResultatExamen(dossierId, type, resultat, user.id);
  revalidatePath(`/dossiers/${dossierId}`);
}

// ─── Lot 5 — Saisie résultats & tentatives ────────────────────────────────────

export async function actionSaisirResultatExamen(input: {
  dossier_id: string;
  tentative_id: string;
  session_type: SessionTypeExamen;
  session_id: string;
  resultat: SaisieResultat;
  score?: number;
  mention?: string;
  observations?: string;
}) {
  const user = await getCurrentUser();
  // RM-L5-02: seuls Admin et Super Admin peuvent saisir
  if (!['admin', 'super_admin'].includes(user.role)) {
    throw new Error('Seuls Admin et Super Admin peuvent saisir les résultats d\'examens.');
  }
  await saisirResultatExamen({ ...input, auteur_id: user.id });
  revalidatePath(`/dossiers/${input.dossier_id}`);
  if (input.session_type === 'theorique') {
    revalidatePath(`/sessions/examens-theoriques/${input.session_id}`);
  } else {
    revalidatePath(`/sessions/examens-pratiques/${input.session_id}`);
  }
}

export async function actionCreerNouvelleTentative(dossierId: string) {
  const user = await getCurrentUser();
  if (!['gestionnaire', 'admin', 'super_admin'].includes(user.role)) {
    throw new Error('Non autorisé');
  }
  const id = await creerNouvelletentative(dossierId, user.id);
  revalidatePath(`/dossiers/${dossierId}`);
  return id;
}

export async function actionTransitionnerSessionConvocations(
  sessionType: 'theorique' | 'pratique',
  sessionId: string,
) {
  const user = await getCurrentUser();
  if (!['gestionnaire', 'admin', 'super_admin'].includes(user.role)) {
    throw new Error('Non autorisé');
  }
  await transitionnerSessionConvocations(sessionType, sessionId, user.id);
  const path = sessionType === 'theorique'
    ? `/sessions/examens-theoriques/${sessionId}`
    : `/sessions/examens-pratiques/${sessionId}`;
  revalidatePath(path);
}
