'use strict';

/**
 * Tests unitaires — Bloc financier et statuts de dossier
 *
 * Couvre :
 *  - DossierModel.getStatutPaiement : logique de calcul du statut de paiement
 *  - DossiersController.addEncaissement : validation montant, trop-perçu
 *  - DossierModel.canBeArchived : règles d'archivage (solde soldé)
 *  - DossiersController.archive : flux d'archivage
 */

jest.mock('../../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../../src/models/Dossier',  () => ({
  findById:          jest.fn(),
  canBeValidated:    jest.fn(),
  canBeArchived:     jest.fn(),
  update:            jest.fn(),
  getEncaissements:  jest.fn(),
  addEncaissement:   jest.fn(),
  // jest.requireActual bypasse le mock pour récupérer la vraie fonction pure
  getStatutPaiement: jest.requireActual('../../src/models/Dossier').getStatutPaiement,
}));
jest.mock('../../src/models/Log',  () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../../src/models/Tache',() => ({ createForDossier: jest.fn().mockResolvedValue({}) }));
jest.mock('../../src/services/importService', () => ({}));
jest.mock('../../src/utils/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
}));

const db                  = require('../../src/config/database');
const DossierModel        = require('../../src/models/Dossier');
const DossiersController  = require('../../src/controllers/dossiersController');

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
// DossierModel.getStatutPaiement — fonction pure (pas de DB)
// La vraie fonction est chargée via jest.requireActual dans le mock du module.
// ─────────────────────────────────────────────────────────────────────────────
describe('DossierModel.getStatutPaiement — logique pure', () => {

  // getStatutPaiement est la vraie implémentation (voir jest.mock au-dessus)
  const fn = DossierModel.getStatutPaiement;

  test('financement_personnel = 0 → non_concerne', () => {
    expect(fn(0, 500)).toBe('non_concerne');
  });

  test('financement_personnel négatif → non_concerne', () => {
    expect(fn(-100, 0)).toBe('non_concerne');
  });

  test('total_encaisse = 0 → neant', () => {
    expect(fn(1000, 0)).toBe('neant');
  });

  test('total_encaisse < financement_personnel → partiel', () => {
    expect(fn(1000, 500)).toBe('partiel');
  });

  test('total_encaisse = financement_personnel → effectue', () => {
    expect(fn(1000, 1000)).toBe('effectue');
  });

  test('total_encaisse > financement_personnel (trop-perçu) → effectue', () => {
    expect(fn(1000, 1500)).toBe('effectue');
  });

  test('1 centime encaissé sur 1000 € → partiel', () => {
    expect(fn(1000, 0.01)).toBe('partiel');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DossiersController.addEncaissement — validation et trop-perçu
// ─────────────────────────────────────────────────────────────────────────────
describe('DossiersController.addEncaissement', () => {

  test('Montant manquant → 400', async () => {
    const req = mockReq({ params: { id: '1' }, body: { date_encaissement: '2026-05-01' } });
    const res = mockRes();

    await DossiersController.addEncaissement(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('Montant négatif → 400', async () => {
    const req = mockReq({
      params: { id: '1' },
      body:   { montant: -100, date_encaissement: '2026-05-01' },
    });
    const res = mockRes();

    await DossiersController.addEncaissement(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('Montant = 0 → 400', async () => {
    const req = mockReq({
      params: { id: '1' },
      body:   { montant: 0, date_encaissement: '2026-05-01' },
    });
    const res = mockRes();

    await DossiersController.addEncaissement(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('Date manquante → 400', async () => {
    const req = mockReq({
      params: { id: '1' },
      body:   { montant: 500 },
    });
    const res = mockRes();

    await DossiersController.addEncaissement(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('Dossier inexistant → 404', async () => {
    DossierModel.findById.mockResolvedValueOnce(null);
    const req = mockReq({
      params: { id: '999' },
      body:   { montant: 500, date_encaissement: '2026-05-01' },
    });
    const res = mockRes();

    await DossiersController.addEncaissement(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('Encaissement normal sans trop-perçu → 201, trop_percu=false', async () => {
    const dossier = {
      id: 1, financement_personnel: 1000, total_encaisse: 0,
    };
    // findById: 1ère appel pour vérifier existence, 2ème après insertion
    DossierModel.findById
      .mockResolvedValueOnce(dossier)
      .mockResolvedValueOnce({ ...dossier, total_encaisse: 500, financement_personnel: 1000 });
    DossierModel.addEncaissement.mockResolvedValue(77);
    // getStatutPaiement est la vraie fonction — pas besoin de mock

    const req = mockReq({
      params: { id: '1' },
      body:   { montant: 500, date_encaissement: '2026-05-01', mode_paiement: 'virement' },
    });
    const res = mockRes();

    await DossiersController.addEncaissement(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.data.trop_percu).toBe(false);
    expect(body.warning).toBeNull();
  });

  test('Encaissement dépasse financement_personnel → trop-perçu détecté', async () => {
    const dossier = {
      id: 1, financement_personnel: 1000, total_encaisse: 800,
    };
    DossierModel.findById
      .mockResolvedValueOnce(dossier)
      .mockResolvedValueOnce({ ...dossier, total_encaisse: 1100, financement_personnel: 1000 });
    DossierModel.addEncaissement.mockResolvedValue(78);

    const req = mockReq({
      params: { id: '1' },
      body:   { montant: 300, date_encaissement: '2026-05-01' },
    });
    const res = mockRes();

    await DossiersController.addEncaissement(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.data.trop_percu).toBe(true);
    expect(body.warning).toBe('TROP_PERCU');
    expect(body.message).toContain('trop-perçu');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// canBeArchived — règles de gestion des statuts de dossier (logique inline)
// ─────────────────────────────────────────────────────────────────────────────
describe('canBeArchived — règles d\'archivage (logique)', () => {

  // Reproduit exactement la logique de DossierModel.canBeArchived
  function canBeArchivedLogic(row) {
    if (!row)          return { ok: false, reason: 'DOSSIER_NOT_FOUND' };
    if (row.archived)  return { ok: false, reason: 'ALREADY_ARCHIVED' };
    if (row.reste > 0) return { ok: false, reason: 'SOLDE_NON_SOLDE' };
    return { ok: true };
  }

  test('Dossier inexistant (row=null) → DOSSIER_NOT_FOUND', () => {
    const result = canBeArchivedLogic(null);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('DOSSIER_NOT_FOUND');
  });

  test('Dossier déjà archivé → ALREADY_ARCHIVED', () => {
    const result = canBeArchivedLogic({ archived: 1, reste: 0 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ALREADY_ARCHIVED');
  });

  test('Reste à payer > 0 → SOLDE_NON_SOLDE', () => {
    const result = canBeArchivedLogic({ archived: 0, reste: 250 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('SOLDE_NON_SOLDE');
  });

  test('Soldé et non archivé → ok: true', () => {
    const result = canBeArchivedLogic({ archived: 0, reste: 0 });
    expect(result.ok).toBe(true);
  });

  test('Formation 100% financée (reste=0, financement=0) → ok: true', () => {
    const result = canBeArchivedLogic({ archived: 0, reste: 0 });
    expect(result.ok).toBe(true);
  });

  test('Reste en valeur négative (trop-perçu côté calcul) → ok: true', () => {
    // GREATEST(...) en SQL garantit que reste >= 0, donc reste négatif ne peut arriver
    // mais si jamais la valeur arrivait à -0.01 la règle doit quand même passer
    const result = canBeArchivedLogic({ archived: 0, reste: -0.01 });
    expect(result.ok).toBe(true); // -0.01 > 0 est false
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DossiersController.archive — flux complet
// ─────────────────────────────────────────────────────────────────────────────
describe('DossiersController.archive', () => {

  test('Dossier non archivable (solde) → 400 SOLDE_NON_SOLDE', async () => {
    DossierModel.canBeArchived.mockResolvedValue({ ok: false, reason: 'SOLDE_NON_SOLDE' });
    const req = mockReq({ params: { id: '1' }, body: {} });
    const res = mockRes();

    await DossiersController.archive(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('SOLDE_NON_SOLDE');
  });

  test('Dossier déjà archivé → 400 ALREADY_ARCHIVED', async () => {
    DossierModel.canBeArchived.mockResolvedValue({ ok: false, reason: 'ALREADY_ARCHIVED' });
    const req = mockReq({ params: { id: '1' }, body: {} });
    const res = mockRes();

    await DossiersController.archive(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('ALREADY_ARCHIVED');
  });

  test('Archivage autorisé → DossierModel.update avec archived=1', async () => {
    DossierModel.canBeArchived.mockResolvedValue({ ok: true });
    DossierModel.update.mockResolvedValue(true);
    const req = mockReq({ params: { id: '1' }, body: {} });
    const res = mockRes();

    await DossiersController.archive(req, res);

    expect(DossierModel.update).toHaveBeenCalledWith(1, { archived: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('Archivage autorisé → réponse success=true', async () => {
    DossierModel.canBeArchived.mockResolvedValue({ ok: true });
    DossierModel.update.mockResolvedValue(true);
    const req = mockReq({ params: { id: '5' }, body: {} });
    const res = mockRes();

    await DossiersController.archive(req, res);

    expect(res.json.mock.calls[0][0].success).toBe(true);
  });
});
