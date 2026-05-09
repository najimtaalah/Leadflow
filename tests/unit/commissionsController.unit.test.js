'use strict';

/**
 * Tests unitaires complémentaires — CommissionsController
 * Couvre les chemins non couverts dans commissionsGel.unit.test.js :
 *  - getMesCommissions (commercial vs manager)
 *  - getTaux
 *  - getCommissionsEquipe (manager limité à son agence)
 *  - getDetailManager (vérification rôle)
 */

jest.mock('../../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../../src/models/Commission', () => ({
  getTaux:               jest.fn(),
  updateTaux:            jest.fn(),
  getCommissions:        jest.fn(),
  getKpis:               jest.fn(),
  isManager:             jest.fn(),
  getCommissionsPeriode: jest.fn(),
  getCommissionsManager: jest.fn(),
  getHistoriqueMensuel:  jest.fn(),
}));
jest.mock('../../src/models/Log', () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../../src/utils/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
}));

const CommissionModel       = require('../../src/models/Commission');
const CommissionsController = require('../../src/controllers/commissionsController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}
function mockUser(overrides = {}) {
  return { id: 1, role_nom: 'commercial', agence_id: 1, ...overrides };
}
function mockReq(overrides = {}) {
  return { user: mockUser(), params: {}, query: {}, body: {}, ip: '127.0.0.1', ...overrides };
}

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
// getMesCommissions
// ─────────────────────────────────────────────────────────────────────────────
describe('getMesCommissions', () => {

  test('Commercial (non-manager) → retourne ses propres commissions', async () => {
    CommissionModel.isManager.mockResolvedValue(false);
    CommissionModel.getCommissionsPeriode.mockResolvedValue({
      dossiers: [], total_base: 0, total_commission: 0, taux_base: 6.5,
    });

    const req = mockReq({ user: mockUser({ id: 5, role_nom: 'commercial' }), query: {} });
    const res = mockRes();

    await CommissionsController.getMesCommissions(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].type).toBe('commercial');
    expect(CommissionModel.getCommissionsPeriode).toHaveBeenCalledWith(5, null);
  });

  test('Manager → retourne commissions manager', async () => {
    CommissionModel.isManager.mockResolvedValue(true);
    CommissionModel.getCommissionsManager.mockResolvedValue({
      manager: {}, equipe: {}, totaux: { commission_totale: 200 },
    });

    const req = mockReq({ user: mockUser({ id: 3, role_nom: 'manager' }), query: { mois: '2026-04' } });
    const res = mockRes();

    await CommissionsController.getMesCommissions(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].type).toBe('manager');
    expect(CommissionModel.getCommissionsManager).toHaveBeenCalledWith(3, '2026-04');
  });

  test('Filtre par mois passé en query param', async () => {
    CommissionModel.isManager.mockResolvedValue(false);
    CommissionModel.getCommissionsPeriode.mockResolvedValue({ dossiers: [], total_base: 0, total_commission: 0, taux_base: 6.5 });

    const req = mockReq({ user: mockUser({ id: 2 }), query: { mois: '2026-03' } });
    const res = mockRes();

    await CommissionsController.getMesCommissions(req, res);

    expect(CommissionModel.getCommissionsPeriode).toHaveBeenCalledWith(2, '2026-03');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getTaux
// ─────────────────────────────────────────────────────────────────────────────
describe('getTaux', () => {

  test('Retourne les taux actuels → 200', async () => {
    CommissionModel.getTaux.mockResolvedValue({
      commercial: { taux_base: 6.5, taux_supplement_equipe: 0 },
      manager:    { taux_base: 6.5, taux_supplement_equipe: 1.5 },
    });

    const req = mockReq();
    const res = mockRes();

    await CommissionsController.getTaux(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.commercial).toBeDefined();
  });

  test('Erreur DB → 500', async () => {
    CommissionModel.getTaux.mockRejectedValue(new Error('DB error'));

    const req = mockReq();
    const res = mockRes();

    await CommissionsController.getTaux(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getCommissionsEquipe
// ─────────────────────────────────────────────────────────────────────────────
describe('getCommissionsEquipe', () => {

  test('MANAGER → limité à son agence', async () => {
    CommissionModel.getCommissions.mockResolvedValue([]);
    CommissionModel.getKpis.mockResolvedValue({ nb_commerciaux: 0 });
    CommissionModel.getTaux.mockResolvedValue({});

    const req = mockReq({
      user:  mockUser({ id: 3, role_nom: 'manager', agence_id: 7 }),
      query: {},
    });
    const res = mockRes();

    await CommissionsController.getCommissionsEquipe(req, res);

    expect(CommissionModel.getCommissions).toHaveBeenCalledWith(
      expect.objectContaining({ agence_id: 7 })
    );
  });

  test('ROLE_ADMIN → peut voir toutes les agences', async () => {
    CommissionModel.getCommissions.mockResolvedValue([]);
    CommissionModel.getKpis.mockResolvedValue({});
    CommissionModel.getTaux.mockResolvedValue({});

    const req = mockReq({
      user:  mockUser({ id: 1, role_nom: 'role_admin', agence_id: 1 }),
      query: { agence_id: '5' },
    });
    const res = mockRes();

    await CommissionsController.getCommissionsEquipe(req, res);

    expect(CommissionModel.getCommissions).toHaveBeenCalledWith(
      expect.objectContaining({ agence_id: '5' })
    );
  });

  test('Réponse 200 avec data, kpis et taux', async () => {
    CommissionModel.getCommissions.mockResolvedValue([
      { vendeur_id: 1, role_nom: 'commercial', base_calcul: 1000 },
    ]);
    CommissionModel.getKpis.mockResolvedValue({ nb_commerciaux: 1 });
    CommissionModel.getTaux.mockResolvedValue({ commercial: { taux_base: 6.5 } });

    const req = mockReq({ user: mockUser({ role_nom: 'role_admin' }), query: {} });
    const res = mockRes();

    await CommissionsController.getCommissionsEquipe(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.data).toBeDefined();
    expect(body.kpis).toBeDefined();
    expect(body.taux).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getDetailManager
// ─────────────────────────────────────────────────────────────────────────────
describe('getDetailManager', () => {

  test('Utilisateur non-manager → 400', async () => {
    CommissionModel.isManager.mockResolvedValue(false);

    const req = mockReq({ params: { managerId: '5' }, query: {} });
    const res = mockRes();

    await CommissionsController.getDetailManager(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('MANAGER ne peut voir que son propre détail → 403 si autre id', async () => {
    CommissionModel.isManager.mockResolvedValue(true);

    const req = mockReq({
      user:   mockUser({ id: 3, role_nom: 'manager' }),
      params: { managerId: '9' },
      query:  {},
    });
    const res = mockRes();

    await CommissionsController.getDetailManager(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].code).toBe('FORBIDDEN');
  });

  test('Détail manager introuvable → 404', async () => {
    CommissionModel.isManager.mockResolvedValue(true);
    CommissionModel.getCommissionsManager.mockResolvedValue(null);

    const req = mockReq({
      user:   mockUser({ id: 1, role_nom: 'role_admin' }),
      params: { managerId: '5' },
      query:  {},
    });
    const res = mockRes();

    await CommissionsController.getDetailManager(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('Manager valide + admin → 200 avec détail', async () => {
    CommissionModel.isManager.mockResolvedValue(true);
    CommissionModel.getCommissionsManager.mockResolvedValue({
      manager: { commission_propre: 97.5 },
      equipe:  {},
      totaux:  { commission_totale: 100 },
    });

    const req = mockReq({
      user:   mockUser({ id: 1, role_nom: 'role_admin' }),
      params: { managerId: '5' },
      query:  {},
    });
    const res = mockRes();

    await CommissionsController.getDetailManager(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].success).toBe(true);
  });
});
