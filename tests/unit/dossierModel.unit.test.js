'use strict';

/**
 * Tests unitaires — DossierModel (modèle réel, DB mockée)
 *
 * Couvre les méthodes du modèle sans mocker le module Dossier lui-même.
 * La DB est mockée ; le code source réel de Dossier.js est exécuté.
 *
 * Couvre :
 *  - canBeValidated  (règle CMA)
 *  - canBeArchived   (règle solde + archivage)
 *  - getStatutPaiement (calcul statut paiement)
 *  - generateReference (format DOS-YYYY-NNNN)
 *  - create (INSERT avec référence)
 *  - update (champs autorisés uniquement)
 */

jest.mock('../../src/config/database', () => ({ query: jest.fn() }));

const db           = require('../../src/config/database');
const DossierModel = require('../../src/models/Dossier');

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
// canBeValidated
// ─────────────────────────────────────────────────────────────────────────────
describe('DossierModel.canBeValidated — DB mockée', () => {

  test('Aucun résultat DB → DOSSIER_NOT_FOUND', async () => {
    db.query.mockResolvedValue([[]]); // SELECT retourne vide

    const result = await DossierModel.canBeValidated(999);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('DOSSIER_NOT_FOUND');
  });

  test('frais_cma_paye = 0 → CMA_NOT_PAID', async () => {
    db.query.mockResolvedValue([[{ frais_cma_paye: 0, frais_cma: 250 }]]);

    const result = await DossierModel.canBeValidated(1);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('CMA_NOT_PAID');
  });

  test('frais_cma_paye = null → CMA_NOT_PAID', async () => {
    db.query.mockResolvedValue([[{ frais_cma_paye: null, frais_cma: 250 }]]);

    const result = await DossierModel.canBeValidated(1);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('CMA_NOT_PAID');
  });

  test('frais_cma_paye = 1 → ok: true', async () => {
    db.query.mockResolvedValue([[{ frais_cma_paye: 1, frais_cma: 250 }]]);

    const result = await DossierModel.canBeValidated(1);

    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test('Requête SQL porte sur frais_cma_paye avec l\'id fourni', async () => {
    db.query.mockResolvedValue([[{ frais_cma_paye: 1, frais_cma: 100 }]]);

    await DossierModel.canBeValidated(42);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('frais_cma_paye');
    expect(params).toContain(42);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// canBeArchived
// ─────────────────────────────────────────────────────────────────────────────
describe('DossierModel.canBeArchived — DB mockée', () => {

  test('Aucun résultat DB → DOSSIER_NOT_FOUND', async () => {
    db.query.mockResolvedValue([[]]); // ligne vide

    const result = await DossierModel.canBeArchived(999);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('DOSSIER_NOT_FOUND');
  });

  test('archived = 1 → ALREADY_ARCHIVED', async () => {
    db.query.mockResolvedValue([[{ archived: 1, reste: 0 }]]);

    const result = await DossierModel.canBeArchived(1);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ALREADY_ARCHIVED');
  });

  test('reste > 0 → SOLDE_NON_SOLDE', async () => {
    db.query.mockResolvedValue([[{ archived: 0, reste: 150 }]]);

    const result = await DossierModel.canBeArchived(1);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('SOLDE_NON_SOLDE');
  });

  test('archived = 0 ET reste = 0 → ok: true', async () => {
    db.query.mockResolvedValue([[{ archived: 0, reste: 0 }]]);

    const result = await DossierModel.canBeArchived(1);

    expect(result.ok).toBe(true);
  });

  test('Requête SQL porte sur l\'id fourni et calcule le reste', async () => {
    db.query.mockResolvedValue([[{ archived: 0, reste: 0 }]]);

    await DossierModel.canBeArchived(7);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('archived');
    expect(params).toContain(7);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getStatutPaiement
// ─────────────────────────────────────────────────────────────────────────────
describe('DossierModel.getStatutPaiement — fonction pure', () => {

  test('financement_personnel = 0 → non_concerne', () => {
    expect(DossierModel.getStatutPaiement(0, 0)).toBe('non_concerne');
  });

  test('total_encaisse = 0 → neant', () => {
    expect(DossierModel.getStatutPaiement(1000, 0)).toBe('neant');
  });

  test('total_encaisse < financement_personnel → partiel', () => {
    expect(DossierModel.getStatutPaiement(1000, 400)).toBe('partiel');
  });

  test('total_encaisse = financement_personnel → effectue', () => {
    expect(DossierModel.getStatutPaiement(1000, 1000)).toBe('effectue');
  });

  test('trop-perçu (total > financement) → effectue', () => {
    expect(DossierModel.getStatutPaiement(1000, 1200)).toBe('effectue');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateReference
// ─────────────────────────────────────────────────────────────────────────────
describe('DossierModel.generateReference', () => {

  test('Format DOS-YYYY-NNNN avec incrément depuis la DB', async () => {
    const year = new Date().getFullYear();
    db.query.mockResolvedValue([[{ last_num: 5 }]]);

    const ref = await DossierModel.generateReference();

    expect(ref).toBe(`DOS-${year}-0006`);
  });

  test('Premier dossier de l\'année (last_num = null) → 0001', async () => {
    const year = new Date().getFullYear();
    db.query.mockResolvedValue([[{ last_num: null }]]);

    const ref = await DossierModel.generateReference();

    expect(ref).toBe(`DOS-${year}-0001`);
  });

  test('Numéro padded à 4 chiffres', async () => {
    db.query.mockResolvedValue([[{ last_num: 99 }]]);

    const ref = await DossierModel.generateReference();

    expect(ref).toMatch(/DOS-\d{4}-0100/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// update — filtre des champs autorisés
// ─────────────────────────────────────────────────────────────────────────────
describe('DossierModel.update', () => {

  test('Champs autorisés mis à jour → retourne true', async () => {
    db.query.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await DossierModel.update(1, { nom: 'Dupont', frais_cma: 250 });

    expect(result).toBe(true);
    const [sql] = db.query.mock.calls[0];
    expect(sql).toContain('nom = ?');
    expect(sql).toContain('frais_cma = ?');
  });

  test('Aucun champ valide → retourne false sans requête DB', async () => {
    const result = await DossierModel.update(1, { champ_inconnu: 'valeur' });

    expect(result).toBe(false);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('frais_cma_paye mis à jour avec la valeur 1', async () => {
    db.query.mockResolvedValue([{ affectedRows: 1 }]);

    await DossierModel.update(5, { frais_cma_paye: 1 });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('frais_cma_paye = ?');
    expect(params).toContain(1);
    expect(params).toContain(5); // WHERE id = ?
  });

  test('statut_id mis à jour', async () => {
    db.query.mockResolvedValue([{ affectedRows: 1 }]);

    await DossierModel.update(3, { statut_id: 7 });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('statut_id = ?');
    expect(params).toContain(7);
  });

  test('archived mis à jour', async () => {
    db.query.mockResolvedValue([{ affectedRows: 1 }]);

    await DossierModel.update(2, { archived: 1 });

    const [sql] = db.query.mock.calls[0];
    expect(sql).toContain('archived = ?');
  });
});
