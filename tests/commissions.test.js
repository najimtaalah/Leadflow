'use strict';

/**
 * Tests Module 7 — Commissions
 * Couvre : UC-37, UC-38, UC-39, UC-40
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
// TAUX DE COMMISSION
// ════════════════════════════════════════════════════════════════
describe('Taux de commission (config_commissions)', () => {

  test('✅ Consultation des taux accessibles pour tous les rôles concernés', async () => {
    const res = await request(app)
      .get('/api/commissions/taux')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    // Doit avoir au moins les taux commercial et manager
    expect(res.body.data.commercial || res.body.data.manager).toBeDefined();
  });

  test('✅ Taux commercial = 6.5%', async () => {
    const res = await request(app)
      .get('/api/commissions/taux')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    if (res.body.data.commercial) {
      expect(parseFloat(res.body.data.commercial.taux_base)).toBe(6.5);
    }
  });

  test('✅ Taux supplément manager = 1.5%', async () => {
    const res = await request(app)
      .get('/api/commissions/taux')
      .set('Authorization', `Bearer ${adminToken}`);

    if (res.body.data.manager) {
      expect(parseFloat(res.body.data.manager.taux_supplement_equipe)).toBe(1.5);
    }
  });
});

// ════════════════════════════════════════════════════════════════
// UC-37 — COMMISSIONS D'UN COMMERCIAL
// ════════════════════════════════════════════════════════════════
describe('UC-37 — Commissions d\'un commercial', () => {

  test('✅ Commercial consulte ses propres commissions', async () => {
    const res = await request(app)
      .get('/api/commissions/mes-commissions')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.type).toBe('commercial');
    expect(res.body.data.dossiers).toBeDefined();
    expect(res.body.data.taux_base).toBeDefined();
    expect(res.body.data.total_commission).toBeDefined();
  });

  test('✅ Filtrage par mois', async () => {
    const res = await request(app)
      .get('/api/commissions/mes-commissions?mois=2026-03')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.dossiers).toBeDefined();
  });

  test('✅ Commission calculée correctement (6.5% du CA)', async () => {
    const res = await request(app)
      .get('/api/commissions/mes-commissions')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(200);
    // Vérifier que chaque commission = base_calcul × 6.5%
    res.body.data.dossiers.forEach(d => {
      const expectedComm = Math.round(d.base_calcul * d.taux_base / 100 * 100) / 100;
      expect(parseFloat(d.commission)).toBeCloseTo(expectedComm, 1);
    });
  });

  test('❌ ROLE_ADMINISTRATIF ne peut pas consulter les commissions → 403', async () => {
    const res = await request(app)
      .get('/api/commissions/mes-commissions')
      .set('Authorization', `Bearer ${admifToken}`);

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-38 — COMMISSIONS MANAGER
// ════════════════════════════════════════════════════════════════
describe('UC-38 — Commissions manager (propre + supplément équipe)', () => {

  test('✅ Manager voit ses commissions avec détail équipe', async () => {
    const res = await request(app)
      .get('/api/commissions/mes-commissions')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('manager');
    expect(res.body.data.manager).toBeDefined();
    expect(res.body.data.equipe).toBeDefined();
    expect(res.body.data.totaux).toBeDefined();
    expect(res.body.data.totaux.commission_propre).toBeDefined();
    expect(res.body.data.totaux.supplement_equipe).toBeDefined();
    expect(res.body.data.totaux.commission_totale).toBeDefined();
  });

  test('✅ commission_totale = propre + supplément', async () => {
    const res = await request(app)
      .get('/api/commissions/mes-commissions')
      .set('Authorization', `Bearer ${managerToken}`);

    if (res.status === 200 && res.body.type === 'manager') {
      const t = res.body.data.totaux;
      const expected = Math.round((t.commission_propre + t.supplement_equipe) * 100) / 100;
      expect(t.commission_totale).toBeCloseTo(expected, 1);
    }
  });

  test('✅ Tableau équipe accessible par ROLE_ADMIN', async () => {
    const res = await request(app)
      .get('/api/commissions/equipe')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.kpis).toBeDefined();
    expect(res.body.taux).toBeDefined();
  });

  test('✅ Tableau équipe contient les taux et suppléments', async () => {
    const res = await request(app)
      .get('/api/commissions/equipe')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach(c => {
      expect(c.vendeur_nom).toBeDefined();
      expect(c.commission_totale).toBeDefined();
    });
  });

  test('❌ COMMERCIAL ne peut pas voir les commissions équipe → 403', async () => {
    const res = await request(app)
      .get('/api/commissions/equipe')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-39 — MODIFICATION DES TAUX (SUPER_ADMIN)
// ════════════════════════════════════════════════════════════════
describe('UC-39 — Modification des taux de commission', () => {

  const TAUX_ORIGINAL_COM = 6.5;
  const TAUX_ORIGINAL_MGR_SUPPL = 1.5;

  test('✅ SUPER_ADMIN peut modifier le taux commercial', async () => {
    const res = await request(app)
      .patch('/api/commissions/taux')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_nom: 'commercial', taux_base: 7.0 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(parseFloat(res.body.data.taux_base)).toBe(7.0);
  });

  test('✅ Remettre le taux original après test', async () => {
    const res = await request(app)
      .patch('/api/commissions/taux')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_nom: 'commercial', taux_base: TAUX_ORIGINAL_COM });

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.data.taux_base)).toBe(TAUX_ORIGINAL_COM);
  });

  test('✅ Modification taux supplément manager', async () => {
    const res = await request(app)
      .patch('/api/commissions/taux')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_nom: 'manager', taux_supplement_equipe: 2.0 });

    expect(res.status).toBe(200);
    // Remettre à 1.5
    await request(app)
      .patch('/api/commissions/taux')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_nom: 'manager', taux_supplement_equipe: TAUX_ORIGINAL_MGR_SUPPL });
  });

  test('❌ Taux négatif → 400', async () => {
    const res = await request(app)
      .patch('/api/commissions/taux')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_nom: 'commercial', taux_base: -1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('❌ Taux > 100% → 400', async () => {
    const res = await request(app)
      .patch('/api/commissions/taux')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_nom: 'commercial', taux_base: 150 });

    expect(res.status).toBe(400);
  });

  test('❌ role_nom invalide → 400', async () => {
    const res = await request(app)
      .patch('/api/commissions/taux')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_nom: 'agent_accueil', taux_base: 5 });

    expect(res.status).toBe(400);
  });

  test('❌ MANAGER ne peut pas modifier les taux → 403', async () => {
    const res = await request(app)
      .patch('/api/commissions/taux')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ role_nom: 'commercial', taux_base: 8 });

    expect(res.status).toBe(403);
  });

  test('❌ COMMERCIAL ne peut pas modifier les taux → 403', async () => {
    const res = await request(app)
      .patch('/api/commissions/taux')
      .set('Authorization', `Bearer ${comToken}`)
      .send({ role_nom: 'commercial', taux_base: 10 });

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-40 — EXPORT HISTORIQUE COMMISSIONS
// ════════════════════════════════════════════════════════════════
describe('UC-40 — Export historique commissions', () => {

  test('✅ Commercial exporte son propre historique', async () => {
    const res = await request(app)
      .get('/api/commissions/export')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.historique).toBeDefined();
    expect(Array.isArray(res.body.data.historique)).toBe(true);
    expect(res.body.data.totaux).toBeDefined();
    expect(res.body.data.totaux.total_commissions).toBeDefined();
    expect(res.body.data.generated_at).toBeDefined();
  });

  test('✅ Paramètre nb_mois respecté', async () => {
    const res = await request(app)
      .get('/api/commissions/export?mois=6')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.nb_mois).toBe(6);
  });

  test('✅ ADMIN exporte l\'historique d\'un commercial spécifique', async () => {
    const db = require('../src/config/database');
    const [[com]] = await db.query(
      "SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.nom='commercial' LIMIT 1"
    );
    if (!com) return;

    const res = await request(app)
      .get(`/api/commissions/export/${com.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.vendeur_id).toBe(com.id);
  });

  test('❌ Commercial ne peut pas exporter les données d\'un autre → 403', async () => {
    const res = await request(app)
      .get('/api/commissions/export/999')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════
// SIMULATION DE TAUX
// ════════════════════════════════════════════════════════════════
describe('Simulation de taux (sans enregistrer)', () => {

  test('✅ Simulation avec taux personnalisés', async () => {
    const res = await request(app)
      .get('/api/commissions/simulation?taux_commercial=7&taux_supplement_manager=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.simulation).toBe(true);
    expect(res.body.note).toContain('simulation');
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach(c => {
      expect(c.simule).toBeDefined();
      expect(c.simule.taux_com).toBe(7);
    });
  });

  test('✅ Les taux réels ne sont pas modifiés après simulation', async () => {
    const res = await request(app)
      .get('/api/commissions/taux')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    if (res.body.data.commercial) {
      expect(parseFloat(res.body.data.commercial.taux_base)).toBe(6.5);
    }
  });

  test('❌ COMMERCIAL ne peut pas simuler → 403', async () => {
    const res = await request(app)
      .get('/api/commissions/simulation')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(403);
  });
});
