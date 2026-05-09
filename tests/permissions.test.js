'use strict';

/**
 * Tests FRA-34 — Centralisation des statuts et sécurisation des rôles
 * Module testé : src/middleware/permissions.js + src/config/roles.js
 *
 * Tests purement unitaires — aucune connexion DB requise.
 */

const { can, resolveFunctionalRole } = require('../src/middleware/permissions');
const { ROLES, PERMISSIONS }         = require('../src/config/roles');

// ────────────────────────────────────────────────────────────────────────────
// Résolution des rôles fonctionnels
// ────────────────────────────────────────────────────────────────────────────
describe('resolveFunctionalRole — mapping DB → fonctionnel', () => {
  test('role_admin → admin', () => {
    expect(resolveFunctionalRole('role_admin')).toBe(ROLES.ADMIN);
  });
  test('role_administratif → gestionnaire', () => {
    expect(resolveFunctionalRole('role_administratif')).toBe(ROLES.GESTIONNAIRE);
  });
  test('manager → gestionnaire (transitoire)', () => {
    expect(resolveFunctionalRole('manager')).toBe(ROLES.GESTIONNAIRE);
  });
  test('commercial → commercial', () => {
    expect(resolveFunctionalRole('commercial')).toBe(ROLES.COMMERCIAL);
  });
  test('super_admin → super_admin', () => {
    expect(resolveFunctionalRole('super_admin')).toBe(ROLES.SUPER_ADMIN);
  });
  test('agent_accueil → commercial (accès lecture)', () => {
    expect(resolveFunctionalRole('agent_accueil')).toBe(ROLES.COMMERCIAL);
  });
  test('closer_habilite → closer_habilite', () => {
    expect(resolveFunctionalRole('closer_habilite')).toBe(ROLES.CLOSER_HABILITE);
  });
  test('rôle inconnu → null', () => {
    expect(resolveFunctionalRole('rôle_inconnu')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// commercial
// ────────────────────────────────────────────────────────────────────────────
describe('Permissions — commercial', () => {
  test('peut lire les leads', () => {
    expect(can(ROLES.COMMERCIAL, PERMISSIONS.LEAD_READ)).toBe(true);
  });
  test('peut créer un lead', () => {
    expect(can(ROLES.COMMERCIAL, PERMISSIONS.LEAD_CREATE)).toBe(true);
  });
  test('peut ouvrir un pré-dossier', () => {
    expect(can(ROLES.COMMERCIAL, PERMISSIONS.PRE_DOSSIER_OPEN)).toBe(true);
  });
  test('peut compléter le bloc admin', () => {
    expect(can(ROLES.COMMERCIAL, PERMISSIONS.PRE_DOSSIER_FILL_ADMIN)).toBe(true);
  });

  test('NE peut PAS valider le bloc admin', () => {
    expect(can(ROLES.COMMERCIAL, PERMISSIONS.PRE_DOSSIER_VALIDATE_ADMIN)).toBe(false);
  });
  test('NE peut PAS compléter le bloc financier', () => {
    expect(can(ROLES.COMMERCIAL, PERMISSIONS.PRE_DOSSIER_FILL_FINANCIAL)).toBe(false);
  });
  test('NE peut PAS marquer financier prêt', () => {
    expect(can(ROLES.COMMERCIAL, PERMISSIONS.PRE_DOSSIER_MARK_READY)).toBe(false);
  });
  test('NE peut PAS valider le bloc financier', () => {
    expect(can(ROLES.COMMERCIAL, PERMISSIONS.PRE_DOSSIER_VALIDATE_FINANCIAL)).toBe(false);
  });
  test('NE peut PAS gérer la facturation', () => {
    expect(can(ROLES.COMMERCIAL, PERMISSIONS.FACTURATION_MANAGE)).toBe(false);
  });
  test('NE peut PAS gérer les utilisateurs', () => {
    expect(can(ROLES.COMMERCIAL, PERMISSIONS.USER_MANAGE)).toBe(false);
  });
  test('NE peut PAS affecter des sessions', () => {
    expect(can(ROLES.COMMERCIAL, PERMISSIONS.SESSION_ASSIGN)).toBe(false);
  });
  test('NE peut PAS éditer des documents', () => {
    expect(can(ROLES.COMMERCIAL, PERMISSIONS.DOCUMENT_EDIT)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// closer habilité
// ────────────────────────────────────────────────────────────────────────────
describe('Permissions — closer habilité', () => {
  test('peut compléter le bloc financier', () => {
    expect(can(ROLES.CLOSER_HABILITE, PERMISSIONS.PRE_DOSSIER_FILL_FINANCIAL)).toBe(true);
  });
  test('peut marquer prêt pour validation', () => {
    expect(can(ROLES.CLOSER_HABILITE, PERMISSIONS.PRE_DOSSIER_MARK_READY)).toBe(true);
  });
  test('peut ouvrir un pré-dossier', () => {
    expect(can(ROLES.CLOSER_HABILITE, PERMISSIONS.PRE_DOSSIER_OPEN)).toBe(true);
  });

  test('NE peut PAS valider le bloc admin', () => {
    expect(can(ROLES.CLOSER_HABILITE, PERMISSIONS.PRE_DOSSIER_VALIDATE_ADMIN)).toBe(false);
  });
  test('NE peut PAS valider le bloc financier', () => {
    expect(can(ROLES.CLOSER_HABILITE, PERMISSIONS.PRE_DOSSIER_VALIDATE_FINANCIAL)).toBe(false);
  });
  test('NE peut PAS gérer la facturation', () => {
    expect(can(ROLES.CLOSER_HABILITE, PERMISSIONS.FACTURATION_MANAGE)).toBe(false);
  });
  test('NE peut PAS gérer les utilisateurs', () => {
    expect(can(ROLES.CLOSER_HABILITE, PERMISSIONS.USER_MANAGE)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// gestionnaire
// ────────────────────────────────────────────────────────────────────────────
describe('Permissions — gestionnaire', () => {
  test('peut valider le bloc admin', () => {
    expect(can(ROLES.GESTIONNAIRE, PERMISSIONS.PRE_DOSSIER_VALIDATE_ADMIN)).toBe(true);
  });
  test('peut affecter des sessions', () => {
    expect(can(ROLES.GESTIONNAIRE, PERMISSIONS.SESSION_ASSIGN)).toBe(true);
  });
  test('peut éditer des documents', () => {
    expect(can(ROLES.GESTIONNAIRE, PERMISSIONS.DOCUMENT_EDIT)).toBe(true);
  });
  test('peut créer un dossier', () => {
    expect(can(ROLES.GESTIONNAIRE, PERMISSIONS.DOSSIER_CREATE)).toBe(true);
  });

  test('NE peut PAS valider le bloc financier', () => {
    expect(can(ROLES.GESTIONNAIRE, PERMISSIONS.PRE_DOSSIER_VALIDATE_FINANCIAL)).toBe(false);
  });
  test('NE peut PAS gérer la facturation', () => {
    expect(can(ROLES.GESTIONNAIRE, PERMISSIONS.FACTURATION_MANAGE)).toBe(false);
  });
  test('NE peut PAS gérer les exceptions', () => {
    expect(can(ROLES.GESTIONNAIRE, PERMISSIONS.EXCEPTION_MANAGE)).toBe(false);
  });
  test('NE peut PAS archiver un dossier', () => {
    expect(can(ROLES.GESTIONNAIRE, PERMISSIONS.DOSSIER_ARCHIVE)).toBe(false);
  });
  test('NE peut PAS gérer les utilisateurs', () => {
    expect(can(ROLES.GESTIONNAIRE, PERMISSIONS.USER_MANAGE)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// admin
// ────────────────────────────────────────────────────────────────────────────
describe('Permissions — admin', () => {
  test('peut valider le bloc financier', () => {
    expect(can(ROLES.ADMIN, PERMISSIONS.PRE_DOSSIER_VALIDATE_FINANCIAL)).toBe(true);
  });
  test('peut gérer la facturation', () => {
    expect(can(ROLES.ADMIN, PERMISSIONS.FACTURATION_MANAGE)).toBe(true);
  });
  test('peut gérer les exceptions', () => {
    expect(can(ROLES.ADMIN, PERMISSIONS.EXCEPTION_MANAGE)).toBe(true);
  });
  test('peut archiver un dossier', () => {
    expect(can(ROLES.ADMIN, PERMISSIONS.DOSSIER_ARCHIVE)).toBe(true);
  });
  test('peut affecter des sessions', () => {
    expect(can(ROLES.ADMIN, PERMISSIONS.SESSION_ASSIGN)).toBe(true);
  });

  test('NE peut PAS gérer les utilisateurs', () => {
    expect(can(ROLES.ADMIN, PERMISSIONS.USER_MANAGE)).toBe(false);
  });
  test('NE peut PAS gérer les rôles', () => {
    expect(can(ROLES.ADMIN, PERMISSIONS.ROLE_MANAGE)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// super admin — toutes les permissions
// ────────────────────────────────────────────────────────────────────────────
describe('Permissions — super admin', () => {
  test('a toutes les permissions définies', () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(can(ROLES.SUPER_ADMIN, permission)).toBe(true);
    }
  });
  test('peut gérer les utilisateurs', () => {
    expect(can(ROLES.SUPER_ADMIN, PERMISSIONS.USER_MANAGE)).toBe(true);
  });
  test('peut gérer les rôles', () => {
    expect(can(ROLES.SUPER_ADMIN, PERMISSIONS.ROLE_MANAGE)).toBe(true);
  });
  test('peut valider le bloc financier', () => {
    expect(can(ROLES.SUPER_ADMIN, PERMISSIONS.PRE_DOSSIER_VALIDATE_FINANCIAL)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Mapping via rôles DB (intégration DB_ROLE_TO_FUNCTIONAL dans can())
// ────────────────────────────────────────────────────────────────────────────
describe('can() — rôles DB passés directement', () => {
  test('role_admin → peut valider le financier', () => {
    expect(can('role_admin', PERMISSIONS.PRE_DOSSIER_VALIDATE_FINANCIAL)).toBe(true);
  });
  test('role_administratif → peut affecter des sessions', () => {
    expect(can('role_administratif', PERMISSIONS.SESSION_ASSIGN)).toBe(true);
  });
  test('commercial DB → peut ouvrir un pré-dossier', () => {
    expect(can('commercial', PERMISSIONS.PRE_DOSSIER_OPEN)).toBe(true);
  });
  test('commercial DB → NE peut PAS valider le financier', () => {
    expect(can('commercial', PERMISSIONS.PRE_DOSSIER_VALIDATE_FINANCIAL)).toBe(false);
  });
  test('super_admin DB → toutes les permissions', () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(can('super_admin', permission)).toBe(true);
    }
  });
  test('rôle DB inconnu → false pour toute permission', () => {
    expect(can('rôle_fantôme', PERMISSIONS.LEAD_READ)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Statuts — intégrité des constantes exportées
// ────────────────────────────────────────────────────────────────────────────
describe('Statuts — intégrité des constantes', () => {
  const {
    STATUTS_LEAD, STATUTS_PRE_DOSSIER, STATUTS_DOSSIER,
    STATUTS_APPRENANT, STATUTS_AFFECTATION, STATUTS_EXAMEN, STATUTS_TENTATIVE,
  } = require('../src/config/statuts');

  test('STATUTS_LEAD contient les 6 statuts attendus', () => {
    expect(Object.values(STATUTS_LEAD)).toEqual(
      expect.arrayContaining(['nouveau', 'qualifie', 'en_cours', 'converti', 'perdu', 'gagne'])
    );
    expect(Object.keys(STATUTS_LEAD)).toHaveLength(6);
  });

  test('STATUTS_PRE_DOSSIER contient les 6 étapes du workflow', () => {
    expect(Object.values(STATUTS_PRE_DOSSIER)).toEqual(
      expect.arrayContaining([
        'ouvert', 'en_cours_admin', 'admin_valide',
        'en_cours_financier', 'financier_pret', 'valide',
      ])
    );
  });

  test('STATUTS_DOSSIER contient les 6 états', () => {
    expect(Object.values(STATUTS_DOSSIER)).toEqual(
      expect.arrayContaining([
        'pre_dossier', 'en_cours', 'valide', 'non_planifie', 'planifie', 'archive',
      ])
    );
  });

  test('STATUTS_APPRENANT : inactif et actif', () => {
    expect(STATUTS_APPRENANT.INACTIF).toBe('inactif');
    expect(STATUTS_APPRENANT.ACTIF).toBe('actif');
  });

  test('STATUTS_EXAMEN contient les 6 états', () => {
    expect(Object.keys(STATUTS_EXAMEN)).toHaveLength(6);
  });

  test('les constantes sont gelées (immutables)', () => {
    expect(Object.isFrozen(STATUTS_LEAD)).toBe(true);
    expect(Object.isFrozen(STATUTS_PRE_DOSSIER)).toBe(true);
    expect(Object.isFrozen(STATUTS_DOSSIER)).toBe(true);
  });
});
