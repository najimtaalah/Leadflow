'use strict';

/**
 * Tests unitaires — Service de calcul et de figeage des commissions (UC-39 / UC-40 / UC-43)
 *
 * Couvre :
 *  - CommissionsController.updateTaux : validation des taux, rôle invalide, supplément manager
 *  - CommissionsController.exportHistorique : contrôle accès commercial, cumul des totaux
 *  - CommissionsController.simulerTaux : simulation commerciaux + managers sans persistance
 *  - CommissionModel.getHistoriqueMensuel : requête SQL avec nb_mois
 */

jest.mock('../../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../../src/models/Commission', () => ({
  getTaux:              jest.fn(),
  updateTaux:           jest.fn(),
  getCommissions:       jest.fn(),
  getKpis:              jest.fn(),
  isManager:            jest.fn(),
  getCommissionsPeriode: jest.fn(),
  getCommissionsManager: jest.fn(),
  getHistoriqueMensuel: jest.fn(),
}));
jest.mock('../../src/models/Log', () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../../src/utils/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
}));

const db                    = require('../../src/config/database');
const CommissionModel       = require('../../src/models/Commission');
const CommissionsController = require('../../src/controllers/commissionsController');

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

function mockUser(overrides = {}) {
  return { id: 1, role_nom: 'super_admin', agence_id: 1, ...overrides };
}

function mockReq(overrides = {}) {
  return { user: mockUser(), params: {}, query: {}, body: {}, ip: '127.0.0.1', ...overrides };
}

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
// CommissionsController.updateTaux — validation des paramètres
// ─────────────────────────────────────────────────────────────────────────────
describe('updateTaux — validation des paramètres', () => {

  test('role_nom manquant → 400', async () => {
    const req = mockReq({ body: { taux_base: 7.0 } });
    const res = mockRes();

    await CommissionsController.updateTaux(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('role_nom invalide → 400 (seuls commercial et manager acceptés)', async () => {
    const req = mockReq({ body: { role_nom: 'super_admin', taux_base: 7.0 } });
    const res = mockRes();

    await CommissionsController.updateTaux(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('taux_base négatif → 400 VALIDATION_ERROR', async () => {
    const req = mockReq({ body: { role_nom: 'commercial', taux_base: -1 } });
    const res = mockRes();

    await CommissionsController.updateTaux(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('VALIDATION_ERROR');
    expect(res.json.mock.calls[0][0].errors).toEqual(
      expect.arrayContaining([expect.stringContaining('>= 0')])
    );
  });

  test('taux_base > 100 → 400 VALIDATION_ERROR', async () => {
    const req = mockReq({ body: { role_nom: 'commercial', taux_base: 101 } });
    const res = mockRes();

    await CommissionsController.updateTaux(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].errors).toEqual(
      expect.arrayContaining([expect.stringContaining('100%')])
    );
  });

  test('taux_supplement_equipe > 0 pour le rôle commercial → 400', async () => {
    const req = mockReq({
      body: { role_nom: 'commercial', taux_base: 7.0, taux_supplement_equipe: 1.5 },
    });
    const res = mockRes();

    await CommissionsController.updateTaux(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const errors = res.json.mock.calls[0][0].errors;
    expect(errors).toEqual(
      expect.arrayContaining([expect.stringContaining('manager')])
    );
  });

  test('taux_supplement_equipe pour manager → accepté', async () => {
    CommissionModel.getTaux
      .mockResolvedValueOnce({ manager: { taux_base: 6.5, taux_supplement_equipe: 1.5 } })
      .mockResolvedValueOnce({ manager: { taux_base: 6.5, taux_supplement_equipe: 2.0 } });
    CommissionModel.updateTaux.mockResolvedValue(true);

    const req = mockReq({
      body: { role_nom: 'manager', taux_supplement_equipe: 2.0 },
    });
    const res = mockRes();

    await CommissionsController.updateTaux(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(CommissionModel.updateTaux).toHaveBeenCalledWith('manager', {
      taux_base:              undefined,
      taux_supplement_equipe: 2.0,
    });
  });

  test('Mise à jour valide commercial → 200 avec nouveaux taux', async () => {
    CommissionModel.getTaux
      .mockResolvedValueOnce({ commercial: { taux_base: 6.5 } })
      .mockResolvedValueOnce({ commercial: { taux_base: 7.0 } });
    CommissionModel.updateTaux.mockResolvedValue(true);

    const req = mockReq({ body: { role_nom: 'commercial', taux_base: 7.0 } });
    const res = mockRes();

    await CommissionsController.updateTaux(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].success).toBe(true);
    expect(CommissionModel.updateTaux).toHaveBeenCalledWith('commercial', {
      taux_base: 7.0,
      taux_supplement_equipe: undefined,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CommissionsController.exportHistorique — figeage / export UC-40
// ─────────────────────────────────────────────────────────────────────────────
describe('exportHistorique — figeage des commissions', () => {

  const historique = [
    { mois: '2026-01', nb_dossiers: 3, base_calcul: 3000, commission: 195 },
    { mois: '2026-02', nb_dossiers: 2, base_calcul: 2000, commission: 130 },
    { mois: '2026-03', nb_dossiers: 4, base_calcul: 4000, commission: 260 },
  ];

  test('COMMERCIAL ne peut exporter que ses propres données → 403 si autre vendeur_id', async () => {
    const req = mockReq({
      user:   mockUser({ id: 5, role_nom: 'commercial' }),
      params: { vendeurId: '9' },  // autre commercial
    });
    const res = mockRes();

    await CommissionsController.exportHistorique(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].code).toBe('FORBIDDEN');
  });

  test('COMMERCIAL peut exporter ses propres commissions', async () => {
    CommissionModel.getHistoriqueMensuel.mockResolvedValue(historique);

    const req = mockReq({
      user:   mockUser({ id: 5, role_nom: 'commercial' }),
      params: { vendeurId: '5' },
      query:  { mois: '12' },
    });
    const res = mockRes();

    await CommissionsController.exportHistorique(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(CommissionModel.getHistoriqueMensuel).toHaveBeenCalledWith(5, 12);
  });

  test('Totaux agrégés correctement (base et commissions)', async () => {
    CommissionModel.getHistoriqueMensuel.mockResolvedValue(historique);

    const req = mockReq({
      user:   mockUser({ id: 1, role_nom: 'role_admin' }),
      params: { vendeurId: '5' },
      query:  {},
    });
    const res = mockRes();

    await CommissionsController.exportHistorique(req, res);

    const { totaux } = res.json.mock.calls[0][0].data;
    expect(totaux.base_calcul).toBeCloseTo(9000, 2);
    expect(totaux.total_commissions).toBeCloseTo(585, 2);
  });

  test('Paramètre mois par défaut = 12 si absent', async () => {
    CommissionModel.getHistoriqueMensuel.mockResolvedValue([]);

    const req = mockReq({
      user:   mockUser({ id: 1, role_nom: 'role_admin' }),
      params: { vendeurId: '5' },
      query:  {},
    });
    const res = mockRes();

    await CommissionsController.exportHistorique(req, res);

    expect(CommissionModel.getHistoriqueMensuel).toHaveBeenCalledWith(5, 12);
  });

  test('Export vide → totaux à zéro', async () => {
    CommissionModel.getHistoriqueMensuel.mockResolvedValue([]);

    const req = mockReq({
      user:   mockUser({ id: 1, role_nom: 'role_admin' }),
      params: { vendeurId: '5' },
      query:  {},
    });
    const res = mockRes();

    await CommissionsController.exportHistorique(req, res);

    const { totaux } = res.json.mock.calls[0][0].data;
    expect(totaux.base_calcul).toBe(0);
    expect(totaux.total_commissions).toBe(0);
  });

  test('Réponse contient nb_mois, vendeur_id, generated_at', async () => {
    CommissionModel.getHistoriqueMensuel.mockResolvedValue(historique);

    const req = mockReq({
      user:   mockUser({ id: 1, role_nom: 'role_admin' }),
      params: { vendeurId: '5' },
      query:  { mois: '6' },
    });
    const res = mockRes();

    await CommissionsController.exportHistorique(req, res);

    const { data } = res.json.mock.calls[0][0];
    expect(data.vendeur_id).toBe(5);
    expect(data.nb_mois).toBe(6);
    expect(data.generated_at).toBeDefined();
    expect(data.historique).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CommissionsController.simulerTaux — simulation sans persistance (UC-43)
// ─────────────────────────────────────────────────────────────────────────────
describe('simulerTaux — simulation commissions sans modifier les taux', () => {

  const commerciaux = [
    { vendeur_id: 1, vendeur_nom: 'Alice M.', role_nom: 'commercial', agence_id: 1, base_calcul: 3000, commission_totale: 195 },
    { vendeur_id: 2, vendeur_nom: 'Bob D.',   role_nom: 'commercial', agence_id: 1, base_calcul: 2000, commission_totale: 130 },
  ];

  const managers = [
    { vendeur_id: 3, vendeur_nom: 'Claire F.', role_nom: 'manager', agence_id: 1, base_calcul: 1500, commission_totale: 97.5 },
  ];

  test('Simulation commercial : commission = base × taux', async () => {
    CommissionModel.getCommissions.mockResolvedValue(commerciaux);

    const req = mockReq({ query: { taux_commercial: '7', taux_supplement_manager: '1.5' } });
    const res = mockRes();

    await CommissionsController.simulerTaux(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.simulation).toBe(true);

    const alice = body.data.find(d => d.vendeur_id === 1);
    expect(alice.simule.commission_base).toBeCloseTo(3000 * 7 / 100, 2); // 210
    expect(alice.simule.supplement).toBe(0);
    expect(alice.simule.total).toBeCloseTo(210, 2);
  });

  test('Simulation manager : commission propre + supplément équipe', async () => {
    const tous = [...commerciaux, ...managers];
    CommissionModel.getCommissions.mockResolvedValue(tous);

    const req = mockReq({ query: { taux_commercial: '6.5', taux_supplement_manager: '2' } });
    const res = mockRes();

    await CommissionsController.simulerTaux(req, res);

    const claire = res.json.mock.calls[0][0].data.find(d => d.vendeur_id === 3);
    const totalEquipeSimule = (3000 * 6.5 / 100) + (2000 * 6.5 / 100); // 195 + 130 = 325
    const suppl = Math.round(totalEquipeSimule * 2 / 100 * 100) / 100;  // 6.5
    const propre = Math.round(1500 * 6.5 / 100 * 100) / 100;           // 97.5

    expect(claire.simule.supplement).toBeCloseTo(suppl, 1);
    expect(claire.simule.commission_base).toBeCloseTo(propre, 1);
    expect(claire.simule.total).toBeCloseTo(propre + suppl, 1);
  });

  test('Simulation avec taux par défaut (6.5% / 1.5%) si paramètres absents', async () => {
    CommissionModel.getCommissions.mockResolvedValue(commerciaux);

    const req = mockReq({ query: {} });
    const res = mockRes();

    await CommissionsController.simulerTaux(req, res);

    const alice = res.json.mock.calls[0][0].data.find(d => d.vendeur_id === 1);
    expect(alice.simule.taux_com).toBe(6.5);
    expect(alice.simule.commission_base).toBeCloseTo(3000 * 6.5 / 100, 2);
  });

  test('Simulation ne modifie aucun taux — CommissionModel.updateTaux non appelé', async () => {
    CommissionModel.getCommissions.mockResolvedValue(commerciaux);

    const req = mockReq({ query: { taux_commercial: '8' } });
    const res = mockRes();

    await CommissionsController.simulerTaux(req, res);

    expect(CommissionModel.updateTaux).not.toHaveBeenCalled();
  });

  test('Réponse indique simulation=true avec note explicative', async () => {
    CommissionModel.getCommissions.mockResolvedValue([]);

    const req = mockReq({ query: {} });
    const res = mockRes();

    await CommissionsController.simulerTaux(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.simulation).toBe(true);
    expect(body.note).toContain('simulation');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Contrôle des appels à CommissionModel.getHistoriqueMensuel
// (comportement du contrôleur, pas requête SQL directe)
// ─────────────────────────────────────────────────────────────────────────────
describe('exportHistorique — appels à getHistoriqueMensuel', () => {

  test('Appel avec vendeurId issu de params.vendeurId (admin)', async () => {
    CommissionModel.getHistoriqueMensuel.mockResolvedValue([]);

    const req = mockReq({
      user:   mockUser({ id: 1, role_nom: 'role_admin' }),
      params: { vendeurId: '7' },
      query:  { mois: '3' },
    });
    const res = mockRes();

    await CommissionsController.exportHistorique(req, res);

    expect(CommissionModel.getHistoriqueMensuel).toHaveBeenCalledWith(7, 3);
  });

  test('Sans params.vendeurId, utilise l\'id de l\'utilisateur connecté', async () => {
    CommissionModel.getHistoriqueMensuel.mockResolvedValue([]);

    const req = mockReq({
      user:   mockUser({ id: 42, role_nom: 'role_admin' }),
      params: {},
      query:  {},
    });
    const res = mockRes();

    await CommissionsController.exportHistorique(req, res);

    expect(CommissionModel.getHistoriqueMensuel).toHaveBeenCalledWith(42, 12);
  });
});
