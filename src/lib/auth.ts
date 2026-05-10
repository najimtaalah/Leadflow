import { cookies } from 'next/headers';
import { prisma } from './db/prisma';
import type { User, UserRole } from './db/types';

const DEFAULT_USER_ID = 'u-admin-1';

export async function getCurrentUser(): Promise<User> {
  const store = await cookies();
  const userId = store.get('user_id')?.value ?? DEFAULT_USER_ID;
  const row = await prisma.user.findUnique({ where: { id: userId } });
  if (!row) {
    const fallback = await prisma.user.findUniqueOrThrow({ where: { id: DEFAULT_USER_ID } });
    return mapUser(fallback);
  }
  return mapUser(row);
}

export async function getAllUsers(): Promise<User[]> {
  const rows = await prisma.user.findMany({ orderBy: { nom: 'asc' } });
  return rows.map(mapUser);
}

function mapUser(r: { id: string; prenom: string; nom: string; email: string; role: string; created_at: Date }): User {
  return {
    id: r.id,
    prenom: r.prenom,
    nom: r.nom,
    email: r.email,
    role: r.role as UserRole,
    created_at: r.created_at.toISOString(),
  };
}

export function canViewLead(user: User, commercialId: string): boolean {
  if (user.role === 'commercial') return user.id === commercialId;
  return ['closer_habilite', 'gestionnaire', 'admin', 'super_admin'].includes(user.role);
}

export function canModifyLead(user: User, commercialId: string): boolean {
  if (user.role === 'commercial') return user.id === commercialId;
  return ['gestionnaire', 'admin', 'super_admin'].includes(user.role);
}

export function canOpenPreDossier(user: User): boolean {
  return ['commercial', 'gestionnaire', 'admin', 'super_admin'].includes(user.role);
}

export function canValidateBlocAdmin(user: User): boolean {
  return ['gestionnaire', 'admin', 'super_admin'].includes(user.role);
}

export function canValidateBlocFinancier(user: User): boolean {
  return ['admin', 'super_admin'].includes(user.role);
}

export function canSaisieBlocFinancier(user: User): boolean {
  return ['closer_habilite', 'gestionnaire', 'admin', 'super_admin'].includes(user.role);
}

export function canActivateApprenant(user: User): boolean {
  return ['admin', 'super_admin'].includes(user.role);
}

export function canUnlockCommission(user: User): boolean {
  return ['admin', 'super_admin'].includes(user.role);
}

export function canCancelDossier(user: User): boolean {
  return user.role === 'super_admin';
}

export function canViewAllLeads(user: User): boolean {
  return ['gestionnaire', 'admin', 'super_admin'].includes(user.role);
}

export function canViewAllCommissions(user: User): boolean {
  return ['gestionnaire', 'admin', 'super_admin'].includes(user.role);
}

export function hasRole(user: User, roles: UserRole[]): boolean {
  return roles.includes(user.role);
}
