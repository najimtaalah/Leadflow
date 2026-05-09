'use strict';

// ── Statuts Leads ─────────────────────────────────────────────────────────────
const STATUTS_LEAD = Object.freeze({
  NOUVEAU:  'nouveau',
  QUALIFIE: 'qualifie',
  EN_COURS: 'en_cours',
  CONVERTI: 'converti',  // badge : pré-dossier ouvert
  PERDU:    'perdu',
  GAGNE:    'gagne',
});

// Statuts hérités du pipeline v1 — conservés pour rétrocompatibilité DB
// Le schéma leads.statut ENUM utilise encore ces valeurs.
const STATUTS_LEAD_LEGACY = Object.freeze({
  ENTRANT:     'entrant',
  CONTACTE:    'contacte',
  RDV_BOOKE:   'rdv_booke',
  EN_SUSPENS:  'en_suspens',
  INJOIGNABLE: 'injoignable',
  ANNULE:      'annule',
});

// ── Statuts Pré-dossier ────────────────────────────────────────────────────────
const STATUTS_PRE_DOSSIER = Object.freeze({
  OUVERT:                 'ouvert',
  EN_COURS_ADMIN:         'en_cours_admin',
  ADMIN_VALIDE:           'admin_valide',
  EN_COURS_FINANCIER:     'en_cours_financier',
  FINANCIER_PRET:         'financier_pret',
  VALIDE:                 'valide',
});

// ── Statuts Dossier ────────────────────────────────────────────────────────────
const STATUTS_DOSSIER = Object.freeze({
  PRE_DOSSIER:  'pre_dossier',
  EN_COURS:     'en_cours',
  VALIDE:       'valide',
  NON_PLANIFIE: 'non_planifie',
  PLANIFIE:     'planifie',
  ARCHIVE:      'archive',
});

// ── Statuts Apprenant ─────────────────────────────────────────────────────────
const STATUTS_APPRENANT = Object.freeze({
  INACTIF: 'inactif',
  ACTIF:   'actif',
});

// ── Statuts Affectations ──────────────────────────────────────────────────────
const STATUTS_AFFECTATION = Object.freeze({
  NON_AFFECTE: 'non_affecte',
  AFFECTE:     'affecte',
  EN_COURS:    'en_cours',
  TERMINE:     'termine',
});

// ── Statuts Examens ───────────────────────────────────────────────────────────
const STATUTS_EXAMEN = Object.freeze({
  A_INSCRIRE: 'a_inscrire',
  INSCRIT:    'inscrit',
  CONVOQUE:   'convoque',
  REUSSI:     'reussi',
  ECHOUE:     'echoue',
  ABSENT:     'absent',
});

// ── Statuts Tentatives ────────────────────────────────────────────────────────
const STATUTS_TENTATIVE = Object.freeze({
  EN_COURS: 'en_cours',
  REUSSIE:  'reussie',
  ECHOUEE:  'echouee',
});

module.exports = {
  STATUTS_LEAD,
  STATUTS_LEAD_LEGACY,
  STATUTS_PRE_DOSSIER,
  STATUTS_DOSSIER,
  STATUTS_APPRENANT,
  STATUTS_AFFECTATION,
  STATUTS_EXAMEN,
  STATUTS_TENTATIVE,
};
