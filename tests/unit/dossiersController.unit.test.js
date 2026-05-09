'use strict';

/**
 * Tests unitaires complémentaires — DossiersController
 * Couvre les chemins non couverts dans les fichiers précédents :
 *  - buildRoleFilter (via list)
 *  - list, getOne
 *  - create (validation, création avec statut)
 *  - update
 *  - getEncaissements
 *  - getDossierNotes / addDossierNote
 */

jest.mock('../../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../../src/models/Dossier',  () => ({
  findAll:           jest.fn(),
  findById:          jest.fn(),
  create:            jest.fn(),
  update:            jest.fn(),
  canBeValidated:    jest.fn(),
  canBeArchived:     jest.fn(),
  getEncaissements:  jest.fn(),
  addEncaissement:   jest.fn(),
  getStatutPaiement: jest.requireActual('../../src/models/Dossier').getStatutPaiement,
}));
jest.mock('../../src/models/Log',  () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../../src/models/Tache',() => ({ createForDossier: jest.fn().mockResolvedValue({}) }));
jest.mock('../../src/services/importService', () => ({
  processGestion: jest.fn(),
  processEDOF:    jest.fn(),
  getHistory:     jest.fn(),
}));
jest.mock('../../src/utils/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
}));

const db                 = require('../../src/config/database');
const DossierModel       = require('../../src/models/Dossier');
const DossiersController = require('../../src/controllers/dossiersController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
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
// list — buildRoleFilter + pagination
// ─────────────────────────────────────────────────────────────────────────────
describe('DossiersController.list', () => {

  test('COMMERCIAL → filtre sur vendeur_id', async () => {
    DossierModel.findAll.mockResolvedValue({ dossiers: [], total: 0 });

    const req = mockReq({ user: mockUser({ id: 5, role_nom: 'commercial' }), query: {} });
    const res = mockRes();

    await DossiersController.list(req, res);

    expect(DossierModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ vendeur_id: 5 })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('MANAGER → filtre sur agence_id', async () => {
    DossierModel.findAll.mockResolvedValue({ dossiers: [], total: 0 });

    const req = mockReq({ user: mockUser({ id: 3, role_nom: 'manager', agence_id: 7 }), query: {} });
    const res = mockRes();

    await DossiersController.list(req, res);

    expect(DossierModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ agence_id: 7 })
    );
  });

  test('ROLE_ADMIN → pas de filtre rôle', async () => {
    DossierModel.findAll.mockResolvedValue({ dossiers: [{ id: 1 }], total: 1 });

    const req = mockReq({ user: mockUser({ role_nom: 'role_admin' }), query: {} });
    const res = mockRes();

    await DossiersController.list(req, res);

    const callArg = DossierModel.findAll.mock.calls[0][0];
    expect(callArg.vendeur_id).toBeUndefined();
    expect(callArg.agence_id).toBeUndefined();
  });

  test('Filtre frais_cma_paye=1 transmis correctement', async () => {
    DossierModel.findAll.mockResolvedValue({ dossiers: [], total: 0 });

    const req = mockReq({ query: { frais_cma_paye: '1' } });
    const res = mockRes();

    await DossiersController.list(req, res);

    expect(DossierModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ frais_cma_paye: true })
    );
  });

  test('Réponse inclut total et data', async () => {
    DossierModel.findAll.mockResolvedValue({ dossiers: [{ id: 1 }], total: 1 });

    const req = mockReq({ query: {} });
    const res = mockRes();

    await DossiersController.list(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.total).toBe(1);
    expect(body.data).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getOne
// ─────────────────────────────────────────────────────────────────────────────
describe('DossiersController.getOne', () => {

  test('Dossier inexistant → 404', async () => {
    DossierModel.findById.mockResolvedValue(null);

    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();

    await DossiersController.getOne(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('COMMERCIAL ne peut voir que ses propres dossiers → 403', async () => {
    DossierModel.findById.mockResolvedValue({ id: 1, vendeur_id: 9, financement_personnel: 0, total_encaisse: 0 });
    DossierModel.getEncaissements.mockResolvedValue([]);

    const req = mockReq({
      user:   mockUser({ id: 5, role_nom: 'commercial' }),
      params: { id: '1' },
    });
    const res = mockRes();

    await DossiersController.getOne(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('Dossier trouvé → 200 avec encaissements et statut_paiement', async () => {
    DossierModel.findById.mockResolvedValue({ id: 1, vendeur_id: 1, financement_personnel: 1000, total_encaisse: 500 });
    DossierModel.getEncaissements.mockResolvedValue([{ id: 1, montant: 500 }]);

    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();

    await DossiersController.getOne(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.data.encaissements).toBeDefined();
    expect(body.data.statut_paiement).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// create
// ─────────────────────────────────────────────────────────────────────────────
describe('DossiersController.create', () => {

  test('Nom manquant → 400 VALIDATION_ERROR', async () => {
    const req = mockReq({ body: { telephone: '0600' } });
    const res = mockRes();

    await DossiersController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('VALIDATION_ERROR');
  });

  test('Téléphone manquant → 400 VALIDATION_ERROR', async () => {
    const req = mockReq({ body: { nom: 'Dupont' } });
    const res = mockRes();

    await DossiersController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('Création réussie → 201 avec id et reference', async () => {
    // Body sans `statut` → seule la requête "Actif" est émise
    db.query.mockResolvedValueOnce([[{ id: 1 }]]); // SELECT statut "Actif"
    DossierModel.create.mockResolvedValue({ id: 42, reference: 'DOS-2026-0042' });

    const req = mockReq({ body: { nom: 'Dupont', telephone: '0600' } });
    const res = mockRes();

    await DossiersController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.data.id).toBe(42);
    expect(body.data.reference).toBe('DOS-2026-0042');
  });

  test('Vendeur_id par défaut = user.id si absent du body', async () => {
    // Body sans `statut` → seule la requête "Actif" est émise
    db.query.mockResolvedValueOnce([[{ id: 1 }]]); // SELECT statut "Actif"
    DossierModel.create.mockResolvedValue({ id: 10, reference: 'DOS-2026-0010' });

    const req = mockReq({
      user: mockUser({ id: 7 }),
      body: { nom: 'Test', telephone: '0600' },
    });
    const res = mockRes();

    await DossiersController.create(req, res);

    expect(DossierModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ vendeur_id: 7 })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// update
// ─────────────────────────────────────────────────────────────────────────────
describe('DossiersController.update', () => {

  test('Dossier inexistant → 404', async () => {
    DossierModel.findById.mockResolvedValue(null);

    const req = mockReq({ params: { id: '999' }, body: { nom: 'X' } });
    const res = mockRes();

    await DossiersController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('Mise à jour réussie → 200', async () => {
    DossierModel.findById.mockResolvedValue({ id: 1 });
    DossierModel.update.mockResolvedValue(true);

    const req = mockReq({ params: { id: '1' }, body: { nom: 'Dupont' } });
    const res = mockRes();

    await DossiersController.update(req, res);

    expect(DossierModel.update).toHaveBeenCalledWith(1, expect.objectContaining({ nom: 'Dupont' }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('Statut par nom résolu en statut_id', async () => {
    DossierModel.findById.mockResolvedValue({ id: 1 });
    DossierModel.update.mockResolvedValue(true);
    db.query.mockResolvedValueOnce([[{ id: 3 }]]);

    const req = mockReq({ params: { id: '1' }, body: { statut: 'En cours' } });
    const res = mockRes();

    await DossiersController.update(req, res);

    expect(DossierModel.update).toHaveBeenCalledWith(1, expect.objectContaining({ statut_id: 3 }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getEncaissements
// ─────────────────────────────────────────────────────────────────────────────
describe('DossiersController.getEncaissements', () => {

  test('Retourne les encaissements → 200', async () => {
    DossierModel.getEncaissements.mockResolvedValue([{ id: 1, montant: 500 }]);

    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();

    await DossiersController.getEncaissements(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addDossierNote
// ─────────────────────────────────────────────────────────────────────────────
describe('DossiersController.addDossierNote', () => {

  test('Contenu vide → 400', async () => {
    const req = mockReq({ params: { id: '1' }, body: { contenu: '' } });
    const res = mockRes();

    await DossiersController.addDossierNote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('Note ajoutée → 201', async () => {
    db.query.mockResolvedValueOnce([{ insertId: 5 }]);

    const req = mockReq({
      params: { id: '1' },
      body:   { contenu: 'Dossier prioritaire' },
    });
    const res = mockRes();

    await DossiersController.addDossierNote(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(db.query.mock.calls[0][0]).toContain('INSERT INTO interactions');
  });
});
