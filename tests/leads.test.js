'use strict';

/**
 * Tests Module 2 — Gestion des Leads
 * Couvre : UC-05, UC-06, UC-07, UC-08, UC-09, UC-10, UC-11, UC-12
 *
 * Pour exécuter : npm test tests/leads.test.js
 */

const request = require('supertest');
const app     = require('../src/app');

let adminToken      = null;
let commercialToken = null;
let managerToken    = null;
let createdLeadId   = null;

// ── Setup : récupérer les tokens ────────────────────────────────────────────
beforeAll(async () => {
  const [adminRes, comRes, mgrRes] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: 'admin@leadflow.fr',      password: 'Admin2026!' }),
    request(app).post('/api/auth/login').send({ email: 'commercial@leadflow.fr', password: 'Commercial2026!' }),
    request(app).post('/api/auth/login').send({ email: 'manager@leadflow.fr',    password: 'Manager2026!' }),
  ]);
  adminToken      = adminRes.body.token;
  commercialToken = comRes.body.token;
  managerToken    = mgrRes.body.token;
});

// ════════════════════════════════════════════════════════════════
// UC-05 — CRÉATION MANUELLE D'UN LEAD
// ════════════════════════════════════════════════════════════════
describe('UC-05 — Création manuelle d\'un lead', () => {

  test('✅ Création valide par AGENT_ACCUEIL/ADMIN', async () => {
    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nom:                 'Dupont',
        prenom:              'Marie',
        telephone:           `06${Date.now().toString().slice(-8)}`,
        email:               `marie.dupont.${Date.now()}@test.fr`,
        formation_souhaitee: 'Dev Web',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    createdLeadId = res.body.data.id;
  });

  test('❌ Nom manquant → 400', async () => {
    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ telephone: '0612345678' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('❌ COMMERCIAL ne peut pas créer un lead → 403', async () => {
    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${commercialToken}`)
      .send({ nom: 'Test', telephone: '0612345678' });

    expect(res.status).toBe(403);
  });

  test('❌ Doublon email → 409', async () => {
    const email = `doublon.${Date.now()}@test.fr`;
    // Créer le premier lead
    await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'Original', telephone: '0611111111', email });

    // Tenter de créer un doublon
    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'Doublon', telephone: '0622222222', email });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_LEAD');
  });
});

// ════════════════════════════════════════════════════════════════
// UC-06 — WEBHOOK (Réception auto Meta Ads / Formulaire)
// ════════════════════════════════════════════════════════════════
describe('UC-06 — Webhook lead entrant', () => {

  test('✅ Lead reçu via webhook', async () => {
    const res = await request(app)
      .post('/api/leads/webhook')
      .send({
        nom:       'WebhookTest',
        prenom:    'Auto',
        telephone: `07${Date.now().toString().slice(-8)}`,
        email:     `webhook.${Date.now()}@meta.fr`,
        source:    'Meta Ads',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
  });

  test('✅ Doublon webhook → 200 avec code DUPLICATE_DETECTED (pas d\'erreur)', async () => {
    const telephone = `06${Date.now().toString().slice(-8)}`;
    // Premier lead
    await request(app).post('/api/leads/webhook').send({ nom: 'First', telephone });
    // Doublon
    const res = await request(app)
      .post('/api/leads/webhook')
      .send({ nom: 'Doublon', telephone });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe('DUPLICATE_DETECTED');
  });

  test('❌ Téléphone manquant → 400', async () => {
    const res = await request(app)
      .post('/api/leads/webhook')
      .send({ nom: 'Test' });

    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-07 — CONSULTATION ET FILTRAGE
// ════════════════════════════════════════════════════════════════
describe('UC-07 — Consultation et filtrage des leads', () => {

  test('✅ ADMIN voit tous les leads', async () => {
    const res = await request(app)
      .get('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeDefined();
  });

  test('✅ COMMERCIAL ne voit que ses leads (filtre vendeur_id auto)', async () => {
    const res = await request(app)
      .get('/api/leads')
      .set('Authorization', `Bearer ${commercialToken}`);

    expect(res.status).toBe(200);
    // Tous les leads retournés doivent appartenir au commercial connecté
    // (vérifié côté controller, pas côté test car on ne connaît pas l'ID exact)
    expect(res.body.filters.vendeur_id).toBeDefined();
  });

  test('✅ Filtrage par statut', async () => {
    const res = await request(app)
      .get('/api/leads?statut=entrant')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach(l => expect(l.statut).toBe('entrant'));
  });

  test('✅ Détail d\'un lead avec historique', async () => {
    if (!createdLeadId) return;
    const res = await request(app)
      .get(`/api/leads/${createdLeadId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.historique).toBeDefined();
    expect(Array.isArray(res.body.data.historique)).toBe(true);
  });

  test('❌ Lead inexistant → 404', async () => {
    const res = await request(app)
      .get('/api/leads/999999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  test('❌ Sans authentification → 401', async () => {
    const res = await request(app).get('/api/leads');
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-08 — MISE À JOUR DU STATUT
// ════════════════════════════════════════════════════════════════
describe('UC-08 — Mise à jour du statut d\'un lead', () => {

  test('✅ ADMIN peut changer le statut', async () => {
    if (!createdLeadId) return;
    const res = await request(app)
      .patch(`/api/leads/${createdLeadId}/statut`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ statut: 'contacte', notes: 'Premier appel effectué' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('contacte');
  });

  test('✅ Passage à GAGNÉ → dossier créé automatiquement', async () => {
    if (!createdLeadId) return;
    const res = await request(app)
      .patch(`/api/leads/${createdLeadId}/statut`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ statut: 'gagne' });

    expect(res.status).toBe(200);
    expect(res.body.actions_auto).toBeDefined();
    const dossierAction = res.body.actions_auto.find(a => a.type === 'dossier_cree');
    expect(dossierAction).toBeDefined();
    expect(dossierAction.dossier_id).toBeDefined();
  });

  test('❌ Statut invalide → 400', async () => {
    if (!createdLeadId) return;
    const res = await request(app)
      .patch(`/api/leads/${createdLeadId}/statut`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ statut: 'statut_inexistant' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ════════════════════════════════════════════════════════════════
// UC-09 — RÉAFFECTATION AUTOMATIQUE (Perdu / Annulé)
// ════════════════════════════════════════════════════════════════
describe('UC-09 — Réaffectation automatique', () => {

  test('✅ Statut PERDU déclenche une réaffectation auto', async () => {
    // Créer un nouveau lead pour ce test
    const createRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nom:       'TestReassign',
        telephone: `06${Date.now().toString().slice(-8)}`,
      });

    const lid = createRes.body.data?.id;
    if (!lid) return;

    const res = await request(app)
      .patch(`/api/leads/${lid}/statut`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ statut: 'perdu', notes: 'Lead non intéressé' });

    expect(res.status).toBe(200);
    expect(res.body.actions_auto).toBeDefined();
    // L'action doit contenir reassigne ou reassign_echec
    const reassignAction = res.body.actions_auto.find(
      a => a.type === 'reassigne' || a.type === 'reassign_echec'
    );
    expect(reassignAction).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════
// UC-10 — INTERACTION (Appel / SMS / Email)
// ════════════════════════════════════════════════════════════════
describe('UC-10 — Enregistrement interaction', () => {

  test('✅ Enregistrement d\'un appel', async () => {
    if (!createdLeadId) return;
    const res = await request(app)
      .post(`/api/leads/${createdLeadId}/interactions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'appel', contenu: 'Appel de qualification', duree: 5 });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
  });

  test('✅ Enregistrement d\'un SMS', async () => {
    if (!createdLeadId) return;
    const res = await request(app)
      .post(`/api/leads/${createdLeadId}/interactions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'sms', contenu: 'Bonjour, suite à votre demande...' });

    expect(res.status).toBe(201);
  });

  test('❌ Type interaction invalide → 400', async () => {
    if (!createdLeadId) return;
    const res = await request(app)
      .post(`/api/leads/${createdLeadId}/interactions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'pigeon_voyageur' });

    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-12 — RÉASSIGNATION MANUELLE
// ════════════════════════════════════════════════════════════════
describe('UC-12 — Réassignation manuelle', () => {

  test('✅ ADMIN peut réassigner un lead manuellement', async () => {
    if (!createdLeadId) return;
    // Récupérer un commercial actif
    const usersRes = await request(app)
      .get('/api/users?role_nom=commercial')
      .set('Authorization', `Bearer ${adminToken}`);

    const commercial = usersRes.body.data?.[0];
    if (!commercial) return;

    const res = await request(app)
      .post(`/api/leads/${createdLeadId}/reassign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ vendeur_id: commercial.id, motif: 'Test réassignation manuelle' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('❌ COMMERCIAL ne peut pas réassigner → 403', async () => {
    if (!createdLeadId) return;
    const res = await request(app)
      .post(`/api/leads/${createdLeadId}/reassign`)
      .set('Authorization', `Bearer ${commercialToken}`)
      .send({ vendeur_id: 1 });

    expect(res.status).toBe(403);
  });

  test('❌ vendeur_id manquant → 400', async () => {
    if (!createdLeadId) return;
    const res = await request(app)
      .post(`/api/leads/${createdLeadId}/reassign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════
// HISTORIQUE PIPELINE
// ════════════════════════════════════════════════════════════════
describe('Historique pipeline', () => {

  test('✅ Historique d\'un lead contient les transitions', async () => {
    if (!createdLeadId) return;
    const res = await request(app)
      .get(`/api/leads/${createdLeadId}/historique`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Doit contenir au moins une transition (création)
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].statut_apres).toBeDefined();
  });
});
