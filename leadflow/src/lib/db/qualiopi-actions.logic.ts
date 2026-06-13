import type { ActionQualiopiStatut } from './types';

export const VALID_TRANSITIONS: Record<ActionQualiopiStatut, ActionQualiopiStatut[]> = {
  a_faire:   ['en_cours', 'annule'],
  en_cours:  ['fait', 'en_retard', 'annule'],
  en_retard: ['fait', 'annule'],
  fait:      ['en_cours'],
  annule:    ['a_faire'],
};

export function isValidTransition(from: ActionQualiopiStatut, to: ActionQualiopiStatut): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function computeStatut(
  statut: string,
  date_echeance: Date | null,
): ActionQualiopiStatut {
  if (statut === 'fait' || statut === 'annule') return statut as ActionQualiopiStatut;
  if (date_echeance && new Date(date_echeance) < new Date(new Date().toDateString())) {
    return 'en_retard';
  }
  return statut as ActionQualiopiStatut;
}
