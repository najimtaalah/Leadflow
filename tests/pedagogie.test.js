'use strict';

/**
 * Tests Module 4 — Pédagogie & Agent IA CMA
 * Couvre : UC-19, UC-20, UC-21, UC-22, UC-23, UC-24
 *
 * Pour exécuter : npm test tests/pedagogie.test.js
 */

const request = require('supertest');
const app     = require('../src/app');

let adminToken  = null;
let admifToken  = null;
let comToken    = null;
let testDossierId    = null;
let testSessionId    = null;
let testInscriptionId = null;

// ── Setup ────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  const [adminRes, admifRes, comRes] = await Promise.all([
    request(app).post('/api/auth/login')
      .send({ email: 'admin@leadflow.fr',        password: 'Admin2026!' }),
    request(app).post('/api/auth/login')
      .send({ email: 'administratif@leadflow.fr', password: 'Admif2026!' }),
    request(app).post('/api/auth/login')
      .send({ email: 'commercial@leadflow.fr',   password: 'Commercial2026!' }),
  ]);
  adminToken = adminRes.body.token;
  admifToken = admifRes.body.token;
  comToken   = comRes.body.token;

  // Créer un dossier de test
  const dossierRes = await request(app)
    .post('/api/dossiers')
    .set('Authorization', `Bearer ${admifToken}`)
    .send({
      nom:                 'TestPeda',
      prenom:              'Apprenant',
      telephone:           `06${Date.now().toString().slice(-8)}`,
      formation_souhaitee: 'Dev Web',
    });
  testDossierId = dossierRes.body.data?.id;

  // Récupérer une session de test depuis la BDD (seed.sql doit en contenir une)
  const db = require('../src/config/database');
  const [[session]] = await db.query(
    'SELECT id FROM sessions_formation WHERE date_debut >= CURDATE() LIMIT 1'
  );
  testSessionId = session?.id || 1;
});

// ════════════════════════════════════════════════════════════════
// UC-19 — INSCRIPTION À UNE SESSION
// ════════════════════════════════════════════════════════════════
describe('UC-19 — Inscription à une session de formation', () => {

  test('✅ Inscription théorie valide', async () => {
    if (!testDossierId || !testSessionId) return;
    const res = await request(app)
      .post(`/api/pedagogie/dossiers/${testDossierId}/inscrire`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ session_id: testSessionId, type_partie: 'theorie' });

    // Accepter 201 (succès) ou 409 (déjà inscrit si seed contient déjà une inscription)
    expect([201, 409]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.data.id).toBeDefined();
      testInscriptionId = res.body.data.id;
    }
  });

  test('❌ type_partie invalide → 400', async () => {
    if (!testDossierId || !testSessionId) return;
    const res = await request(app)
      .post(`/api/pedagogie/dossiers/${testDossierId}/inscrire`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ session_id: testSessionId, type_partie: 'examen_oral' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('❌ session_id manquant → 400', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/pedagogie/dossiers/${testDossierId}/inscrire`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ type_partie: 'theorie' });

    expect(res.status).toBe(400);
  });

  test('❌ Doublon inscription → 409', async () => {
    if (!testDossierId || !testSessionId) return;
    // Tenter de réinscrire au même cours
    const res = await request(app)
      .post(`/api/pedagogie/dossiers/${testDossierId}/inscrire`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ session_id: testSessionId, type_partie: 'theorie' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_INSCRIT');
  });

  test('❌ COMMERCIAL ne peut pas inscrire un apprenant → 403', async () => {
    if (!testDossierId || !testSessionId) return;
    const res = await request(app)
      .post(`/api/pedagogie/dossiers/${testDossierId}/inscrire`)
      .set('Authorization', `Bearer ${comToken}`)
      .send({ session_id: testSessionId, type_partie: 'pratique' });

    expect(res.status).toBe(403);
  });

  test('✅ Liste des inscriptions d\'un dossier', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .get(`/api/pedagogie/dossiers/${testDossierId}/inscriptions`)
      .set('Authorization', `Bearer ${admifToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════
// STATUT INSCRIPTION
// ════════════════════════════════════════════════════════════════
describe('Mise à jour statut inscription', () => {

  test('✅ Passage à en_cours', async () => {
    if (!testInscriptionId) return;
    const res = await request(app)
      .patch(`/api/pedagogie/inscriptions/${testInscriptionId}/statut`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ statut: 'en_cours' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('❌ Statut invalide → 400', async () => {
    if (!testInscriptionId) return;
    const res = await request(app)
      .patch(`/api/pedagogie/inscriptions/${testInscriptionId}/statut`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ statut: 'reçu' });

    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-20 — SYNCHRONISATION MANUELLE CMA
// ════════════════════════════════════════════════════════════════
describe('UC-20 — Synchronisation manuelle résultats CMA', () => {

  test('✅ Sync manuelle déclenche un rapport', async () => {
    const res = await request(app)
      .post('/api/pedagogie/agent-cma/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.rapport).toBeDefined();
    expect(res.body.rapport.apprenants_presentes).toBeDefined();
    expect(res.body.rapport.resultats_trouves).toBeDefined();
    expect(res.body.rapport.messages_envoyes).toBeDefined();
    expect(Array.isArray(res.body.rapport.actions)).toBe(true);
  });

  test('✅ Rapport contient les actions déclenchées', async () => {
    const res = await request(app)
      .post('/api/pedagogie/agent-cma/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ session_code: 'S1-2026' });

    expect(res.status).toBe(200);
    // Chaque action doit avoir un type valide
    res.body.rapport.actions.forEach(action => {
      expect([
        'inscription_pratique_auto',
        'inscription_pratique_echec',
        'echec_reinscription',
        'felicitations_diplome',
      ]).toContain(action.type);
    });
  });

  test('❌ COMMERCIAL ne peut pas déclencher la sync → 403', async () => {
    const res = await request(app)
      .post('/api/pedagogie/agent-cma/sync')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════
// RÉSULTATS CMA
// ════════════════════════════════════════════════════════════════
describe('Résultats CMA', () => {

  test('✅ Résultats CMA d\'un dossier après sync', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .get(`/api/pedagogie/dossiers/${testDossierId}/resultats-cma`)
      .set('Authorization', `Bearer ${admifToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('✅ Résultats par session', async () => {
    const res = await request(app)
      .get('/api/pedagogie/sessions/S1-2026/resultats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════
// APPRENANTS PRÉSENTÉS
// ════════════════════════════════════════════════════════════════
describe('Liste des apprenants présentés', () => {

  test('✅ Liste accessible par ADMIN', async () => {
    const res = await request(app)
      .get('/api/pedagogie/presentes')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeDefined();
  });

  test('✅ Filtrage par type_partie', async () => {
    const res = await request(app)
      .get('/api/pedagogie/presentes?type_partie=theorie')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach(p => expect(p.type_partie).toBe('theorie'));
  });
});

// ════════════════════════════════════════════════════════════════
// UC-24 — CONFIG SYNCHRONISATION AUTOMATIQUE
// ════════════════════════════════════════════════════════════════
describe('UC-24 — Configuration synchronisation automatique', () => {

  test('✅ Récupération de la config de sync', async () => {
    const res = await request(app)
      .get('/api/pedagogie/agent-cma/config')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.config).toBeDefined();
    expect(res.body.data.stats).toBeDefined();
  });

  test('✅ SUPER_ADMIN peut modifier la fréquence', async () => {
    const res = await request(app)
      .patch('/api/pedagogie/agent-cma/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ frequence: 'toutes_12h' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('✅ Activation/désactivation de la sync', async () => {
    const res = await request(app)
      .patch('/api/pedagogie/agent-cma/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ actif: true, frequence: 'nuit_06h' });

    expect(res.status).toBe(200);
  });

  test('❌ Fréquence invalide → 400', async () => {
    const res = await request(app)
      .patch('/api/pedagogie/agent-cma/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ frequence: 'toutes_les_heures' });

    expect(res.status).toBe(400);
  });

  test('❌ ROLE_ADMIN ne peut pas modifier la config sync → 403', async () => {
    // Seul SUPER_ADMIN peut modifier
    const res = await request(app)
      .patch('/api/pedagogie/agent-cma/config')
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ frequence: 'toutes_6h' });

    expect(res.status).toBe(403);
  });
});
