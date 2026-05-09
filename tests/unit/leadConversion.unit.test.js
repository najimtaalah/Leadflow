'use strict';

/**
 * Tests unitaires — Service de conversion lead → pré-dossier (UC-08 / UC-09)
 * Couvre :
 *  - _createDossier : création automatique de dossier quand statut = 'gagne'
 *  - buildRoleFilter : filtrage selon le rôle (via LeadsController.list)
 *  - updateStatut : transitions de statuts, auto-création dossier, auto-réaffectation
 */

jest.mock('../../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../../src/models/Lead',     () => ({ findById: jest.fn(), update: jest.fn(), checkDuplicate: jest.fn(), findAll: jest.fn(), createReassignation: jest.fn(), getOriginalVendeur: jest.fn() }));
jest.mock('../../src/models/Pipeline', () => ({ create: jest.fn(), findByLead: jest.fn() }));
jest.mock('../../src/models/Log',      () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../../src/services/distributionService', () => ({
  assignLead:          jest.fn(),
  reassignToOriginal:  jest.fn(),
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
const { STATUTS_LEAD, STATUTS_REASSIGN } = require('../../src/constants');

// ── Helpers ──────────────────────────────────────────────────────────────────

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
// _createDossier — création automatique depuis lead gagné
// ─────────────────────────────────────────────────────────────────────────────
describe('LeadsController._createDossier', () => {

  const fakeLead = {
    id: 10, nom: 'Dupont', prenom: 'Marie', telephone: '0600000000',
    email: 'marie@test.fr', formation_souhaitee: 'CMA Pratique',
    agence_id: 2, vendeur_id: 5,
  };

  test('Insère un dossier et retourne son id', async () => {
    db.query.mockResolvedValue([{ insertId: 42 }]);

    const dossierId = await LeadsController._createDossier(fakeLead, 1);

    expect(dossierId).toBe(42);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO dossiers');
    expect(params).toContain(fakeLead.id);
    expect(params).toContain(fakeLead.nom);
    expect(params).toContain(fakeLead.vendeur_id);
  });

  test('Retourne null et log si la requête DB échoue', async () => {
    db.query.mockRejectedValue(new Error('DB down'));

    const dossierId = await LeadsController._createDossier(fakeLead, 1);

    expect(dossierId).toBeNull();
  });

  test('Hérite le vendeur_id du lead dans le dossier créé', async () => {
    db.query.mockResolvedValue([{ insertId: 77 }]);

    await LeadsController._createDossier({ ...fakeLead, vendeur_id: 99 }, 1);

    const params = db.query.mock.calls[0][1];
    expect(params).toContain(99); // vendeur_id
  });

  test('Hérite le lead_id dans le dossier créé', async () => {
    db.query.mockResolvedValue([{ insertId: 11 }]);

    await LeadsController._createDossier({ ...fakeLead, id: 55 }, 1);

    const params = db.query.mock.calls[0][1];
    expect(params[0]).toBe(55); // lead.id est le premier paramètre
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateStatut — validation du statut
// ─────────────────────────────────────────────────────────────────────────────
describe('updateStatut — validation statut', () => {

  test('Statut invalide → 400 VALIDATION_ERROR', async () => {
    const req = mockReq({ params: { id: '1' }, body: { statut: 'fantome' } });
    const res = mockRes();

    await LeadsController.updateStatut(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  test('Statut manquant → 400', async () => {
    const req = mockReq({ params: { id: '1' }, body: {} });
    const res = mockRes();

    await LeadsController.updateStatut(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('Lead introuvable → 404', async () => {
    LeadModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: '1' }, body: { statut: 'contacte' } });
    const res = mockRes();

    await LeadsController.updateStatut(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('COMMERCIAL ne peut modifier que ses propres leads → 403', async () => {
    LeadModel.findById.mockResolvedValue({ id: 1, vendeur_id: 9, statut: 'entrant' });
    const req = mockReq({
      user:   mockUser({ id: 5, role_nom: 'commercial' }),
      params: { id: '1' },
      body:   { statut: 'contacte' },
    });
    const res = mockRes();

    await LeadsController.updateStatut(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateStatut — conversion GAGNE → création dossier automatique
// ─────────────────────────────────────────────────────────────────────────────
describe('updateStatut — statut GAGNE crée un dossier', () => {

  beforeEach(() => {
    LeadModel.findById.mockResolvedValue({
      id: 1, vendeur_id: 5, statut: 'qualifie',
      nom: 'Test', prenom: 'Lead', telephone: '0600',
      email: null, formation_souhaitee: null, agence_id: 1,
    });
    LeadModel.update.mockResolvedValue(true);
    PipelineModel.create.mockResolvedValue({});
    db.query.mockResolvedValue([{ insertId: 42 }]);
  });

  test('Statut = gagne → actions_auto contient dossier_cree', async () => {
    const req = mockReq({ params: { id: '1' }, body: { statut: STATUTS_LEAD.GAGNE } });
    const res = mockRes();

    await LeadsController.updateStatut(req, res);

    const body = res.json.mock.calls[0][0];
    expect(res.status).toHaveBeenCalledWith(200);
    expect(body.actions_auto).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'dossier_cree' })])
    );
    expect(body.dossier_id).toBe(42);
  });

  test('Statut = gagne → dossier_id retourné dans la réponse', async () => {
    const req = mockReq({ params: { id: '1' }, body: { statut: STATUTS_LEAD.GAGNE } });
    const res = mockRes();

    await LeadsController.updateStatut(req, res);

    expect(res.json.mock.calls[0][0].dossier_id).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateStatut — PERDU/ANNULE → réaffectation automatique (UC-09)
// ─────────────────────────────────────────────────────────────────────────────
describe('updateStatut — PERDU/ANNULE déclenche réaffectation', () => {

  const fakeLead = {
    id: 1, vendeur_id: 5, statut: 'qualifie',
    nom: 'Test', prenom: 'Lead', telephone: '0600',
    email: null, formation_souhaitee: null, agence_id: 1,
  };

  beforeEach(() => {
    LeadModel.findById.mockResolvedValue(fakeLead);
    LeadModel.update.mockResolvedValue(true);
    PipelineModel.create.mockResolvedValue({});
    db.query.mockResolvedValue([{ insertId: 0 }]);
  });

  test.each(STATUTS_REASSIGN)('Statut = %s → reassignToOriginal appelé', async (statut) => {
    DistributionService.reassignToOriginal.mockResolvedValue(11);

    const req = mockReq({ params: { id: '1' }, body: { statut } });
    const res = mockRes();

    await LeadsController.updateStatut(req, res);

    expect(DistributionService.reassignToOriginal).toHaveBeenCalledWith(1, 5, 1);
    const body = res.json.mock.calls[0][0];
    expect(body.actions_auto).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'reassigne', nouveau_vendeur_id: 11 })])
    );
  });

  test('Commercial inactif → action reassign_echec dans la réponse', async () => {
    DistributionService.reassignToOriginal.mockResolvedValue(null);

    const req = mockReq({ params: { id: '1' }, body: { statut: STATUTS_LEAD.PERDU } });
    const res = mockRes();

    await LeadsController.updateStatut(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.actions_auto).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'reassign_echec' })])
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateStatut — pipeline_historique enregistré
// ─────────────────────────────────────────────────────────────────────────────
describe('updateStatut — enregistre la transition dans pipeline_historique', () => {

  test('PipelineModel.create appelé avec statut_avant et statut_apres', async () => {
    LeadModel.findById.mockResolvedValue({ id: 1, vendeur_id: 1, statut: 'entrant' });
    LeadModel.update.mockResolvedValue(true);
    PipelineModel.create.mockResolvedValue({});
    db.query.mockResolvedValue([{ insertId: 0 }]);

    const req = mockReq({ params: { id: '1' }, body: { statut: 'contacte', notes: 'Premier appel' } });
    const res = mockRes();

    await LeadsController.updateStatut(req, res);

    expect(PipelineModel.create).toHaveBeenCalledWith(expect.objectContaining({
      lead_id:      1,
      statut_avant: 'entrant',
      statut_apres: 'contacte',
    }));
  });
});
