import { describe, it, expect } from 'vitest';
import { isValidTransition, VALID_TRANSITIONS, computeStatut } from '../lib/db/qualiopi-actions.logic';
import type { ActionQualiopiStatut } from '../lib/db/types';

// ─── State machine tests ───────────────────────────────────────────────────────

describe('isValidTransition', () => {
  it('a_faire → en_cours is valid', () => {
    expect(isValidTransition('a_faire', 'en_cours')).toBe(true);
  });

  it('a_faire → annule is valid', () => {
    expect(isValidTransition('a_faire', 'annule')).toBe(true);
  });

  it('a_faire → fait is INVALID', () => {
    expect(isValidTransition('a_faire', 'fait')).toBe(false);
  });

  it('a_faire → en_retard is INVALID', () => {
    expect(isValidTransition('a_faire', 'en_retard')).toBe(false);
  });

  it('en_cours → fait is valid', () => {
    expect(isValidTransition('en_cours', 'fait')).toBe(true);
  });

  it('en_cours → en_retard is valid', () => {
    expect(isValidTransition('en_cours', 'en_retard')).toBe(true);
  });

  it('en_cours → annule is valid', () => {
    expect(isValidTransition('en_cours', 'annule')).toBe(true);
  });

  it('en_cours → a_faire is INVALID', () => {
    expect(isValidTransition('en_cours', 'a_faire')).toBe(false);
  });

  it('en_retard → fait is valid', () => {
    expect(isValidTransition('en_retard', 'fait')).toBe(true);
  });

  it('en_retard → annule is valid', () => {
    expect(isValidTransition('en_retard', 'annule')).toBe(true);
  });

  it('en_retard → a_faire is INVALID', () => {
    expect(isValidTransition('en_retard', 'a_faire')).toBe(false);
  });

  it('en_retard → en_cours is INVALID', () => {
    expect(isValidTransition('en_retard', 'en_cours')).toBe(false);
  });

  it('fait → en_cours is valid (réouverture)', () => {
    expect(isValidTransition('fait', 'en_cours')).toBe(true);
  });

  it('fait → a_faire is INVALID', () => {
    expect(isValidTransition('fait', 'a_faire')).toBe(false);
  });

  it('fait → annule is INVALID', () => {
    expect(isValidTransition('fait', 'annule')).toBe(false);
  });

  it('annule → a_faire is valid (réactivation)', () => {
    expect(isValidTransition('annule', 'a_faire')).toBe(true);
  });

  it('annule → fait is INVALID', () => {
    expect(isValidTransition('annule', 'fait')).toBe(false);
  });

  it('annule → en_cours is INVALID', () => {
    expect(isValidTransition('annule', 'en_cours')).toBe(false);
  });

  it('same statut → same statut is INVALID (self-transition)', () => {
    const statuts: ActionQualiopiStatut[] = ['a_faire', 'en_cours', 'fait', 'en_retard', 'annule'];
    for (const s of statuts) {
      expect(isValidTransition(s, s)).toBe(false);
    }
  });
});

// ─── en_retard computation ─────────────────────────────────────────────────────

describe('computeStatut (en_retard lazy)', () => {
  const yesterday = new Date(Date.now() - 86400000);
  const tomorrow = new Date(Date.now() + 86400000);
  const nextWeek = new Date(Date.now() + 7 * 86400000);

  it('a_faire with past deadline → en_retard', () => {
    expect(computeStatut('a_faire', yesterday)).toBe('en_retard');
  });

  it('en_cours with past deadline → en_retard', () => {
    expect(computeStatut('en_cours', yesterday)).toBe('en_retard');
  });

  it('a_faire with future deadline → a_faire (unchanged)', () => {
    expect(computeStatut('a_faire', tomorrow)).toBe('a_faire');
  });

  it('en_cours with future deadline → en_cours (unchanged)', () => {
    expect(computeStatut('en_cours', nextWeek)).toBe('en_cours');
  });

  it('fait with past deadline → fait (exempt)', () => {
    expect(computeStatut('fait', yesterday)).toBe('fait');
  });

  it('annule with past deadline → annule (exempt)', () => {
    expect(computeStatut('annule', yesterday)).toBe('annule');
  });

  it('a_faire without deadline → a_faire', () => {
    expect(computeStatut('a_faire', null)).toBe('a_faire');
  });
});

// ─── Preuve obligatoire pour "fait" ───────────────────────────────────────────

describe('preuve rule', () => {
  function validateTransitionToFait(preuve: string | null, preuveFichier: string | null): boolean {
    return !!(preuve || preuveFichier);
  }

  it('preuve text renseignée → autoriser fait', () => {
    expect(validateTransitionToFait('Rapport signé du 12/06/2026', null)).toBe(true);
  });

  it('preuve fichier URL renseignée → autoriser fait', () => {
    expect(validateTransitionToFait(null, 'https://storage.example.com/preuve.pdf')).toBe(true);
  });

  it('aucune preuve → bloquer fait', () => {
    expect(validateTransitionToFait(null, null)).toBe(false);
  });

  it('preuve vide string → bloquer fait', () => {
    expect(validateTransitionToFait('', '')).toBe(false);
  });
});

// ─── VALID_TRANSITIONS coverage ───────────────────────────────────────────────

describe('VALID_TRANSITIONS completeness', () => {
  const statuts: ActionQualiopiStatut[] = ['a_faire', 'en_cours', 'fait', 'en_retard', 'annule'];

  it('every statut has an entry in VALID_TRANSITIONS', () => {
    for (const s of statuts) {
      expect(VALID_TRANSITIONS[s]).toBeDefined();
    }
  });

  it('no statut transitions to itself', () => {
    for (const [from, tos] of Object.entries(VALID_TRANSITIONS)) {
      expect(tos).not.toContain(from);
    }
  });
});
