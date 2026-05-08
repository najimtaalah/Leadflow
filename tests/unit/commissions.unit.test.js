'use strict';

/**
 * Tests unitaires — Calculs de commissions
 * Le module DB est mocké : aucune connexion MySQL requise.
 * Couvre : calcul 6.5% commercial, supplément manager 1.5%, arrondi.
 */

jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
}));

const db             = require('../../src/config/database');
const CommissionModel = require('../../src/models/Commission');

beforeEach(() => {
  jest.clearAllMocks();
});

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
function round2(n) { return Math.round(n * 100) / 100; }

// ────────────────────────────────────────────────────────────────
// getCommissionsPeriode — calcul 6.5%
// ────────────────────────────────────────────────────────────────
describe('getCommissionsPeriode — calcul commercial 6.5%', () => {

  test('Commission = base × taux / 100 arrondi à 2 décimales', async () => {
    const dossiers = [
      { dossier_id: 1, reference: 'ADM_00001', apprenant_nom: 'Dupont Marie',
        base_calcul: 1000.00, taux_base: 6.5, commission: 65.00 },
      { dossier_id: 2, reference: 'ADM_00002', apprenant_nom: 'Martin Jean',
        base_calcul: 1500.50, taux_base: 6.5, commission: round2(1500.50 * 0.065) },
    ];
    db.query.mockResolvedValue([dossiers]);

    const result = await CommissionModel.getCommissionsPeriode(1);

    expect(result.dossiers).toHaveLength(2);
    expect(result.total_base).toBeCloseTo(2500.50, 2);
    expect(result.total_commission).toBeCloseTo(
      dossiers.reduce((s, d) => s + d.commission, 0), 2
    );
    expect(result.taux_base).toBe(6.5);
  });

  test('Aucun dossier → totaux à zéro', async () => {
    db.query.mockResolvedValue([[]]);

    const result = await CommissionModel.getCommissionsPeriode(99);

    expect(result.dossiers).toHaveLength(0);
    expect(result.total_base).toBe(0);
    expect(result.total_commission).toBe(0);
    expect(result.taux_base).toBe(6.5); // valeur par défaut
  });

  test('Filtrage par mois passe le paramètre en SQL', async () => {
    db.query.mockResolvedValue([[]]);

    await CommissionModel.getCommissionsPeriode(1, '2026-03');

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('DATE_FORMAT');
    expect(params).toContain('2026-03');
  });
});

// ────────────────────────────────────────────────────────────────
// getCommissionsManager — calcul supplément équipe 1.5%
// ────────────────────────────────────────────────────────────────
describe('getCommissionsManager — supplément équipe', () => {

  function setupManagerMocks({ dossiersPropres = [], equipe = [], tauxSuppl = 1.5 } = {}) {
    // 1. getCommissionsPeriode (propre)
    db.query
      .mockResolvedValueOnce([dossiersPropres])              // dossiers propres
      // 2. SELECT agence_id du manager
      .mockResolvedValueOnce([[{ agence_id: 3 }]])
      // 3. SELECT equipe
      .mockResolvedValueOnce([equipe])
      // 4. SELECT taux_supplement_equipe
      .mockResolvedValueOnce([[{ taux_supplement_equipe: tauxSuppl }]]);
  }

  test('commission_totale = propre + supplément arrondi à 2 décimales', async () => {
    const equipe = [
      { vendeur_id: 2, vendeur_nom: 'A B', nb_dossiers: 3, base_calcul: 3000, taux_base: 6.5, commission: 195.00 },
      { vendeur_id: 3, vendeur_nom: 'C D', nb_dossiers: 2, base_calcul: 2000, taux_base: 6.5, commission: 130.00 },
    ];
    const dossiersPropres = [
      { dossier_id: 1, base_calcul: 1500, taux_base: 6.5, commission: 97.50 },
    ];

    setupManagerMocks({ dossiersPropres, equipe, tauxSuppl: 1.5 });

    const result = await CommissionModel.getCommissionsManager(10);

    expect(result).not.toBeNull();
    const totalEquipe = 195.00 + 130.00; // 325
    const supplement  = round2(totalEquipe * 1.5 / 100); // 4.88
    const propre      = round2(1500 * 6.5 / 100);        // 97.50
    const totaleAttendu = round2(propre + supplement);

    expect(result.totaux.commission_propre).toBeCloseTo(propre, 1);
    expect(result.totaux.supplement_equipe).toBeCloseTo(supplement, 1);
    expect(result.totaux.commission_totale).toBeCloseTo(totaleAttendu, 1);
  });

  test('Retourne null si manager introuvable', async () => {
    // getCommissionsPeriode → dossiers vides
    db.query
      .mockResolvedValueOnce([[]])          // dossiers propres
      .mockResolvedValueOnce([[]])          // pas de manager trouvé
      ;

    const result = await CommissionModel.getCommissionsManager(9999);
    expect(result).toBeNull();
  });

  test('Supplement = 0 si équipe sans dossiers', async () => {
    const equipe = [
      { vendeur_id: 2, commission: 0 },
    ];
    setupManagerMocks({ dossiersPropres: [], equipe, tauxSuppl: 1.5 });

    const result = await CommissionModel.getCommissionsManager(10);

    expect(result.totaux.supplement_equipe).toBe(0);
    expect(result.totaux.commission_totale).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────
// getTaux
// ────────────────────────────────────────────────────────────────
describe('getTaux', () => {

  test('Retourne un objet indexé par role_nom', async () => {
    db.query.mockResolvedValue([[
      { role_nom: 'commercial', taux_base: 6.5,  taux_supplement_equipe: 0 },
      { role_nom: 'manager',    taux_base: 6.5,  taux_supplement_equipe: 1.5 },
    ]]);

    const taux = await CommissionModel.getTaux();

    expect(taux.commercial).toBeDefined();
    expect(taux.commercial.taux_base).toBe(6.5);
    expect(taux.manager.taux_supplement_equipe).toBe(1.5);
  });
});

// ────────────────────────────────────────────────────────────────
// updateTaux
// ────────────────────────────────────────────────────────────────
describe('updateTaux', () => {

  test('Met à jour le taux et retourne true', async () => {
    db.query.mockResolvedValue([{ affectedRows: 1 }]);

    const ok = await CommissionModel.updateTaux('commercial', { taux_base: 7.0 });

    expect(ok).toBe(true);
    const [sql] = db.query.mock.calls[0];
    expect(sql).toContain('taux_base = ?');
  });

  test('Retourne false si aucun champ fourni', async () => {
    const ok = await CommissionModel.updateTaux('commercial', {});
    expect(ok).toBe(false);
    expect(db.query).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────
// isManager
// ────────────────────────────────────────────────────────────────
describe('isManager', () => {

  test('Retourne true pour un manager', async () => {
    db.query.mockResolvedValue([[{ nom: 'manager' }]]);
    expect(await CommissionModel.isManager(5)).toBe(true);
  });

  test('Retourne false pour un non-manager', async () => {
    db.query.mockResolvedValue([[]]); // aucune ligne
    expect(await CommissionModel.isManager(7)).toBe(false);
  });
});
