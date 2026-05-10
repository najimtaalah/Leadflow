import { cookies } from 'next/headers';
import { getDb } from './db';
import type { User, UserRole } from './db/types';

const DEFAULT_USER_ID = 'u-admin-1';

export async function getCurrentUser(): Promise<User> {
  const store = await cookies();
  const userId = store.get('user_id')?.value ?? DEFAULT_USER_ID;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
  if (!user) {
    const fallback = db.prepare('SELECT * FROM users WHERE id = ?').get(DEFAULT_USER_ID) as User;
    return fallback;
  }
  return user;
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

export function getAllUsers(): User[] {
  const db = getDb();
  return db.prepare('SELECT * FROM users ORDER BY nom').all() as User[];
}
