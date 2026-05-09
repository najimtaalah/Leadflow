'use strict';

/**
 * Tests Lot 0 — Entités Lead / Apprenant / Dossier / Pré-dossier
 *
 * Flux couverts :
 *  1. Création d'un lead
 *  2. Création d'un pré-dossier depuis ce lead (+ badge_pre_dossier)
 *  3. Validation des deux blocs du pré-dossier
 *  4. Activation (conversion lead → apprenant)
 *  5. Création d'un dossier avec apprenant_id + id_lead_origine
 *  6. Mise à jour du dossier + vérification journal d'audit
 *  7. Idempotence : conversion lead → apprenant déjà existant renvoie 409
 */

const request = require('supertest');
const app     = require('../src/app');

let adminToken    = null;
let admifToken    = null;
let createdLeadId = null;
let preDossierId  = null;
let apprenantId   = null;
let dossierId     = null;

// ── Auth ─────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  const [adminRes, admifRes] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: 'admin@leadflow.fr', password: 'Admin2026!' }),
    request(app).post('/api/auth/login').send({ email: 'administratif@leadflow.fr', password: 'Admif2026!' }),
  ]);
  adminToken = adminRes.body.token;
  admifToken = admifRes.body.token;
  expect(adminToken).toBeTruthy();
  expect(admifToken).toBeTruthy();
});

// ════════════════════════════════════════════════════════════════
// 1. Création d'un lead (base pour les flux suivants)
// ════════════════════════════════════════════════════════════════
describe('Flux 1 — Création lead de base', () => {
  test('Crée un lead valide', async () => {
    const ts = Date.now();
    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nom:       'TestLot0',
        prenom:    'Flux',
        telephone: `06${ts.toString().slice(-8)}`,
        email:     `flux.lot0.${ts}@test.fr`,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    createdLeadId = res.body.data.id;
  });
});

// ════════════════════════════════════════════════════════════════
// 2. Création d'un pré-dossier
// ════════════════════════════════════════════════════════════════
describe('Flux 2 — Pré-dossier', () => {
  test('Crée un pré-dossier depuis le lead', async () => {
    expect(createdLeadId).toBeDefined();
    const res = await request(app)
      .post('/api/predossiers')
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ id_lead: createdLeadId });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    preDossierId = res.body.data.id;
  });

  test('Le lead porte le badge_pre_dossier = 1 après création', async () => {
    const res = await request(app)
      .get(`/api/leads/${createdLeadId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.badge_pre_dossier).toBe(1);
  });

  test('GET /api/predossiers/:id retourne les données correctes', async () => {
    const res = await request(app)
      .get(`/api/predossiers/${preDossierId}`)
      .set('Authorization', `Bearer ${admifToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id_lead).toBe(createdLeadId);
    expect(res.body.data.statut_bloc_admin).toBe('en_attente');
    expect(res.body.data.statut_bloc_financier).toBe('en_attente');
  });
});

// ════════════════════════════════════════════════════════════════
// 3. Validation des blocs
// ════════════════════════════════════════════════════════════════
describe('Flux 3 — Validation blocs pré-dossier', () => {
  test('Valide le bloc admin', async () => {
    const res = await request(app)
      .patch(`/api/predossiers/${preDossierId}/blocs`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ bloc: 'admin', statut: 'valide' });
    expect(res.status).toBe(200);
  });

  test('Valide le bloc financier', async () => {
    const res = await request(app)
      .patch(`/api/predossiers/${preDossierId}/blocs`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ bloc: 'financier', statut: 'valide' });
    expect(res.status).toBe(200);
  });

  test('Rejette un statut invalide → 400', async () => {
    const res = await request(app)
      .patch(`/api/predossiers/${preDossierId}/blocs`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ bloc: 'admin', statut: 'inconnu' });
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════
// 4. Activation (conversion lead → apprenant)
// ════════════════════════════════════════════════════════════════
describe('Flux 4 — Activation pré-dossier', () => {
  test('Active le pré-dossier et crée un apprenant', async () => {
    const res = await request(app)
      .post(`/api/predossiers/${preDossierId}/activer`)
      .set('Authorization', `Bearer ${admifToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.apprenant_id).toBeDefined();
    apprenantId = res.body.data.apprenant_id;
  });

  test('L\'apprenant créé a bien id_lead_origine', async () => {
    const res = await request(app)
      .get(`/api/apprenants/${apprenantId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id_lead_origine).toBe(createdLeadId);
    expect(res.body.data.nom).toBe('TestLot0');
  });
});

// ════════════════════════════════════════════════════════════════
// 5. Création d'un dossier avec entités liées
// ════════════════════════════════════════════════════════════════
describe('Flux 5 — Dossier avec apprenant_id et id_lead_origine', () => {
  test('Crée un dossier lié à l\'apprenant et au lead', async () => {
    const res = await request(app)
      .post('/api/dossiers')
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        nom:              'TestLot0',
        prenom:           'Flux',
        telephone:        '0600000001',
        formation_souhaitee: 'Permis B',
        lead_id:          createdLeadId,
        apprenant_id:     apprenantId,
        type_financement: 'cpf',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    dossierId = res.body.data.id;
  });
});

// ════════════════════════════════════════════════════════════════
// 6. Journal d'audit — mise à jour dossier
// ════════════════════════════════════════════════════════════════
describe('Flux 6 — Journal d\'audit dossier', () => {
  test('La création du dossier a généré une entrée de journal', async () => {
    const res = await request(app)
      .get(`/api/apprenants/dossiers/${dossierId}/journal`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const entries = res.body.data;
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries.some(e => e.action === 'created')).toBe(true);
  });

  test('Une mise à jour du dossier génère des entrées de journal', async () => {
    await request(app)
      .patch(`/api/dossiers/${dossierId}`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ formation_souhaitee: 'Permis B — mis à jour Lot 0' });

    const res = await request(app)
      .get(`/api/apprenants/dossiers/${dossierId}/journal`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const entries = res.body.data;
    expect(entries.some(e => e.champ === 'formation_souhaitee')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════
// 7. Idempotence conversion lead → apprenant
// ════════════════════════════════════════════════════════════════
describe('Flux 7 — Idempotence conversion', () => {
  test('POST /api/apprenants/from-lead/:id renvoie 409 si déjà converti', async () => {
    const res = await request(app)
      .post(`/api/apprenants/from-lead/${createdLeadId}`)
      .set('Authorization', `Bearer ${admifToken}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_EXISTS');
  });
});
