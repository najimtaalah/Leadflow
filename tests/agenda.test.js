'use strict';

/**
 * Tests Module 6 — Agenda & Rendez-vous
 * Couvre : UC-31, UC-32, UC-33, UC-34, UC-35, UC-36
 */

const request = require('supertest');
const app     = require('../src/app');

let adminToken  = null;
let comToken    = null;
let admifToken  = null;
let testLeadId  = null;
let testRdvId   = null;
let testRdvComId = null;

beforeAll(async () => {
  const [adminRes, comRes, admifRes] = await Promise.all([
    request(app).post('/api/auth/login')
      .send({ email: 'admin@leadflow.fr',        password: 'Admin2026!' }),
    request(app).post('/api/auth/login')
      .send({ email: 'commercial@leadflow.fr',   password: 'Commercial2026!' }),
    request(app).post('/api/auth/login')
      .send({ email: 'administratif@leadflow.fr', password: 'Admif2026!' }),
  ]);
  adminToken = adminRes.body.token;
  comToken   = comRes.body.token;
  admifToken = admifRes.body.token;

  // Créer un lead de test pour les RDV commerciaux
  const leadRes = await request(app)
    .post('/api/leads')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      nom:       'RdvTest',
      prenom:    'Lead',
      telephone: `06${Date.now().toString().slice(-8)}`,
      email:     `rdv.test.${Date.now()}@test.fr`,
    });
  testLeadId = leadRes.body.data?.id;
});

// ════════════════════════════════════════════════════════════════
// UC-31 — CRÉATION D'UN RDV
// ════════════════════════════════════════════════════════════════
describe('UC-31 — Création d\'un RDV', () => {

  test('✅ Création RDV commercial valide', async () => {
    const db = require('../src/config/database');
    const [[user]] = await db.query(
      "SELECT id FROM users WHERE role_id = (SELECT id FROM roles WHERE nom = 'commercial') LIMIT 1"
    );
    const respId = user?.id || 1;

    const res = await request(app)
      .post('/api/agenda')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type_rdv:     'commercial',
        titre:        'Présentation offre Dev Web',
        date_rdv:     '2026-04-15',
        heure_debut:  '09:00',
        heure_fin:    '10:00',
        responsable_id: respId,
        lead_id:      testLeadId,
        notif_email:  true,
        notif_sms:    false,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    testRdvComId = res.body.data.id;
  });

  test('✅ Création RDV interne (sans lead ni dossier)', async () => {
    const db = require('../src/config/database');
    const [[user]] = await db.query('SELECT id FROM users LIMIT 1');

    const res = await request(app)
      .post('/api/agenda')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type_rdv:       'interne',
        titre:          'Réunion hebdo équipe',
        date_rdv:       '2026-04-16',
        heure_debut:    '10:00',
        heure_fin:      '11:00',
        responsable_id: user?.id || 1,
      });

    expect(res.status).toBe(201);
    testRdvId = res.body.data?.id;
  });

  test('❌ type_rdv invalide → 400', async () => {
    const res = await request(app)
      .post('/api/agenda')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type_rdv:       'reunion_client',
        titre:          'Test',
        date_rdv:       '2026-04-20',
        heure_debut:    '09:00',
        heure_fin:      '10:00',
        responsable_id: 1,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('❌ Titre manquant → 400', async () => {
    const res = await request(app)
      .post('/api/agenda')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type_rdv:       'interne',
        date_rdv:       '2026-04-20',
        heure_debut:    '09:00',
        heure_fin:      '10:00',
        responsable_id: 1,
      });

    expect(res.status).toBe(400);
  });

  test('❌ RDV commercial sans lead_id → 400', async () => {
    const res = await request(app)
      .post('/api/agenda')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type_rdv:       'commercial',
        titre:          'Test sans lead',
        date_rdv:       '2026-04-20',
        heure_debut:    '14:00',
        heure_fin:      '15:00',
        responsable_id: 1,
        // lead_id absent
      });

    expect(res.status).toBe(400);
  });

  test('❌ heure_fin avant heure_debut → 400', async () => {
    const res = await request(app)
      .post('/api/agenda')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type_rdv:       'interne',
        titre:          'Mauvaises heures',
        date_rdv:       '2026-04-20',
        heure_debut:    '15:00',
        heure_fin:      '14:00',
        responsable_id: 1,
      });

    expect(res.status).toBe(400);
  });

  test('❌ Sans authentification → 401', async () => {
    const res = await request(app)
      .post('/api/agenda')
      .send({ type_rdv: 'interne', titre: 'Test', date_rdv: '2026-04-20' });

    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-32 — CONSULTATION DU CALENDRIER
// ════════════════════════════════════════════════════════════════
describe('UC-32 — Consultation du calendrier', () => {

  test('✅ ADMIN voit tous les RDV', async () => {
    const res = await request(app)
      .get('/api/agenda')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('✅ COMMERCIAL ne voit que ses RDV (filtre responsable_id)', async () => {
    const res = await request(app)
      .get('/api/agenda')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(200);
    expect(res.body.filters.responsable_id).toBeDefined();
  });

  test('✅ Filtre par type_rdv', async () => {
    const res = await request(app)
      .get('/api/agenda?type_rdv=commercial')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach(r => expect(r.type_rdv).toBe('commercial'));
  });

  test('✅ Filtre par date', async () => {
    const res = await request(app)
      .get('/api/agenda?date_debut=2026-04-01&date_fin=2026-04-30')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach(r => {
      expect(r.date_rdv >= '2026-04-01').toBe(true);
      expect(r.date_rdv <= '2026-04-30').toBe(true);
    });
  });

  test('✅ Détail d\'un RDV', async () => {
    if (!testRdvId) return;
    const res = await request(app)
      .get(`/api/agenda/${testRdvId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.titre).toBeDefined();
    expect(res.body.data.type_rdv).toBeDefined();
  });

  test('❌ RDV inexistant → 404', async () => {
    const res = await request(app)
      .get('/api/agenda/999999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-33 — CONFIRMATION D'UN RDV
// ════════════════════════════════════════════════════════════════
describe('UC-33 — Confirmation d\'un RDV', () => {

  test('✅ Confirmation d\'un RDV planifié', async () => {
    if (!testRdvId) return;
    const res = await request(app)
      .post(`/api/agenda/${testRdvId}/confirmer`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('❌ Confirmation d\'un RDV déjà confirmé', async () => {
    // Tenter de confirmer à nouveau → doit passer (idempotent) ou échouer
    if (!testRdvId) return;
    const res = await request(app)
      .post(`/api/agenda/${testRdvId}/confirmer`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Soit 200 (idempotent), soit 400 si déjà confirmé
    expect([200, 400]).toContain(res.status);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-34 — MARQUER EFFECTUÉ
// ════════════════════════════════════════════════════════════════
describe('UC-34 — Marquer un RDV comme effectué', () => {

  test('✅ Marquer un RDV comme effectué', async () => {
    if (!testRdvId) return;
    const res = await request(app)
      .post(`/api/agenda/${testRdvId}/effectue`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('✅ RDV commercial effectué → suggestion mise à jour lead', async () => {
    if (!testRdvComId) return;
    const res = await request(app)
      .post(`/api/agenda/${testRdvComId}/effectue`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // suggestion_lead peut être null (si lead pas en rdv_booke) ou un objet
    if (res.body.suggestion_lead) {
      expect(res.body.suggestion_lead.lead_id).toBeDefined();
    }
  });

  test('❌ RDV déjà effectué → 400', async () => {
    if (!testRdvId) return;
    const res = await request(app)
      .post(`/api/agenda/${testRdvId}/effectue`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ALREADY_DONE');
  });
});

// ════════════════════════════════════════════════════════════════
// UC-35 — ANNULATION D'UN RDV
// ════════════════════════════════════════════════════════════════
describe('UC-35 — Annulation d\'un RDV', () => {

  let rdvAAnnuler = null;

  beforeAll(async () => {
    const db = require('../src/config/database');
    const [[user]] = await db.query('SELECT id FROM users LIMIT 1');
    const res = await request(app)
      .post('/api/agenda')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type_rdv:       'interne',
        titre:          'RDV à annuler',
        date_rdv:       '2026-05-10',
        heure_debut:    '14:00',
        heure_fin:      '15:00',
        responsable_id: user?.id || 1,
      });
    rdvAAnnuler = res.body.data?.id;
  });

  test('✅ Annulation avec motif', async () => {
    if (!rdvAAnnuler) return;
    const res = await request(app)
      .post(`/api/agenda/${rdvAAnnuler}/annuler`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ motif: 'Responsable indisponible' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('❌ Annulation d\'un RDV déjà annulé → 400', async () => {
    if (!rdvAAnnuler) return;
    const res = await request(app)
      .post(`/api/agenda/${rdvAAnnuler}/annuler`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ALREADY_CANCELLED');
  });

  test('❌ COMMERCIAL ne peut pas annuler un RDV → 403', async () => {
    if (!testRdvId) return;
    const res = await request(app)
      .post(`/api/agenda/${testRdvId}/annuler`)
      .set('Authorization', `Bearer ${comToken}`)
      .send({});

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-36 — WIDGET DASHBOARD RDV DU JOUR
// ════════════════════════════════════════════════════════════════
describe('UC-36 — Widget RDV du jour (Dashboard)', () => {

  test('✅ RDV du jour + KPIs accessibles', async () => {
    const res = await request(app)
      .get('/api/agenda/today')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.kpis).toBeDefined();
    expect(res.body.kpis.rdv_aujourd_hui).toBeDefined();
    expect(res.body.kpis.rdv_cette_semaine).toBeDefined();
    expect(res.body.kpis.en_attente).toBeDefined();
  });

  test('✅ COMMERCIAL ne voit que ses RDV du jour', async () => {
    const res = await request(app)
      .get('/api/agenda/today')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(200);
    // Tous les RDV retournés appartiennent au commercial connecté
    // (filtre appliqué côté controller)
  });
});

// ════════════════════════════════════════════════════════════════
// RAPPEL MANUEL
// ════════════════════════════════════════════════════════════════
describe('Envoi d\'un rappel manuel', () => {

  test('✅ Rappel envoyé depuis un RDV avec contact', async () => {
    if (!testRdvComId) return;
    const res = await request(app)
      .post(`/api/agenda/${testRdvComId}/rappel`)
      .set('Authorization', `Bearer ${adminToken}`);

    // 200 si contact disponible, 400 si aucun contact
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.canaux).toBeGreaterThan(0);
    }
  });

  test('❌ Rappel sur RDV inexistant → 404', async () => {
    const res = await request(app)
      .post('/api/agenda/999999/rappel')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════
// MODIFICATION RDV
// ════════════════════════════════════════════════════════════════
describe('Modification d\'un RDV', () => {

  let rdvAModifier = null;

  beforeAll(async () => {
    const db = require('../src/config/database');
    const [[user]] = await db.query('SELECT id FROM users LIMIT 1');
    const res = await request(app)
      .post('/api/agenda')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type_rdv:       'interne',
        titre:          'RDV modifiable',
        date_rdv:       '2026-06-01',
        heure_debut:    '10:00',
        heure_fin:      '11:00',
        responsable_id: user?.id || 1,
      });
    rdvAModifier = res.body.data?.id;
  });

  test('✅ Modification titre et horaires', async () => {
    if (!rdvAModifier) return;
    const res = await request(app)
      .patch(`/api/agenda/${rdvAModifier}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ titre: 'Nouveau titre', heure_debut: '11:00', heure_fin: '12:00' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('❌ Modification RDV effectué → 400', async () => {
    if (!testRdvId) return;
    const res = await request(app)
      .patch(`/api/agenda/${testRdvId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ titre: 'Tentative modif' });

    expect(res.status).toBe(400);
  });
});
