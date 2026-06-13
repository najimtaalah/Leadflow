"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  createAction,
  updateAction,
  deleteAction,
  type CreateActionInput,
  type UpdateActionInput,
} from "@/lib/db/qualiopi-actions";
import type { ActionQualiopiStatut } from "@/lib/db/types";

function canViewActions(role: string): boolean {
  return ['gestionnaire', 'admin', 'super_admin'].includes(role);
}

function canCreateAction(role: string): boolean {
  return ['gestionnaire', 'admin', 'super_admin'].includes(role);
}

function canDeleteAction(role: string): boolean {
  return ['admin', 'super_admin'].includes(role);
}

export async function actionCreateAction(input: CreateActionInput) {
  const user = await getCurrentUser();
  if (!canCreateAction(user.role)) throw new Error('Non autorisé');

  const action = await createAction({
    ...input,
    created_by: `${user.prenom} ${user.nom}`,
  });

  revalidatePath('/qualiopi/actions');
  return action;
}

export async function actionUpdateAction(
  id: string,
  input: UpdateActionInput & { responsable_id?: string },
) {
  const user = await getCurrentUser();
  if (!canViewActions(user.role)) throw new Error('Non autorisé');

  // Gestionnaire can only modify actions where they are responsable
  if (user.role === 'gestionnaire') {
    const { getActionById } = await import('@/lib/db/qualiopi-actions');
    const existing = await getActionById(id);
    if (!existing) throw new Error('Action introuvable');
    const isResponsable = existing.responsable === `${user.prenom} ${user.nom}` ||
      existing.responsable === user.email;
    const isAdmin = ['admin', 'super_admin'].includes(user.role);
    if (!isResponsable && !isAdmin) {
      throw new Error('Non autorisé : vous n\'êtes pas le responsable de cette action');
    }
  }

  const action = await updateAction(id, {
    ...input,
    changed_by: `${user.prenom} ${user.nom}`,
  });

  revalidatePath('/qualiopi/actions');
  revalidatePath(`/qualiopi/actions/${id}`);
  return action;
}

export async function actionChangeStatut(
  id: string,
  statut: ActionQualiopiStatut,
  note?: string,
) {
  return actionUpdateAction(id, { statut, note });
}

export async function actionDeleteAction(id: string) {
  const user = await getCurrentUser();
  if (!canDeleteAction(user.role)) {
    throw new Error('Non autorisé : seuls Admin et Super Admin peuvent annuler une action');
  }

  await deleteAction(id, `${user.prenom} ${user.nom}`);
  revalidatePath('/qualiopi/actions');
}
