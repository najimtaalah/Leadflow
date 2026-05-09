'use strict';

/**
 * Tests unitaires — Service de gestion des sessions (affectation manuelle)
 *
 * Couvre PedagogieController.inscrire :
 *  - Validation session_id requis
 *  - Dossier / session introuvable → 404
 *  - Session complète (capacité max) → 409 SESSION_FULL
 *  - Mapping type_session → colonne FK (cours, edof, examen)
 *  - Type inconnu → 400
 *  - Assignation réussie → 200 avec code session + type
 */

jest.mock('../../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../../src/models/ResultatCMA',   () => ({}));
jest.mock('../../src/models/Inscription',   () => ({ findPresentes: jest.fn() }));
jest.mock('../../src/services/agentCMAService', () => ({ synchroniser: jest.fn() }));
jest.mock('../../src/models/Log',           () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../../src/utils/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
}));

const db                   = require('../../src/config/database');
const PedagogieController  = require('../../src/controllers/pedagogieController');

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

// Construit les mocks DB pour une session disponible
function setupAvailableSession({ type_session = 'cours', capacite_max = 20, inscrits = 5 } = {}) {
  db.query
    .mockResolvedValueOnce([[{ id: 1 }]])                             // dossier trouvé
    .mockResolvedValueOnce([[{                                        // session trouvée
      id:                  10,
      code_session:        'CMA-2026-01',
      type_session,
      capacite_max,
      config_pedagogique:  'theorie_et_pratique',
      inscrits,
    }]])
    .mockResolvedValueOnce([{ affectedRows: 1 }]);                    // UPDATE dossiers
}

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
// Validation des paramètres d'entrée
// ─────────────────────────────────────────────────────────────────────────────
describe('inscrire — validation paramètres', () => {

  test('session_id manquant → 400 VALIDATION_ERROR', async () => {
    const req = mockReq({ params: { dossierId: '1' }, body: {} });
    const res = mockRes();

    await PedagogieController.inscrire(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('VALIDATION_ERROR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Entités introuvables
// ─────────────────────────────────────────────────────────────────────────────
describe('inscrire — dossier / session introuvable', () => {

  test('Dossier introuvable → 404', async () => {
    db.query.mockResolvedValueOnce([[]]); // pas de dossier

    const req = mockReq({ params: { dossierId: '999' }, body: { session_id: 10 } });
    const res = mockRes();

    await PedagogieController.inscrire(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].message).toContain('Dossier introuvable');
  });

  test('Session introuvable → 404', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1 }]])  // dossier ok
      .mockResolvedValueOnce([[]]); // pas de session

    const req = mockReq({ params: { dossierId: '1' }, body: { session_id: 999 } });
    const res = mockRes();

    await PedagogieController.inscrire(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].message).toContain('Session introuvable');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Capacité max
// ─────────────────────────────────────────────────────────────────────────────
describe('inscrire — vérification capacité', () => {

  test('Session complète → 409 SESSION_FULL', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[{
        id: 10, code_session: 'CMA-2026-01', type_session: 'cours',
        capacite_max: 10, inscrits: 10,
      }]]);

    const req = mockReq({ params: { dossierId: '1' }, body: { session_id: 10 } });
    const res = mockRes();

    await PedagogieController.inscrire(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe('SESSION_FULL');
    const msg = res.json.mock.calls[0][0].message;
    expect(msg).toContain('10/10');
  });

  test('Session sans capacite_max (illimitée) → pas de blocage', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[{
        id: 10, code_session: 'CMA-2026-01', type_session: 'cours',
        capacite_max: null, inscrits: 999,
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const req = mockReq({ params: { dossierId: '1' }, body: { session_id: 10 } });
    const res = mockRes();

    await PedagogieController.inscrire(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('Session avec 1 place restante → assignation réussie', async () => {
    setupAvailableSession({ capacite_max: 10, inscrits: 9 });

    const req = mockReq({ params: { dossierId: '1' }, body: { session_id: 10 } });
    const res = mockRes();

    await PedagogieController.inscrire(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mapping type_session → colonne FK
// ─────────────────────────────────────────────────────────────────────────────
describe('inscrire — mapping type_session → FK column', () => {

  test.each([
    ['cours',  'session_cours_id'],
    ['edof',   'session_edof_id'],
    ['examen', 'examen_id'],
  ])('type_session=%s → UPDATE avec %s', async (type_session, expectedColumn) => {
    setupAvailableSession({ type_session });

    const req = mockReq({ params: { dossierId: '1' }, body: { session_id: 10 } });
    const res = mockRes();

    await PedagogieController.inscrire(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const [updateSql] = db.query.mock.calls[2]; // 3ème appel = UPDATE
    expect(updateSql).toContain(expectedColumn);
  });

  test('Type de session inconnu → 400', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[{
        id: 10, code_session: 'CMA-2026-01', type_session: 'inconnu',
        capacite_max: 20, inscrits: 5,
      }]]);

    const req = mockReq({ params: { dossierId: '1' }, body: { session_id: 10 } });
    const res = mockRes();

    await PedagogieController.inscrire(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('inconnu');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Réponse réussie
// ─────────────────────────────────────────────────────────────────────────────
describe('inscrire — assignation réussie', () => {

  test('Retourne code_session et type_session dans la réponse', async () => {
    setupAvailableSession({ type_session: 'cours' });

    const req = mockReq({ params: { dossierId: '1' }, body: { session_id: 10 } });
    const res = mockRes();

    await PedagogieController.inscrire(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.session_code).toBe('CMA-2026-01');
    expect(body.data.type_session).toBe('cours');
  });

  test('LogModel.create appelé avec session_id et dossier_id', async () => {
    setupAvailableSession({ type_session: 'edof' });
    const LogModel = require('../../src/models/Log');

    const req = mockReq({ params: { dossierId: '7' }, body: { session_id: 10 } });
    const res = mockRes();

    await PedagogieController.inscrire(req, res);

    expect(LogModel.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'session_assigned',
      details: expect.objectContaining({ dossier_id: 7, session_id: 10, type_session: 'edof' }),
    }));
  });

  test('UPDATE dossier avec session_id correct', async () => {
    setupAvailableSession({ type_session: 'examen' });

    const req = mockReq({ params: { dossierId: '3' }, body: { session_id: 10 } });
    const res = mockRes();

    await PedagogieController.inscrire(req, res);

    const [, updateParams] = db.query.mock.calls[2];
    expect(updateParams).toContain(10);  // session_id
    expect(updateParams).toContain(3);   // dossierId
  });
});
