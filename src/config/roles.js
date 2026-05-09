'use strict';

// ── Rôles fonctionnels (nomenclature métier LeadFlow) ────────────────────────
const ROLES = Object.freeze({
  SUPER_ADMIN:     'super_admin',
  ADMIN:           'admin',
  GESTIONNAIRE:    'gestionnaire',
  CLOSER_HABILITE: 'closer_habilite',
  COMMERCIAL:      'commercial',
});

// ── Mapping rôles DB → rôles fonctionnels ─────────────────────────────────────
// Les rôles DB existants (roles.nom ENUM en base) sont préservés.
// Ce mapping permet au service de permissions de raisonner en termes métier.
// Note : closer_habilite n'existe pas encore en DB — migration à prévoir (FRA-33).
const DB_ROLE_TO_FUNCTIONAL = Object.freeze({
  'super_admin':        ROLES.SUPER_ADMIN,
  'role_admin':         ROLES.ADMIN,
  'role_administratif': ROLES.GESTIONNAIRE,
  'manager':            ROLES.GESTIONNAIRE,  // à affiner lors de FRA-35
  'commercial':         ROLES.COMMERCIAL,
  'agent_accueil':      ROLES.COMMERCIAL,    // lecture seule équivalent commercial
  'closer_habilite':    ROLES.CLOSER_HABILITE,
});

// ── Permissions (actions métier granulaires) ──────────────────────────────────
const PERMISSIONS = Object.freeze({
  // Leads
  LEAD_READ:                     'lead:read',
  LEAD_CREATE:                   'lead:create',
  LEAD_UPDATE:                   'lead:update',
  LEAD_DELETE:                   'lead:delete',

  // Pré-dossier
  PRE_DOSSIER_OPEN:              'pre_dossier:open',
  PRE_DOSSIER_FILL_ADMIN:        'pre_dossier:fill_admin',
  PRE_DOSSIER_VALIDATE_ADMIN:    'pre_dossier:validate_admin',
  PRE_DOSSIER_FILL_FINANCIAL:    'pre_dossier:fill_financial',
  PRE_DOSSIER_MARK_READY:        'pre_dossier:mark_ready',
  PRE_DOSSIER_VALIDATE_FINANCIAL:'pre_dossier:validate_financial',

  // Dossier
  DOSSIER_READ:                  'dossier:read',
  DOSSIER_CREATE:                'dossier:create',
  DOSSIER_UPDATE:                'dossier:update',
  DOSSIER_ARCHIVE:               'dossier:archive',

  // Sessions / affectations
  SESSION_READ:                  'session:read',
  SESSION_ASSIGN:                'session:assign',

  // Documents (conventions, attestations, feuilles émargement)
  DOCUMENT_READ:                 'document:read',
  DOCUMENT_EDIT:                 'document:edit',

  // Finance / facturation
  FACTURATION_MANAGE:            'facturation:manage',
  EXCEPTION_MANAGE:              'exception:manage',

  // Administration
  USER_MANAGE:                   'user:manage',
  ROLE_MANAGE:                   'role:manage',
});

// ── Matrice des permissions par rôle fonctionnel ──────────────────────────────
const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.COMMERCIAL]: new Set([
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.PRE_DOSSIER_OPEN,
    PERMISSIONS.PRE_DOSSIER_FILL_ADMIN,
    PERMISSIONS.DOSSIER_READ,
    PERMISSIONS.SESSION_READ,
    PERMISSIONS.DOCUMENT_READ,
  ]),

  [ROLES.CLOSER_HABILITE]: new Set([
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.PRE_DOSSIER_OPEN,
    PERMISSIONS.PRE_DOSSIER_FILL_ADMIN,
    PERMISSIONS.PRE_DOSSIER_FILL_FINANCIAL,
    PERMISSIONS.PRE_DOSSIER_MARK_READY,
    PERMISSIONS.DOSSIER_READ,
    PERMISSIONS.SESSION_READ,
    PERMISSIONS.DOCUMENT_READ,
  ]),

  [ROLES.GESTIONNAIRE]: new Set([
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.PRE_DOSSIER_OPEN,
    PERMISSIONS.PRE_DOSSIER_FILL_ADMIN,
    PERMISSIONS.PRE_DOSSIER_VALIDATE_ADMIN,
    PERMISSIONS.PRE_DOSSIER_FILL_FINANCIAL,
    PERMISSIONS.PRE_DOSSIER_MARK_READY,
    PERMISSIONS.DOSSIER_READ,
    PERMISSIONS.DOSSIER_CREATE,
    PERMISSIONS.DOSSIER_UPDATE,
    PERMISSIONS.SESSION_READ,
    PERMISSIONS.SESSION_ASSIGN,
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.DOCUMENT_EDIT,
  ]),

  [ROLES.ADMIN]: new Set([
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.PRE_DOSSIER_OPEN,
    PERMISSIONS.PRE_DOSSIER_FILL_ADMIN,
    PERMISSIONS.PRE_DOSSIER_VALIDATE_ADMIN,
    PERMISSIONS.PRE_DOSSIER_FILL_FINANCIAL,
    PERMISSIONS.PRE_DOSSIER_MARK_READY,
    PERMISSIONS.PRE_DOSSIER_VALIDATE_FINANCIAL,
    PERMISSIONS.DOSSIER_READ,
    PERMISSIONS.DOSSIER_CREATE,
    PERMISSIONS.DOSSIER_UPDATE,
    PERMISSIONS.DOSSIER_ARCHIVE,
    PERMISSIONS.SESSION_READ,
    PERMISSIONS.SESSION_ASSIGN,
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.DOCUMENT_EDIT,
    PERMISSIONS.FACTURATION_MANAGE,
    PERMISSIONS.EXCEPTION_MANAGE,
  ]),

  // super_admin : toutes les permissions
  [ROLES.SUPER_ADMIN]: new Set(Object.values(PERMISSIONS)),
});

module.exports = { ROLES, PERMISSIONS, ROLE_PERMISSIONS, DB_ROLE_TO_FUNCTIONAL };
