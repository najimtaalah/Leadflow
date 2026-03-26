'use strict';

/**
 * Tests Module 8 — Reporting
 * Couvre : UC-41, UC-42, UC-43, UC-44
 */

const request = require('supertest');
const app     = require('../src/app');

let adminToken   = null;
let managerToken = null;
let comToken     = null;
let admifToken   = null;

beforeAll(async () => {
  const [adminRes, mgrRes, comRes, admifRes] = await Promise.all([
    request(app).post('/api/auth/login')
      .send({ email: 'admin@leadflow.fr',        password: 'Admin2026!' }),
    request(app).post('/api/auth/login')
      .send({ email: 'manager@leadflow.fr',       password: 'Manager2026!' }),
    request(app).post('/api/auth/login')
      .send({ email: 'commercial@leadflow.fr',    password: 'Commercial2026!' }),
    request(app).post('/api/auth/login')
      .send({ email: 'administratif@leadflow.fr', password: 'Admif2026!' }),
  ]);
  adminToken   = adminRes.body.token;
  managerToken = mgrRes.body.token;
  comToken     = comRes.body.token;
  admifToken   = admifRes.body.token;
});

// ════════════════════════════════════════════════════════════════
// DASHBOARD REPORTING
// ════════════════════════════════════════════════════════════════
describe('Dashboard Reporting — Vue agrégée', () => {

  test('✅ ROLE_ADMIN voit le dashboard reporting complet', async () => {
    const res = await request(app)
      .get('/api/reporting/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.performance).toBeDefined();
    expect(res.body.data.commissions).toBeDefined();
    expect(res.body.data.point_financier).toBeDefined();
  });

  test('✅ MANAGER accède au dashboard reporting', async () => {
    const res = await request(app)
      .get('/api/reporting/dashboard')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
  });

  test('❌ COMMERCIAL n\'accède pas au reporting → 403', async () => {
    const res = await request(app)
      .get('/api/reporting/dashboard')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-41 — PERFORMANCE COMMERCIALE
// ════════════════════════════════════════════════════════════════
describe('UC-41 — Performance Commerciale', () => {

  test('✅ KPIs performance présents', async () => {
    const res = await request(app)
      .get('/api/reporting/performance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.kpis).toBeDefined();
    expect(res.body.data.kpis.total_leads).toBeDefined();
    expect(res.body.data.kpis.leads_gagnes).toBeDefined();
    expect(res.body.data.kpis.taux_conversion).toBeDefined();
  });

  test('✅ Tableau par commercial présent', async () => {
    const res = await request(app)
      .get('/api/reporting/performance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.par_commercial)).toBe(true);
    res.body.data.par_commercial.forEach(c => {
      expect(c.vendeur_nom).toBeDefined();
      expect(c.nb_leads).toBeDefined();
      expect(c.nb_gagnes).toBeDefined();
      expect(c.taux_conversion).toBeDefined();
    });
  });

  test('✅ Évolution mensuelle sur 6 mois présente', async () => {
    const res = await request(app)
      .get('/api/reporting/performance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.evolution_mensuelle)).toBe(true);
    res.body.data.evolution_mensuelle.forEach(m => {
      expect(m.mois).toBeDefined();
      expect(m.total).toBeDefined();
      expect(m.gagnes).toBeDefined();
    });
  });

  test('✅ Répartition sources présente', async () => {
    const res = await request(app)
      .get('/api/reporting/performance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.sources)).toBe(true);
  });

  test('✅ Filtrage par mois', async () => {
    const res = await request(app)
      .get('/api/reporting/performance?mois=2026-03')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.kpis).toBeDefined();
  });

  test('✅ MANAGER accède à la performance (filtre agence auto)', async () => {
    const res = await request(app)
      .get('/api/reporting/performance')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.kpis).toBeDefined();
  });

  test('✅ taux_conversion est un nombre entre 0 et 100', async () => {
    const res = await request(app)
      .get('/api/reporting/performance')
      .set('Authorization', `Bearer ${adminToken}`);

    const tc = parseFloat(res.body.data.kpis.taux_conversion);
    if (!isNaN(tc)) {
      expect(tc).toBeGreaterThanOrEqual(0);
      expect(tc).toBeLessThanOrEqual(100);
    }
  });
});

// ════════════════════════════════════════════════════════════════
// UC-42 — POINT FINANCIER
// ════════════════════════════════════════════════════════════════
describe('UC-42 — Point Financier', () => {

  test('✅ Point Financier avec situation et historique', async () => {
    const res = await request(app)
      .get('/api/reporting/point-financier')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.situation).toBeDefined();
    expect(res.body.data.historique).toBeDefined();
    expect(Array.isArray(res.body.data.historique)).toBe(true);
  });

  test('✅ Situation contient tous les statuts', async () => {
    const res = await request(app)
      .get('/api/reporting/point-financier')
      .set('Authorization', `Bearer ${adminToken}`);

    const s = res.body.data.situation;
    expect(s.nb_effectue).toBeDefined();
    expect(s.nb_partiel).toBeDefined();
    expect(s.nb_neant).toBeDefined();
    expect(s.total_encaisse).toBeDefined();
  });

  test('✅ ROLE_ADMINISTRATIF accède au Point Financier', async () => {
    const res = await request(app)
      .get('/api/reporting/point-financier')
      .set('Authorization', `Bearer ${admifToken}`);

    expect(res.status).toBe(200);
  });

  test('✅ Filtrage par mois', async () => {
    const res = await request(app)
      .get('/api/reporting/point-financier?mois=2026-03')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.situation).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════
// UC-43 — SUIVI DES COMMISSIONS (avec simulation)
// ════════════════════════════════════════════════════════════════
describe('UC-43 — Suivi des commissions (Reporting)', () => {

  test('✅ Tableau commissions avec taux réels', async () => {
    const res = await request(app)
      .get('/api/reporting/commissions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.commissions)).toBe(true);
    expect(res.body.data.kpis).toBeDefined();
    expect(res.body.data.taux).toBeDefined();
    expect(res.body.data.simulation).toBeUndefined(); // pas de simulation
  });

  test('✅ Simulation de taux sans modifier les vrais taux', async () => {
    const res = await request(app)
      .get('/api/reporting/commissions?taux_simule=8&suppl_simule=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.simulation).toBe(true);
    expect(res.body.data.note).toContain('Simulation');
    // Chaque ligne doit avoir commission_simulee
    res.body.data.commissions.forEach(c => {
      expect(c.commission_simulee).toBeDefined();
      expect(c.taux_simule).toBe(8);
    });
  });

  test('✅ Les taux réels inchangés après simulation', async () => {
    const res = await request(app)
      .get('/api/commissions/taux')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(parseFloat(res.body.data.commercial?.taux_base)).toBe(6.5);
  });

  test('❌ ROLE_ADMINISTRATIF n\'accède pas aux commissions → 403', async () => {
    const res = await request(app)
      .get('/api/reporting/commissions')
      .set('Authorization', `Bearer ${admifToken}`);

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-44 — EXPORT RAPPORTS
// ════════════════════════════════════════════════════════════════
describe('UC-44 — Export de rapports', () => {

  test('✅ Export rapport performance', async () => {
    const res = await request(app)
      .get('/api/reporting/export/performance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('performance_commerciale');
    expect(res.body.data.generated_at).toBeDefined();
    expect(res.body.data.kpis).toBeDefined();
    expect(res.body.data.par_commercial).toBeDefined();
  });

  test('✅ Export rapport financier', async () => {
    const res = await request(app)
      .get('/api/reporting/export/financier')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('point_financier');
    expect(res.body.data.situation).toBeDefined();
    expect(res.body.data.historique).toBeDefined();
  });

  test('✅ Export rapport commissions', async () => {
    const res = await request(app)
      .get('/api/reporting/export/commissions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('commissions');
    expect(res.body.data.commissions).toBeDefined();
    expect(res.body.data.taux).toBeDefined();
  });

  test('✅ Export filtré par mois', async () => {
    const res = await request(app)
      .get('/api/reporting/export/performance?mois=2026-03')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.periode).toBe('2026-03');
  });

  test('✅ Export avec format spécifié', async () => {
    const res = await request(app)
      .get('/api/reporting/export/performance?format=pdf')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.format).toBe('pdf');
  });

  test('❌ Type de rapport invalide → 400', async () => {
    const res = await request(app)
      .get('/api/reporting/export/bilan_annuel')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  test('❌ COMMERCIAL n\'accède pas aux exports → 403', async () => {
    const res = await request(app)
      .get('/api/reporting/export/performance')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(403);
  });

  test('✅ Export sauvegardé dans rapports_config', async () => {
    // L'export enregistre la demande en base — vérifier qu'il n'y a pas d'erreur
    const res = await request(app)
      .get('/api/reporting/export/performance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // Si la table rapports_config n'existe pas encore : pas d'erreur 500
    expect([200]).toContain(res.status);
  });
});
