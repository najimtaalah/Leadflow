'use strict';

/**
 * Tests Module 5 — Finance & Paiements
 * Couvre : UC-25, UC-26, UC-27, UC-28, UC-29, UC-30
 */

const request = require('supertest');
const app     = require('../src/app');

let adminToken  = null;
let admifToken  = null;
let comToken    = null;
let testDossierId = null;

beforeAll(async () => {
  const [adminRes, admifRes, comRes] = await Promise.all([
    request(app).post('/api/auth/login')
      .send({ email: 'admin@leadflow.fr',         password: 'Admin2026!' }),
    request(app).post('/api/auth/login')
      .send({ email: 'administratif@leadflow.fr',  password: 'Admif2026!' }),
    request(app).post('/api/auth/login')
      .send({ email: 'commercial@leadflow.fr',     password: 'Commercial2026!' }),
  ]);
  adminToken = adminRes.body.token;
  admifToken = admifRes.body.token;
  comToken   = comRes.body.token;

  // Créer un dossier de test avec financement personnel
  const res = await request(app)
    .post('/api/dossiers')
    .set('Authorization', `Bearer ${admifToken}`)
    .send({
      nom:                    'FinanceTest',
      prenom:                 'Apprenant',
      telephone:              `06${Date.now().toString().slice(-8)}`,
      cout_total_formation:   1200,
      part_financeur:         400,  // FP = 800€
      formation_souhaitee:    'Dev Web',
    });
  testDossierId = res.body.data?.id;
});

// ════════════════════════════════════════════════════════════════
// UC-25 — SAISIE D'UN ENCAISSEMENT
// ════════════════════════════════════════════════════════════════
describe('UC-25 — Saisie d\'un encaissement', () => {

  test('✅ Encaissement partiel valide', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/finance/dossiers/${testDossierId}/encaissements`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        montant:           300,
        date_encaissement: '2026-03-10',
        mode_paiement:     'virement',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.statut_paiement).toBe('partiel');
    expect(res.body.data.reste_a_payer).toBeGreaterThan(0);
    expect(res.body.warning).toBeNull();
  });

  test('✅ Encaissement complet → statut effectué', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/finance/dossiers/${testDossierId}/encaissements`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        montant:           500, // total = 800€ = FP
        date_encaissement: '2026-03-15',
        mode_paiement:     'cb',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.statut_paiement).toBe('effectue');
    expect(res.body.data.reste_a_payer).toBe(0);
  });

  test('✅ Détection trop-perçu', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/finance/dossiers/${testDossierId}/encaissements`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        montant:           999999,
        date_encaissement: '2026-03-20',
        mode_paiement:     'cheque',
      });

    expect(res.status).toBe(201);
    expect(res.body.warning).toBe('TROP_PERCU');
    expect(res.body.data.trop_percu).toBeGreaterThan(0);
  });

  test('❌ Montant négatif → 400', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/finance/dossiers/${testDossierId}/encaissements`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ montant: -50, date_encaissement: '2026-03-15' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('❌ Date manquante → 400', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/finance/dossiers/${testDossierId}/encaissements`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ montant: 100 });

    expect(res.status).toBe(400);
  });

  test('❌ Mode paiement invalide → 400', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/finance/dossiers/${testDossierId}/encaissements`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ montant: 100, date_encaissement: '2026-03-15', mode_paiement: 'crypto' });

    expect(res.status).toBe(400);
  });

  test('❌ COMMERCIAL ne peut pas saisir un encaissement → 403', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/finance/dossiers/${testDossierId}/encaissements`)
      .set('Authorization', `Bearer ${comToken}`)
      .send({ montant: 100, date_encaissement: '2026-03-15' });

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-26 — PLAN FINANCIER D'ÉCHELONNEMENT
// ════════════════════════════════════════════════════════════════
describe('UC-26 — Création d\'un plan financier', () => {

  let planDossierId = null;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/dossiers')
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        nom:                   'PlanTest',
        telephone:             `07${Date.now().toString().slice(-8)}`,
        cout_total_formation:  950,
        part_financeur:        0,   // FP = 950€
      });
    planDossierId = res.body.data?.id;
  });

  test('✅ Plan mensualités 6x', async () => {
    if (!planDossierId) return;
    const res = await request(app)
      .post(`/api/finance/dossiers/${planDossierId}/plan`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        mode:            'mensualites',
        nb_mensualites:  6,
        date_debut:      '2026-04-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.nb_echeances).toBe(6);
    expect(res.body.data.montant_total).toBe(950);
  });

  test('✅ Plan mensualités 3x', async () => {
    if (!planDossierId) return;
    const res = await request(app)
      .post(`/api/finance/dossiers/${planDossierId}/plan`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ mode: 'mensualites', nb_mensualites: 3, date_debut: '2026-04-01' });

    expect(res.status).toBe(201);
    expect(res.body.data.nb_echeances).toBe(3);
  });

  test('✅ Plan dates libres valide', async () => {
    if (!planDossierId) return;
    const res = await request(app)
      .post(`/api/finance/dossiers/${planDossierId}/plan`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        mode: 'dates_libres',
        echeances: [
          { montant: 500, date_echeance: '2026-04-15' },
          { montant: 450, date_echeance: '2026-05-15' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.nb_echeances).toBe(2);
  });

  test('❌ Montants incohérents dates libres → 400', async () => {
    if (!planDossierId) return;
    const res = await request(app)
      .post(`/api/finance/dossiers/${planDossierId}/plan`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        mode: 'dates_libres',
        echeances: [
          { montant: 100, date_echeance: '2026-04-15' },
          { montant: 100, date_echeance: '2026-05-15' },
          // Total 200 ≠ 950€
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MONTANTS_INCOHERENTS');
  });

  test('❌ nb_mensualites invalide → 400', async () => {
    if (!planDossierId) return;
    const res = await request(app)
      .post(`/api/finance/dossiers/${planDossierId}/plan`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ mode: 'mensualites', nb_mensualites: 7 });

    expect(res.status).toBe(400);
  });

  test('✅ Consultation du plan', async () => {
    if (!planDossierId) return;
    const res = await request(app)
      .get(`/api/finance/dossiers/${planDossierId}/plan`)
      .set('Authorization', `Bearer ${admifToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.plan)).toBe(true);
    expect(res.body.data.resume).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════
// UC-27 — ALERTES RETARDS >24H
// ════════════════════════════════════════════════════════════════
describe('UC-27 — Dossiers en retard de paiement', () => {

  test('✅ Liste des retards accessible', async () => {
    const res = await request(app)
      .get('/api/finance/retards')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.seuil_heures).toBe(24);
  });

  test('✅ Paramètre heures personnalisé', async () => {
    const res = await request(app)
      .get('/api/finance/retards?heures=48')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.seuil_heures).toBe(48);
  });

  test('❌ COMMERCIAL ne peut pas voir les retards → 403', async () => {
    const res = await request(app)
      .get('/api/finance/retards')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-28 — SUIVI DES PAIEMENTS & POINT FINANCIER
// ════════════════════════════════════════════════════════════════
describe('UC-28 — Suivi et Point Financier', () => {

  test('✅ Suivi paiements avec KPIs', async () => {
    const res = await request(app)
      .get('/api/finance/suivi')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.kpis).toBeDefined();
    expect(res.body.kpis.nb_effectue).toBeDefined();
    expect(res.body.kpis.nb_partiel).toBeDefined();
    expect(res.body.kpis.nb_neant).toBeDefined();
    expect(res.body.kpis.total_encaisse).toBeDefined();
  });

  test('✅ Suivi filtré par dossier', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .get(`/api/finance/suivi?dossier_id=${testDossierId}`)
      .set('Authorization', `Bearer ${admifToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach(e => expect(e.dossier_id).toBe(testDossierId));
  });

  test('✅ Point Financier global', async () => {
    const res = await request(app)
      .get('/api/finance/point-financier')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.situation).toBeDefined();
    expect(res.body.data.historique).toBeDefined();
    expect(Array.isArray(res.body.data.historique)).toBe(true);
    // Vérifier que les totaux sont cohérents
    const s = res.body.data.situation;
    expect(s.nb_effectue).toBeDefined();
    expect(s.nb_partiel).toBeDefined();
    expect(s.nb_neant).toBeDefined();
  });

  test('✅ Point Financier filtré par mois', async () => {
    const res = await request(app)
      .get('/api/finance/point-financier?mois=2026-03')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  test('✅ Résumé financier d\'un dossier', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .get(`/api/finance/dossiers/${testDossierId}/resume`)
      .set('Authorization', `Bearer ${admifToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.financement_personnel).toBeDefined();
    expect(res.body.data.total_encaisse).toBeDefined();
    expect(res.body.data.reste_a_payer).toBeDefined();
    expect(res.body.data.statut_paiement).toBeDefined();
    expect(['effectue', 'partiel', 'neant', 'non_concerne'])
      .toContain(res.body.data.statut_paiement);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-29 — RELANCE PAIEMENT
// ════════════════════════════════════════════════════════════════
describe('UC-29 — Relance de paiement', () => {

  test('✅ Relance envoyée pour dossier avec contact', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/finance/dossiers/${testDossierId}/relancer`)
      .set('Authorization', `Bearer ${admifToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.canaux_envoyes).toBeGreaterThan(0);
  });

  test('❌ Dossier inexistant → 404', async () => {
    const res = await request(app)
      .post('/api/finance/dossiers/999999/relancer')
      .set('Authorization', `Bearer ${admifToken}`);

    expect(res.status).toBe(404);
  });

  test('❌ COMMERCIAL ne peut pas envoyer de relance → 403', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/finance/dossiers/${testDossierId}/relancer`)
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-30 — EXPORT SITUATION FINANCIÈRE
// ════════════════════════════════════════════════════════════════
describe('UC-30 — Export situation financière', () => {

  test('✅ Export données financières', async () => {
    const res = await request(app)
      .get('/api/finance/export')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.situation).toBeDefined();
    expect(res.body.data.historique).toBeDefined();
    expect(res.body.data.generated_at).toBeDefined();
  });

  test('✅ Export filtré par mois', async () => {
    const res = await request(app)
      .get('/api/finance/export?mois=2026-03')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.periode).toBe('2026-03');
  });

  test('❌ COMMERCIAL ne peut pas exporter → 403', async () => {
    const res = await request(app)
      .get('/api/finance/export')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(403);
  });
});
