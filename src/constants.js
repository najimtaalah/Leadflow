'use strict';

/**
 * Source unique de vérité pour tous les ENUMs, statuts et rôles.
 * DB ENUM + contrôleurs + tests dérivent de ce fichier.
 */

// ── Rôles utilisateurs ────────────────────────────────────────────────────────
const ROLES = Object.freeze({
  SUPER_ADMIN:        'super_admin',
  ROLE_ADMIN:         'role_admin',
  MANAGER:            'manager',
  COMMERCIAL:         'commercial',
  ROLE_ADMINISTRATIF: 'role_administratif',
  AGENT_ACCUEIL:      'agent_accueil',
});

// Ordre de priorité (du plus au moins privilégié) — copie de auth.js
const ROLE_HIERARCHY = Object.freeze([
  ROLES.SUPER_ADMIN,
  ROLES.ROLE_ADMIN,
  ROLES.MANAGER,
  ROLES.COMMERCIAL,
  ROLES.ROLE_ADMINISTRATIF,
  ROLES.AGENT_ACCUEIL,
]);

// ── Statuts des leads ─────────────────────────────────────────────────────────
const STATUTS_LEAD = Object.freeze({
  ENTRANT:     'entrant',
  CONTACTE:    'contacte',
  QUALIFIE:    'qualifie',
  RDV_BOOKE:   'rdv_booke',
  GAGNE:       'gagne',
  PERDU:       'perdu',
  ANNULE:      'annule',
  EN_SUSPENS:  'en_suspens',
  INJOIGNABLE: 'injoignable',
});

// Statuts qui déclenchent la réaffectation automatique (UC-09)
const STATUTS_REASSIGN = Object.freeze([STATUTS_LEAD.PERDU, STATUTS_LEAD.ANNULE]);

// ── Statuts des dossiers (table statuts_dossier) ──────────────────────────────
const STATUTS_DOSSIER = Object.freeze({
  NOUVEAU:          'Nouveau',
  EN_COURS:         'En cours',
  VALIDE:           'Validé',
  INSCRIT:          'Inscrit',
  EN_FORMATION:     'En formation',
  TERMINE:          'Terminé',
  ABANDONNE:        'Abandonné',
  ANNULE:           'Annulé',
});

// ── Types d'interactions ──────────────────────────────────────────────────────
const TYPES_INTERACTION = Object.freeze({
  APPEL: 'appel',
  SMS:   'sms',
  EMAIL: 'email',
  RDV:   'rdv',
  NOTE:  'note',
});

// ── Types de RDV (agenda_rdv) ─────────────────────────────────────────────────
const TYPES_RDV = Object.freeze({
  COMMERCIAL:    'commercial',
  ADMINISTRATIF: 'administratif',
  INTERNE:       'interne',
});

// ── Statuts des RDV ───────────────────────────────────────────────────────────
const STATUTS_RDV = Object.freeze({
  PLANIFIE:   'planifie',
  CONFIRME:   'confirme',
  EFFECTUE:   'effectue',
  ANNULE:     'annule',
  EN_ATTENTE: 'en_attente',
});

// ── Statuts des échéances ─────────────────────────────────────────────────────
const STATUTS_ECHEANCE = Object.freeze({
  EN_ATTENTE: 'en_attente',
  PAYEE:      'payee',
});

// ── Modes de paiement (encaissements) ────────────────────────────────────────
const MODES_PAIEMENT = Object.freeze({
  VIREMENT:    'virement',
  CB:          'cb',
  CHEQUE:      'cheque',
  ESPECES:     'especes',
  PRELEVEMENT: 'prelevement',
});

// ── Méthodes de distribution des leads ───────────────────────────────────────
const METHODES_DISTRIBUTION = Object.freeze({
  ROUND_ROBIN:    'round_robin',
  PAR_AGENCE:     'par_agence',
  PAR_FORMATION:  'par_formation',
});

// ── Types de session de formation ────────────────────────────────────────────
const TYPES_SESSION = Object.freeze({
  COURS:  'cours',
  EDOF:   'edof',
  EXAMEN: 'examen',
});

// ── Config pédagogique des formations ────────────────────────────────────────
const CONFIG_PEDAGOGIQUE = Object.freeze({
  THEORIE_SEULE:         'theorie_seule',
  PRATIQUE_SEULE:        'pratique_seule',
  THEORIE_ET_PRATIQUE:   'theorie_et_pratique',
});

// ── Résultats CMA ─────────────────────────────────────────────────────────────
const RESULTATS_CMA = Object.freeze({
  ADMIS:      'admis',
  ECHEC:      'echec',
  EN_ATTENTE: 'en_attente',
});

// ── Types d'épreuves CMA ──────────────────────────────────────────────────────
const TYPES_EPREUVE_CMA = Object.freeze({
  THEORIE:  'theorie',
  PRATIQUE: 'pratique',
});

// ── Fréquences sync CMA ───────────────────────────────────────────────────────
const FREQUENCES_SYNC_CMA = Object.freeze({
  NUIT_06H:     'nuit_06h',
  TOUTES_12H:   'toutes_12h',
  TOUTES_6H:    'toutes_6h',
});

// ── Types d'imports ───────────────────────────────────────────────────────────
const TYPES_IMPORT = Object.freeze({
  GESTION: 'gestion',
  EDOF:    'edof',
});

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  STATUTS_LEAD,
  STATUTS_REASSIGN,
  STATUTS_DOSSIER,
  TYPES_INTERACTION,
  TYPES_RDV,
  STATUTS_RDV,
  STATUTS_ECHEANCE,
  MODES_PAIEMENT,
  METHODES_DISTRIBUTION,
  TYPES_SESSION,
  CONFIG_PEDAGOGIQUE,
  RESULTATS_CMA,
  TYPES_EPREUVE_CMA,
  FREQUENCES_SYNC_CMA,
  TYPES_IMPORT,
};
