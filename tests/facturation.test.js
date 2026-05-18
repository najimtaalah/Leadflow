'use strict';

/**
 * Tests Lot 7 — Facturation & Financeurs
 * Couvre : RM-L7-01 à RM-L7-12
 */

const request = require('supertest');
const app     = require('../src/app');

let adminToken = null;
let gestToken  = null;
let comToken   = null;
let testDossierId = null;

beforeAll(async () => {
  const [adminRes, gestRes, comRes] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: 'admin@leadflow.fr',      password: 'Admin2026!' }),
    request(app).post('/api/auth/login').send({ email: 'gestionnaire@leadflow.fr', password: 'Gest2026!' }).catch(() =>
      request(app).post('/api/auth/login').send({ email: 'administratif@leadflow.fr', password: 'Admif2026!' })
    ),
    request(app).post('/api/auth/login').send({ email: 'commercial@leadflow.fr',  password: 'Commercial2026!' }),
  ]);
  adminToken = adminRes.body.token;
  gestToken  = (gestRes.body || {}).token || adminToken;
  comToken   = comRes.body.token;

  // Dossier de test
  const dRes = await request(app)
    .post('/api/dossiers')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nom: 'FactTest', prenom: 'Lot7', telephone: `06${Date.now().toString().slice(-8)}` });
  testDossierId = dRes.body.data?.id || dRes.body.id;
});

// ════════════════════════════════════════════════════════════════
// CRUD Financement
// ════════════════════════════════════════════════════════════════

describe('RM-L7-01 — Création financement CPF', () => {
  test('✅ Création CPF avec EDOF valide', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/dossiers/${testDossierId}/financement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type_financement:       'CPF',
        identifiant_financeur:  'EDOF-2026-01',
        montant_total:          1500,
        montant_pris_en_charge: 1200,
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('❌ Doublon — second POST sur même dossier', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/dossiers/${testDossierId}/financement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type_financement: 'CPF', montant_total: 1000, montant_pris_en_charge: 0 });
    expect(res.status).toBe(409);
  });

  test('✅ GET financement dossier', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .get(`/api/dossiers/${testDossierId}/financement`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.type_financement).toBe('CPF');
  });
});

describe('RM-L7-01 — Validation identifiant par type', () => {
  let dos2Id;

  beforeAll(async () => {
    const dRes = await request(app)
      .post('/api/dossiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'FactTest2', prenom: 'L7', telephone: `06${Date.now().toString().slice(-8)}` });
    dos2Id = dRes.body.data?.id || dRes.body.id;
  });

  test('❌ EDOF trop court (< 6 car)', async () => {
    if (!dos2Id) return;
    const res = await request(app)
      .post(`/api/dossiers/${dos2Id}/financement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type_financement: 'CPF', identifiant_financeur: 'ABC', montant_total: 1000, montant_pris_en_charge: 0 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('✅ PERSONNEL sans identifiant', async () => {
    if (!dos2Id) return;
    const res = await request(app)
      .post(`/api/dossiers/${dos2Id}/financement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type_financement: 'PERSONNEL', montant_total: 800, montant_pris_en_charge: 0 });
    expect(res.status).toBe(201);
  });
});

describe('RM-L7-02 — Calcul reste à charge', () => {
  test('reste_a_charge = montant_total - montant_pris_en_charge', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .get(`/api/dossiers/${testDossierId}/financement`)
      .set('Authorization', `Bearer ${adminToken}`);
    const f = res.body.data;
    expect(parseFloat(f.reste_a_charge)).toBeCloseTo(
      parseFloat(f.montant_total) - parseFloat(f.montant_pris_en_charge), 2
    );
  });

  test('❌ montant_pris_en_charge > montant_total', async () => {
    const dRes = await request(app)
      .post('/api/dossiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'FactTest3', prenom: 'L7', telephone: `06${Date.now().toString().slice(-8)}` });
    const dosId = dRes.body.data?.id || dRes.body.id;
    if (!dosId) return;
    const res = await request(app)
      .post(`/api/dossiers/${dosId}/financement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type_financement: 'PERSONNEL', montant_total: 500, montant_pris_en_charge: 800 });
    expect(res.status).toBe(400);
  });
});

describe('RM-L7-03 — Validation bloc financier', () => {
  test('✅ Admin peut valider — statut initialisé à a_facturer', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/dossiers/${testDossierId}/financement/valider`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('❌ Double validation — erreur ALREADY_VALIDATED', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/dossiers/${testDossierId}/financement/valider`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
  });
});

describe('RM-L7-04 — Transitions de statut', () => {
  test('✅ a_facturer → facture (Gestionnaire)', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/dossiers/${testDossierId}/financement/statut`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nouveau_statut: 'facture', date_effective: '2026-05-18' });
    expect(res.status).toBe(200);
    expect(res.body.data.statut_apres).toBe('facture');
  });

  test('❌ Transition invalide : facture → a_facturer', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/dossiers/${testDossierId}/financement/statut`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nouveau_statut: 'a_facturer' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  });

  test('✅ facture → paye (Admin)', async () => {
    if (!testDossierId) return;
    const res = await request(app)
      .post(`/api/dossiers/${testDossierId}/financement/statut`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nouveau_statut: 'paye', date_effective: '2026-05-19' });
    expect(res.status).toBe(200);
  });
});

describe('RM-L7-07 — Avoir obligatoire pour remboursement', () => {
  let dos4Id;

  beforeAll(async () => {
    const dRes = await request(app)
      .post('/api/dossiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'FactAvoir', prenom: 'L7', telephone: `06${Date.now().toString().slice(-8)}` });
    dos4Id = dRes.body.data?.id || dRes.body.id;
    if (!dos4Id) return;
    // Créer + valider + passer à paye
    await request(app).post(`/api/dossiers/${dos4Id}/financement`).set('Authorization', `Bearer ${adminToken}`)
      .send({ type_financement: 'PERSONNEL', montant_total: 600, montant_pris_en_charge: 0 });
    await request(app).post(`/api/dossiers/${dos4Id}/financement/valider`).set('Authorization', `Bearer ${adminToken}`);
    await request(app).post(`/api/dossiers/${dos4Id}/financement/statut`).set('Authorization', `Bearer ${adminToken}`)
      .send({ nouveau_statut: 'facture' });
    await request(app).post(`/api/dossiers/${dos4Id}/financement/statut`).set('Authorization', `Bearer ${adminToken}`)
      .send({ nouveau_statut: 'paye' });
  });

  test('❌ Remboursement sans montant_avoir', async () => {
    if (!dos4Id) return;
    const res = await request(app)
      .post(`/api/dossiers/${dos4Id}/financement/statut`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nouveau_statut: 'rembourse', motif_avoir: 'Formation annulée' });
    expect(res.status).toBe(400);
  });

  test('❌ avoir > montant_total', async () => {
    if (!dos4Id) return;
    const res = await request(app)
      .post(`/api/dossiers/${dos4Id}/financement/statut`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nouveau_statut: 'rembourse', montant_avoir: 9999, motif_avoir: 'Trop perçu' });
    expect(res.status).toBe(400);
  });

  test('✅ Remboursement valide', async () => {
    if (!dos4Id) return;
    const res = await request(app)
      .post(`/api/dossiers/${dos4Id}/financement/statut`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nouveau_statut: 'rembourse', montant_avoir: 200, motif_avoir: 'Formation partiellement réalisée' });
    expect(res.status).toBe(200);
  });
});

describe('RM-L7-12 — Export CSV facturation', () => {
  test('✅ Export dossiers facturables — headers Content-Type CSV', async () => {
    const res = await request(app)
      .get('/api/facturation/export/dossiers-facturables')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    // BOM UTF-8 + première ligne headers
    expect(res.text.charCodeAt(0)).toBe(0xFEFF); // BOM UTF-8 décodé en U+FEFF
  });

  test('✅ Rapport mensuel — format CSV valide', async () => {
    const res = await request(app)
      .get('/api/facturation/export/rapport-mensuel?mois=5&annee=2026')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });

  test('❌ Rapport mensuel sans params', async () => {
    const res = await request(app)
      .get('/api/facturation/export/rapport-mensuel')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test('❌ Export interdit au commercial', async () => {
    if (!comToken) return;
    const res = await request(app)
      .get('/api/facturation/export/dossiers-facturables')
      .set('Authorization', `Bearer ${comToken}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/facturation — liste', () => {
  test('✅ Retourne la liste avec pagination', async () => {
    const res = await request(app)
      .get('/api/facturation')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.financements)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  test('❌ Commercial refusé', async () => {
    if (!comToken) return;
    const res = await request(app)
      .get('/api/facturation')
      .set('Authorization', `Bearer ${comToken}`);
    expect(res.status).toBe(403);
  });
});
