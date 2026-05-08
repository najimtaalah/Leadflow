'use strict';

/**
 * Tests Module Qualiopi — Indicateurs 3, 5, 6 + documents réglementaires
 * Couvre : émargement, évaluations, satisfaction, génération PDF
 *
 * Pour exécuter : npm test tests/qualiopi.test.js
 */

const request = require('supertest');
const app     = require('../src/app');

let adminToken   = null;
let admifToken   = null;
let comToken     = null;
let testDossierId = null;
let testSessionId = null;

// ── Setup ────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  const [adminRes, admifRes, comRes] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: 'admin@leadflow.fr',         password: 'Admin2026!' }),
    request(app).post('/api/auth/login').send({ email: 'administratif@leadflow.fr', password: 'Admif2026!' }),
    request(app).post('/api/auth/login').send({ email: 'commercial@leadflow.fr',    password: 'Commercial2026!' }),
  ]);
  adminToken = adminRes.body.token;
  admifToken = admifRes.body.token;
  comToken   = comRes.body.token;

  // Créer un dossier de test
  const dossierRes = await request(app)
    .post('/api/dossiers')
    .set('Authorization', `Bearer ${admifToken}`)
    .send({
      nom:                 'TestQualiopi',
      prenom:              'Apprenant',
      telephone:           `07${Date.now().toString().slice(-8)}`,
      formation_souhaitee: 'Dev Web',
    });
  testDossierId = dossierRes.body.data?.id;

  // Récupérer une session de test
  const db = require('../src/config/database');
  const [[session]] = await db.query(
    'SELECT id FROM sessions_formation LIMIT 1'
  );
  testSessionId = session?.id || 1;
});

// ════════════════════════════════════════════════════════════════
// INDICATEUR 3 — ÉMARGEMENT
// ════════════════════════════════════════════════════════════════

describe('Indicateur 3 — Émargement', () => {

  test('✅ Saisie émargement simple (admif)', async () => {
    if (!testDossierId || !testSessionId) return;
    const res = await request(app)
      .post(`/api/qualiopi/sessions/${testSessionId}/emargements`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        dossier_id:  testDossierId,
        date_seance: '2026-06-01',
        present:     true,
        heure_debut: '09:00',
        heure_fin:   '17:00',
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('✅ Bulk émargement (admin)', async () => {
    if (!testDossierId || !testSessionId) return;
    const res = await request(app)
      .post(`/api/qualiopi/sessions/${testSessionId}/emargements/bulk`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date_seance: '2026-06-02',
        apprenants:  [{ dossier_id: testDossierId, present: false, motif_absence: 'Maladie' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('✅ Lecture émargements session (read)', async () => {
    const res = await request(app)
      .get(`/api/qualiopi/sessions/${testSessionId}/emargements`)
      .set('Authorization', `Bearer ${admifToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('emargements');
    expect(res.body.data).toHaveProperty('stats');
  });

  test('❌ Émargement sans date_seance → 400', async () => {
    const res = await request(app)
      .post(`/api/qualiopi/sessions/${testSessionId}/emargements`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ dossier_id: testDossierId, present: true });
    expect(res.status).toBe(400);
  });

  test('❌ Commercial ne peut pas saisir un émargement → 403', async () => {
    const res = await request(app)
      .post(`/api/qualiopi/sessions/${testSessionId}/emargements`)
      .set('Authorization', `Bearer ${comToken}`)
      .send({ dossier_id: testDossierId, date_seance: '2026-06-03', present: true });
    expect(res.status).toBe(403);
  });

  test('✅ Génération PDF feuille émargement', async () => {
    const res = await request(app)
      .get(`/api/qualiopi/sessions/${testSessionId}/emargements/pdf`)
      .set('Authorization', `Bearer ${admifToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
  });
});

// ════════════════════════════════════════════════════════════════
// INDICATEUR 5 — ÉVALUATIONS
// ════════════════════════════════════════════════════════════════

describe('Indicateur 5 — Évaluations des acquis', () => {

  test('✅ Saisie évaluation positionnement', async () => {
    if (!testDossierId || !testSessionId) return;
    const res = await request(app)
      .post(`/api/qualiopi/dossiers/${testDossierId}/evaluations`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        session_id: testSessionId,
        type_eval:  'positionnement',
        reponses:   [
          { question: 'Niveau initial ?', reponse: 'Débutant', note: null },
        ],
        score_total:  20,
        commentaire: 'Apprenant débutant',
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('✅ Saisie évaluation post-formation', async () => {
    if (!testDossierId || !testSessionId) return;
    const res = await request(app)
      .post(`/api/qualiopi/dossiers/${testDossierId}/evaluations`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        session_id:  testSessionId,
        type_eval:   'post_formation',
        reponses:    [{ question: 'Objectifs atteints ?', reponse: 'Oui', note: null }],
        score_total: 85,
      });
    expect(res.status).toBe(200);
  });

  test('✅ Lecture évaluations dossier', async () => {
    if (!testDossierId || !testSessionId) return;
    const res = await request(app)
      .get(`/api/qualiopi/dossiers/${testDossierId}/evaluations?sessionId=${testSessionId}`)
      .set('Authorization', `Bearer ${admifToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('✅ Stats évaluations session', async () => {
    const res = await request(app)
      .get(`/api/qualiopi/sessions/${testSessionId}/evaluations/stats`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('❌ type_eval invalide → 400', async () => {
    const res = await request(app)
      .post(`/api/qualiopi/dossiers/${testDossierId}/evaluations`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ session_id: testSessionId, type_eval: 'inconnu', reponses: [] });
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════
// INDICATEUR 6 — SATISFACTION
// ════════════════════════════════════════════════════════════════

describe('Indicateur 6 — Satisfaction', () => {

  test('✅ Saisie satisfaction apprenant', async () => {
    if (!testDossierId || !testSessionId) return;
    const res = await request(app)
      .post(`/api/qualiopi/dossiers/${testDossierId}/satisfaction`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        session_id:        testSessionId,
        note_contenu:      4,
        note_formateur:    5,
        note_organisation: 4,
        note_locaux:       3,
        note_globale:      4,
        commentaire_libre: 'Très bonne formation',
        recommande:        true,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('✅ Lecture satisfaction dossier', async () => {
    if (!testDossierId || !testSessionId) return;
    const res = await request(app)
      .get(`/api/qualiopi/dossiers/${testDossierId}/satisfaction?sessionId=${testSessionId}`)
      .set('Authorization', `Bearer ${admifToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeTruthy();
    expect(res.body.data.note_globale).toBe(4);
  });

  test('✅ Stats satisfaction session', async () => {
    const res = await request(app)
      .get(`/api/qualiopi/sessions/${testSessionId}/satisfaction/stats`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('nb_repondants');
    expect(res.body.data).toHaveProperty('taux_satisfaction_pct');
  });

  test('❌ Note hors plage 1–5 → 400', async () => {
    const res = await request(app)
      .post(`/api/qualiopi/dossiers/${testDossierId}/satisfaction`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ session_id: testSessionId, note_globale: 10 });
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════
// DOCUMENTS RÉGLEMENTAIRES
// ════════════════════════════════════════════════════════════════

describe('Documents réglementaires', () => {

  test('✅ Génération attestation PDF', async () => {
    if (!testDossierId || !testSessionId) return;
    const res = await request(app)
      .post(`/api/qualiopi/dossiers/${testDossierId}/documents/attestation`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ session_id: testSessionId });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
  });

  test('✅ Génération convention PDF', async () => {
    if (!testDossierId || !testSessionId) return;
    const res = await request(app)
      .post(`/api/qualiopi/dossiers/${testDossierId}/documents/convention`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ session_id: testSessionId });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
  });

  test('✅ Génération convocation PDF', async () => {
    if (!testDossierId || !testSessionId) return;
    const res = await request(app)
      .post(`/api/qualiopi/dossiers/${testDossierId}/documents/convocation`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ session_id: testSessionId });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
  });

  test('✅ Liste documents dossier', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .get(`/api/qualiopi/dossiers/${testDossierId}/documents`)
      .set('Authorization', `Bearer ${admifToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  test('❌ Attestation sans session_id → 400', async () => {
    const res = await request(app)
      .post(`/api/qualiopi/dossiers/${testDossierId}/documents/attestation`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('❌ Commercial ne peut pas générer un document → 403', async () => {
    const res = await request(app)
      .post(`/api/qualiopi/dossiers/${testDossierId}/documents/attestation`)
      .set('Authorization', `Bearer ${comToken}`)
      .send({ session_id: testSessionId });
    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════
// TABLEAU DE BORD
// ════════════════════════════════════════════════════════════════

describe('Dashboard Qualiopi', () => {

  test('✅ Dashboard retourne les KPIs', async () => {
    const res = await request(app)
      .get('/api/qualiopi/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('satisfaction');
    expect(res.body.data).toHaveProperty('evaluations');
    expect(res.body.data).toHaveProperty('presence');
  });

  test('❌ Non authentifié → 401', async () => {
    const res = await request(app).get('/api/qualiopi/dashboard');
    expect(res.status).toBe(401);
  });
});
