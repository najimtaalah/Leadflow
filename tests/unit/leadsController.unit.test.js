'use strict';

/**
 * Tests unitaires complémentaires — LeadsController
 * Couvre les chemins non couverts dans leadConversion.unit.test.js :
 *  - buildRoleFilter (via list)
 *  - list, getOne
 *  - create (validation, doublon, distribution)
 *  - webhook (doublon, création)
 *  - logInteraction, reassign, remove
 */

jest.mock('../../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../../src/models/Lead',     () => ({
  findById:              jest.fn(),
  findAll:               jest.fn(),
  update:                jest.fn(),
  create:                jest.fn(),
  checkDuplicate:        jest.fn(),
  createReassignation:   jest.fn(),
  getOriginalVendeur:    jest.fn(),
}));
jest.mock('../../src/models/Pipeline', () => ({ create: jest.fn().mockResolvedValue({}), findByLead: jest.fn() }));
jest.mock('../../src/models/Log',      () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../../src/services/distributionService', () => ({
  assignLead:         jest.fn(),
  reassignToOriginal: jest.fn(),
}));
jest.mock('../../src/utils/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
}));

const db                  = require('../../src/config/database');
const LeadModel           = require('../../src/models/Lead');
const PipelineModel       = require('../../src/models/Pipeline');
const DistributionService = require('../../src/services/distributionService');
const LeadsController     = require('../../src/controllers/leadsController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}
function mockUser(overrides = {}) {
  return { id: 1, role_nom: 'role_admin', agence_id: 1, ...overrides };
}
function mockReq(overrides = {}) {
  return { user: mockUser(), params: {}, query: {}, body: {}, ip: '127.0.0.1', ...overrides };
}

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
// list — buildRoleFilter selon le rôle
// ─────────────────────────────────────────────────────────────────────────────
describe('LeadsController.list — buildRoleFilter', () => {

  test('COMMERCIAL → filtre sur vendeur_id', async () => {
    LeadModel.findAll.mockResolvedValue({ leads: [], total: 0 });

    const req = mockReq({ user: mockUser({ id: 5, role_nom: 'commercial' }), query: {} });
    const res = mockRes();

    await LeadsController.list(req, res);

    expect(LeadModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ vendeur_id: 5 })
    );
  });

  test('MANAGER → filtre sur agence_id', async () => {
    LeadModel.findAll.mockResolvedValue({ leads: [], total: 0 });

    const req = mockReq({ user: mockUser({ id: 3, role_nom: 'manager', agence_id: 4 }), query: {} });
    const res = mockRes();

    await LeadsController.list(req, res);

    expect(LeadModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ agence_id: 4 })
    );
  });

  test('AGENT_ACCUEIL → filtre sur agence_id', async () => {
    LeadModel.findAll.mockResolvedValue({ leads: [], total: 0 });

    const req = mockReq({ user: mockUser({ role_nom: 'agent_accueil', agence_id: 9 }), query: {} });
    const res = mockRes();

    await LeadsController.list(req, res);

    expect(LeadModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ agence_id: 9 })
    );
  });

  test('ROLE_ADMIN → pas de filtre rôle', async () => {
    LeadModel.findAll.mockResolvedValue({ leads: [{ id: 1 }], total: 1 });

    const req = mockReq({ user: mockUser({ role_nom: 'role_admin' }), query: {} });
    const res = mockRes();

    await LeadsController.list(req, res);

    const callArg = LeadModel.findAll.mock.calls[0][0];
    expect(callArg.vendeur_id).toBeUndefined();
    expect(callArg.agence_id).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getOne
// ─────────────────────────────────────────────────────────────────────────────
describe('LeadsController.getOne', () => {

  test('Lead inexistant → 404', async () => {
    LeadModel.findById.mockResolvedValue(null);

    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();

    await LeadsController.getOne(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('COMMERCIAL → 403 pour lead d\'un autre commercial', async () => {
    LeadModel.findById.mockResolvedValue({ id: 1, vendeur_id: 9 });

    const req = mockReq({
      user:   mockUser({ id: 5, role_nom: 'commercial' }),
      params: { id: '1' },
    });
    const res = mockRes();

    await LeadsController.getOne(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].code).toBe('FORBIDDEN');
  });

  test('Lead trouvé → 200 avec historique', async () => {
    LeadModel.findById.mockResolvedValue({ id: 1, vendeur_id: 1 });
    PipelineModel.findByLead.mockResolvedValue([{ statut_avant: null, statut_apres: 'entrant' }]);

    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();

    await LeadsController.getOne(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.historique).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// create
// ─────────────────────────────────────────────────────────────────────────────
describe('LeadsController.create', () => {

  test('Nom manquant → 400 VALIDATION_ERROR', async () => {
    const req = mockReq({ body: { telephone: '0600' } });
    const res = mockRes();

    await LeadsController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('VALIDATION_ERROR');
  });

  test('Doublon détecté → 409 DUPLICATE_LEAD', async () => {
    LeadModel.checkDuplicate.mockResolvedValue({ id: 5, statut: 'entrant' });

    const req = mockReq({ body: { nom: 'Dupont', telephone: '0600', email: 'x@y.fr' } });
    const res = mockRes();

    await LeadsController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe('DUPLICATE_LEAD');
  });

  test('Création réussie avec assignation → 201 avec vendeur_id', async () => {
    LeadModel.checkDuplicate.mockResolvedValue(null);
    LeadModel.create.mockResolvedValue(42);
    PipelineModel.create.mockResolvedValue({});
    DistributionService.assignLead.mockResolvedValue(7);

    const req = mockReq({ body: { nom: 'Dupont', telephone: '0600' } });
    const res = mockRes();

    await LeadsController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.data.id).toBe(42);
    expect(body.data.vendeur_id).toBe(7);
    expect(body.message).toContain('assigné');
  });

  test('Aucun commercial disponible → 201 avec message assignation manuelle', async () => {
    LeadModel.checkDuplicate.mockResolvedValue(null);
    LeadModel.create.mockResolvedValue(43);
    PipelineModel.create.mockResolvedValue({});
    DistributionService.assignLead.mockResolvedValue(null);

    const req = mockReq({ body: { nom: 'Martin', telephone: '0611' } });
    const res = mockRes();

    await LeadsController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].message).toContain('manuelle');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// webhook
// ─────────────────────────────────────────────────────────────────────────────
describe('LeadsController.webhook', () => {

  test('nom manquant → 400', async () => {
    const req = mockReq({ body: { telephone: '0600' } });
    const res = mockRes();

    await LeadsController.webhook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('Doublon webhook → 200 avec DUPLICATE_DETECTED (pas 409)', async () => {
    db.query.mockResolvedValueOnce([[{ id: 99 }]]);  // source_row
    LeadModel.checkDuplicate.mockResolvedValue({ id: 5, statut: 'entrant' });

    const req = mockReq({ body: { nom: 'Dupont', telephone: '0600', email: 'x@y.fr' } });
    const res = mockRes();

    await LeadsController.webhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].code).toBe('DUPLICATE_DETECTED');
  });

  test('Lead nouveau via webhook → 200 avec id', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1 }]]);
    LeadModel.checkDuplicate.mockResolvedValue(null);
    LeadModel.create.mockResolvedValue(55);
    PipelineModel.create.mockResolvedValue({});
    DistributionService.assignLead.mockResolvedValue(3);

    const req = mockReq({ body: { nom: 'Nouveau', telephone: '0622', source: 'Meta Ads' } });
    const res = mockRes();

    await LeadsController.webhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.id).toBe(55);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// logInteraction
// ─────────────────────────────────────────────────────────────────────────────
describe('LeadsController.logInteraction', () => {

  test('Type invalide → 400', async () => {
    const req = mockReq({ params: { id: '1' }, body: { type: 'pigeon' } });
    const res = mockRes();

    await LeadsController.logInteraction(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('Lead inexistant → 404', async () => {
    LeadModel.findById.mockResolvedValue(null);

    const req = mockReq({ params: { id: '999' }, body: { type: 'appel' } });
    const res = mockRes();

    await LeadsController.logInteraction(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('COMMERCIAL ne peut pas interagir avec les leads des autres → 403', async () => {
    LeadModel.findById.mockResolvedValue({ id: 1, vendeur_id: 9 });

    const req = mockReq({
      user:   mockUser({ id: 5, role_nom: 'commercial' }),
      params: { id: '1' },
      body:   { type: 'appel' },
    });
    const res = mockRes();

    await LeadsController.logInteraction(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('Interaction enregistrée → 201', async () => {
    LeadModel.findById.mockResolvedValue({ id: 1, vendeur_id: 1 });
    db.query.mockResolvedValueOnce([{ insertId: 77 }]);

    const req = mockReq({
      params: { id: '1' },
      body:   { type: 'appel', contenu: 'Premier contact', duree: 120 },
    });
    const res = mockRes();

    await LeadsController.logInteraction(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].data.id).toBe(77);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// reassign
// ─────────────────────────────────────────────────────────────────────────────
describe('LeadsController.reassign', () => {

  test('vendeur_id manquant → 400', async () => {
    const req = mockReq({ params: { id: '1' }, body: {} });
    const res = mockRes();

    await LeadsController.reassign(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('Lead inexistant → 404', async () => {
    LeadModel.findById.mockResolvedValue(null);

    const req = mockReq({ params: { id: '999' }, body: { vendeur_id: 3 } });
    const res = mockRes();

    await LeadsController.reassign(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('Commercial inactif → 400', async () => {
    LeadModel.findById.mockResolvedValue({ id: 1, vendeur_id: 5 });
    db.query.mockResolvedValueOnce([[{ id: 3, actif: 0 }]]);

    const req = mockReq({ params: { id: '1' }, body: { vendeur_id: 3 } });
    const res = mockRes();

    await LeadsController.reassign(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('Réassignation réussie → 200', async () => {
    LeadModel.findById.mockResolvedValue({ id: 1, vendeur_id: 5 });
    db.query.mockResolvedValueOnce([[{ id: 3, actif: 1 }]]);
    LeadModel.update.mockResolvedValue(true);
    LeadModel.createReassignation.mockResolvedValue({});

    const req = mockReq({ params: { id: '1' }, body: { vendeur_id: 3, motif: 'test' } });
    const res = mockRes();

    await LeadsController.reassign(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(LeadModel.createReassignation).toHaveBeenCalledWith(
      expect.objectContaining({ nouveau_vendeur_id: 3 })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// remove
// ─────────────────────────────────────────────────────────────────────────────
describe('LeadsController.remove', () => {

  test('Lead inexistant → 404', async () => {
    db.query.mockResolvedValueOnce([[]]); // pas de résultat

    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();

    await LeadsController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('Suppression réussie → 200', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, nom: 'Dupont', prenom: 'Marie' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();

    await LeadsController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
