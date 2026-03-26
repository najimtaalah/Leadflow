'use strict';

/**
 * Tests Module 3 — Dossiers & CMA
 * Couvre : UC-13, UC-14, UC-15, UC-16, UC-17, UC-18
 *
 * Pour exécuter : npm test tests/dossiers.test.js
 */

const request = require('supertest');
const app     = require('../src/app');

let adminToken  = null;
let admifToken  = null;  // role_administratif
let comToken    = null;  // commercial
let createdDossierId = null;

// ── Setup tokens ─────────────────────────────────────────────────────────────
beforeAll(async () => {
  const [adminRes, admifRes, comRes] = await Promise.all([
    request(app).post('/api/auth/login')
      .send({ email: 'admin@leadflow.fr',      password: 'Admin2026!' }),
    request(app).post('/api/auth/login')
      .send({ email: 'administratif@leadflow.fr', password: 'Admif2026!' }),
    request(app).post('/api/auth/login')
      .send({ email: 'commercial@leadflow.fr', password: 'Commercial2026!' }),
  ]);
  adminToken = adminRes.body.token;
  admifToken = admifRes.body.token;
  comToken   = comRes.body.token;
});

// ════════════════════════════════════════════════════════════════
// UC-13 — CRÉATION MANUELLE D'UN DOSSIER
// ════════════════════════════════════════════════════════════════
describe('UC-13 — Création manuelle d\'un dossier', () => {

  test('✅ Création valide par ROLE_ADMINISTRATIF', async () => {
    const res = await request(app)
      .post('/api/dossiers')
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        nom:                 'Martin',
        prenom:              'Sophie',
        telephone:           `07${Date.now().toString().slice(-8)}`,
        email:               `sophie.martin.${Date.now()}@test.fr`,
        formation_souhaitee: 'Dev Web',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    createdDossierId = res.body.data.id;
  });

  test('✅ Création valide par ROLE_ADMIN', async () => {
    const res = await request(app)
      .post('/api/dossiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nom:       'Durand',
        prenom:    'Jean',
        telephone: `06${Date.now().toString().slice(-8)}`,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
  });

  test('❌ COMMERCIAL ne peut pas créer un dossier manuellement → 403', async () => {
    const res = await request(app)
      .post('/api/dossiers')
      .set('Authorization', `Bearer ${comToken}`)
      .send({ nom: 'Test', telephone: '0699999999' });

    expect(res.status).toBe(403);
  });

  test('❌ Nom manquant → 400', async () => {
    const res = await request(app)
      .post('/api/dossiers')
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ telephone: '0612345678' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('❌ Sans authentification → 401', async () => {
    const res = await request(app)
      .post('/api/dossiers')
      .send({ nom: 'Test', telephone: '0612345678' });

    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-17 — CONSULTATION DES DOSSIERS
// ════════════════════════════════════════════════════════════════
describe('UC-17 — Consultation des dossiers', () => {

  test('✅ ROLE_ADMIN voit tous les dossiers', async () => {
    const res = await request(app)
      .get('/api/dossiers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeDefined();
  });

  test('✅ Dossiers contiennent financement_personnel et total_encaisse', async () => {
    const res = await request(app)
      .get('/api/dossiers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    if (res.body.data.length > 0) {
      const d = res.body.data[0];
      expect(d.financement_personnel).toBeDefined();
      expect(d.total_encaisse).toBeDefined();
      expect(d.reste_a_payer).toBeDefined();
    }
  });

  test('✅ Filtrage par frais_cma_paye=0', async () => {
    const res = await request(app)
      .get('/api/dossiers?frais_cma_paye=0')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach(d => expect(d.frais_cma_paye).toBe(0));
  });

  test('✅ Détail d\'un dossier avec encaissements', async () => {
    if (!createdDossierId) return;
    const res = await request(app)
      .get(`/api/dossiers/${createdDossierId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.encaissements).toBeDefined();
    expect(Array.isArray(res.body.data.encaissements)).toBe(true);
    expect(res.body.data.statut_paiement).toBeDefined();
    // password_hash ne doit jamais apparaître
    expect(res.body.data.password_hash).toBeUndefined();
  });

  test('❌ Dossier inexistant → 404', async () => {
    const res = await request(app)
      .get('/api/dossiers/999999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  test('✅ KPIs dossiers accessibles', async () => {
    const res = await request(app)
      .get('/api/dossiers/kpis')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total_dossiers).toBeDefined();
    expect(res.body.data.cma_non_reglees).toBeDefined();
  });

  test('✅ Recherche par nom', async () => {
    const res = await request(app)
      .get('/api/dossiers?search=Martin')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-14 — SAISIE DES FRAIS CMA
// ════════════════════════════════════════════════════════════════
describe('UC-14 — Saisie des frais CMA', () => {

  test('✅ ROLE_ADMINISTRATIF peut saisir les frais CMA', async () => {
    if (!createdDossierId) return;
    const res = await request(app)
      .patch(`/api/dossiers/${createdDossierId}/cma`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ frais_cma: 180, frais_cma_paye: 0 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('✅ Marquer les frais CMA comme payés → dossier débloqué', async () => {
    if (!createdDossierId) return;
    const res = await request(app)
      .patch(`/api/dossiers/${createdDossierId}/cma`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ frais_cma: 180, frais_cma_paye: 1 });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('débloqué');
  });

  test('❌ COMMERCIAL ne peut pas saisir les frais CMA → 403', async () => {
    if (!createdDossierId) return;
    const res = await request(app)
      .patch(`/api/dossiers/${createdDossierId}/cma`)
      .set('Authorization', `Bearer ${comToken}`)
      .send({ frais_cma: 180, frais_cma_paye: 1 });

    expect(res.status).toBe(403);
  });

  test('❌ Marquer payé sans montant → 400', async () => {
    // Créer un dossier vierge
    const createRes = await request(app)
      .post('/api/dossiers')
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ nom: 'TestCMA', telephone: `06${Date.now().toString().slice(-8)}` });

    const newId = createRes.body.data?.id;
    if (!newId) return;

    const res = await request(app)
      .patch(`/api/dossiers/${newId}/cma`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ frais_cma_paye: 1 }); // Pas de montant saisi

    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-15 — VALIDATION D'UN DOSSIER
// ════════════════════════════════════════════════════════════════
describe('UC-15 — Validation d\'un dossier', () => {

  test('✅ Validation réussie quand CMA payée', async () => {
    if (!createdDossierId) return;
    // createdDossierId a déjà été marqué CMA payé dans UC-14
    const res = await request(app)
      .post(`/api/dossiers/${createdDossierId}/valider`)
      .set('Authorization', `Bearer ${admifToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('validé');
  });

  test('❌ Validation impossible si CMA non payée → 400', async () => {
    // Créer un dossier avec frais CMA non payés
    const createRes = await request(app)
      .post('/api/dossiers')
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ nom: 'CMABloque', telephone: `07${Date.now().toString().slice(-8)}` });

    const newId = createRes.body.data?.id;
    if (!newId) return;

    // Saisir frais CMA sans payer
    await request(app)
      .patch(`/api/dossiers/${newId}/cma`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ frais_cma: 200, frais_cma_paye: 0 });

    const res = await request(app)
      .post(`/api/dossiers/${newId}/valider`)
      .set('Authorization', `Bearer ${admifToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CMA_NOT_PAID');
  });

  test('❌ Validation dossier inexistant → 404 ou 400', async () => {
    const res = await request(app)
      .post('/api/dossiers/999999/valider')
      .set('Authorization', `Bearer ${admifToken}`);

    expect([400, 404]).toContain(res.status);
  });
});

// ════════════════════════════════════════════════════════════════
// ENCAISSEMENTS
// ════════════════════════════════════════════════════════════════
describe('Encaissements', () => {

  test('✅ Ajout d\'un encaissement', async () => {
    if (!createdDossierId) return;
    const res = await request(app)
      .post(`/api/dossiers/${createdDossierId}/encaissements`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        montant:           500,
        date_encaissement: '2026-03-15',
        mode_paiement:     'virement',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.statut_paiement).toBeDefined();
  });

  test('✅ Statut paiement calculé automatiquement après encaissement', async () => {
    if (!createdDossierId) return;
    const res = await request(app)
      .post(`/api/dossiers/${createdDossierId}/encaissements`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        montant:           500,
        date_encaissement: '2026-03-16',
        mode_paiement:     'cb',
      });

    expect(res.status).toBe(201);
    // statut_paiement doit être 'partiel' ou 'effectue' selon le FP
    expect(['partiel', 'effectue', 'non_concerne']).toContain(
      res.body.data.statut_paiement
    );
  });

  test('✅ Alerte trop-perçu si montant > reste à payer', async () => {
    if (!createdDossierId) return;
    const res = await request(app)
      .post(`/api/dossiers/${createdDossierId}/encaissements`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        montant:           999999,
        date_encaissement: '2026-03-17',
        mode_paiement:     'virement',
      });

    expect(res.status).toBe(201);
    // Doit signaler le trop-perçu
    expect(res.body.warning).toBe('TROP_PERCU');
  });

  test('❌ Montant invalide → 400', async () => {
    if (!createdDossierId) return;
    const res = await request(app)
      .post(`/api/dossiers/${createdDossierId}/encaissements`)
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ montant: -100, date_encaissement: '2026-03-15' });

    expect(res.status).toBe(400);
  });

  test('✅ Liste des encaissements d\'un dossier', async () => {
    if (!createdDossierId) return;
    const res = await request(app)
      .get(`/api/dossiers/${createdDossierId}/encaissements`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-18 — ARCHIVAGE
// ════════════════════════════════════════════════════════════════
describe('UC-18 — Archivage d\'un dossier', () => {

  test('❌ Archivage impossible si solde > 0 → 400', async () => {
    // Créer un dossier avec financement personnel non soldé
    const createRes = await request(app)
      .post('/api/dossiers')
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        nom:                     'NonSolde',
        telephone:               `06${Date.now().toString().slice(-8)}`,
        cout_total_formation:    1000,
        part_financeur:          0,
      });

    const newId = createRes.body.data?.id;
    if (!newId) return;

    const res = await request(app)
      .post(`/api/dossiers/${newId}/archiver`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SOLDE_NON_SOLDE');
  });

  test('❌ ROLE_ADMINISTRATIF ne peut pas archiver → 403', async () => {
    if (!createdDossierId) return;
    const res = await request(app)
      .post(`/api/dossiers/${createdDossierId}/archiver`)
      .set('Authorization', `Bearer ${admifToken}`);

    expect(res.status).toBe(403);
  });

  test('✅ Archivage réussi quand dossier soldé', async () => {
    // Créer un dossier sans financement personnel (gratuit)
    const createRes = await request(app)
      .post('/api/dossiers')
      .set('Authorization', `Bearer ${admifToken}`)
      .send({
        nom:                  'Solde',
        telephone:            `07${Date.now().toString().slice(-8)}`,
        cout_total_formation: 0,
        part_financeur:       0,
      });

    const newId = createRes.body.data?.id;
    if (!newId) return;

    const res = await request(app)
      .post(`/api/dossiers/${newId}/archiver`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('✅ Dossier archivé masqué de la liste par défaut', async () => {
    const res = await request(app)
      .get('/api/dossiers') // archived=0 par défaut
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // Tous les dossiers retournés ont archived = 0
    res.body.data.forEach(d => expect(d.archived).toBe(0));
  });

  test('✅ Dossiers archivés visibles avec ?archived=1', async () => {
    const res = await request(app)
      .get('/api/dossiers?archived=1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-16 — IMPORT (Structure / Parsing)
// ════════════════════════════════════════════════════════════════
describe('UC-16 — Import fichiers', () => {

  test('❌ Import Gestion sans fichier → 400', async () => {
    const res = await request(app)
      .post('/api/dossiers/import/gestion')
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ mode: 'mettre_a_jour' }); // pas de rows

    expect(res.status).toBe(400);
  });

  test('❌ Mode import invalide → 400', async () => {
    const res = await request(app)
      .post('/api/dossiers/import/gestion')
      .set('Authorization', `Bearer ${admifToken}`)
      .send({ mode: 'mode_inexistant', rows: [] });

    // 400 car mode invalide ou rows vide
    expect([400]).toContain(res.status);
  });

  test('✅ Historique des imports accessible', async () => {
    const res = await request(app)
      .get('/api/dossiers/import/history')
      .set('Authorization', `Bearer ${admifToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('❌ COMMERCIAL ne peut pas accéder à l\'import → 403', async () => {
    const res = await request(app)
      .get('/api/dossiers/import/history')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(403);
  });
});
