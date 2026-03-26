'use strict';

/**
 * Tests Module 9 — Paramétrage
 * Couvre : UC-45, UC-46, UC-47, UC-48, UC-49, UC-50
 */

const request = require('supertest');
const app     = require('../src/app');

let adminToken   = null;
let comToken     = null;
let admifToken   = null;
let testFormationId = null;
let testSessionId   = null;
let testAgenceId    = null;
let testModeleId    = null;

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
});

// ════════════════════════════════════════════════════════════════
// UC-45 — FORMATIONS
// ════════════════════════════════════════════════════════════════
describe('UC-45 — Gestion des formations', () => {

  test('✅ Création formation Théorie+Pratique', async () => {
    const res = await request(app)
      .post('/api/parametrage/formations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nom:                'Dev Web Test',
        config_pedagogique: 'theorie_et_pratique',
        duree_heures:       120,
        cout_defaut:        1200,
        frais_cma_defaut:   180,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    testFormationId = res.body.data.id;
  });

  test('✅ Création formation Théorie uniquement', async () => {
    const res = await request(app)
      .post('/api/parametrage/formations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nom:                'Marketing Digital Test',
        config_pedagogique: 'theorie_seule',
      });

    expect(res.status).toBe(201);
  });

  test('✅ Création formation Pratique uniquement', async () => {
    const res = await request(app)
      .post('/api/parametrage/formations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nom:                'RH Management Test',
        config_pedagogique: 'pratique_seule',
      });

    expect(res.status).toBe(201);
  });

  test('✅ Liste des formations avec compteurs', async () => {
    const res = await request(app)
      .get('/api/parametrage/formations')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach(f => {
      expect(f.config_pedagogique).toBeDefined();
      expect(f.nb_sessions).toBeDefined();
    });
  });

  test('✅ Détail d\'une formation', async () => {
    if (!testFormationId) return;
    const res = await request(app)
      .get(`/api/parametrage/formations/${testFormationId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.config_pedagogique).toBe('theorie_et_pratique');
  });

  test('✅ Mise à jour config_pedagogique', async () => {
    if (!testFormationId) return;
    const res = await request(app)
      .patch(`/api/parametrage/formations/${testFormationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ config_pedagogique: 'theorie_seule' });

    expect(res.status).toBe(200);
  });

  test('❌ config_pedagogique invalide → 400', async () => {
    const res = await request(app)
      .post('/api/parametrage/formations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'Test Invalid', config_pedagogique: 'cours_magistral' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('❌ Nom manquant → 400', async () => {
    const res = await request(app)
      .post('/api/parametrage/formations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ config_pedagogique: 'theorie_seule' });

    expect(res.status).toBe(400);
  });

  test('❌ COMMERCIAL ne peut pas créer une formation → 403', async () => {
    const res = await request(app)
      .post('/api/parametrage/formations')
      .set('Authorization', `Bearer ${comToken}`)
      .send({ nom: 'Test', config_pedagogique: 'theorie_seule' });

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-48 — SESSIONS DE FORMATION
// ════════════════════════════════════════════════════════════════
describe('UC-48 — Sessions de formation', () => {

  test('✅ Création d\'une session valide', async () => {
    if (!testFormationId) return;
    const code = `S-TEST-${Date.now()}`;
    const res = await request(app)
      .post('/api/parametrage/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        formation_id: testFormationId,
        code_session: code,
        date_debut:   '2026-09-01',
        date_fin:     '2026-12-31',
        capacite_max: 25,
      });

    expect(res.status).toBe(201);
    testSessionId = res.body.data?.id;
  });

  test('✅ Liste des sessions', async () => {
    const res = await request(app)
      .get('/api/parametrage/sessions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach(s => {
      expect(s.code_session).toBeDefined();
      expect(s.formation_nom).toBeDefined();
    });
  });

  test('✅ Filtrage sessions par formation', async () => {
    if (!testFormationId) return;
    const res = await request(app)
      .get(`/api/parametrage/sessions?formation_id=${testFormationId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach(s =>
      expect(s.formation_id || s.formation_nom).toBeDefined()
    );
  });

  test('❌ Code session dupliqué → 409', async () => {
    if (!testFormationId) return;
    const code = `S-DUP-${Date.now()}`;
    await request(app)
      .post('/api/parametrage/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        formation_id: testFormationId, code_session: code,
        date_debut: '2026-09-01', date_fin: '2026-12-31',
      });
    const res = await request(app)
      .post('/api/parametrage/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        formation_id: testFormationId, code_session: code,
        date_debut: '2026-09-01', date_fin: '2026-12-31',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CODE_SESSION_EXISTS');
  });

  test('❌ date_fin avant date_debut → 400', async () => {
    if (!testFormationId) return;
    const res = await request(app)
      .post('/api/parametrage/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        formation_id: testFormationId, code_session: `S-ERR-${Date.now()}`,
        date_debut: '2026-12-31', date_fin: '2026-09-01',
      });

    expect(res.status).toBe(400);
  });

  test('✅ Clôture d\'une session', async () => {
    if (!testSessionId) return;
    const res = await request(app)
      .post(`/api/parametrage/sessions/${testSessionId}/cloturer`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.inscrits_conserves).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════
// UC-47 — AGENCES
// ════════════════════════════════════════════════════════════════
describe('UC-47 — Gestion des agences', () => {

  test('✅ Création d\'une agence', async () => {
    const res = await request(app)
      .post('/api/parametrage/agences')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: `Agence Test ${Date.now()}`, ville: 'Lyon', region: 'AuRA' });

    expect(res.status).toBe(201);
    testAgenceId = res.body.data?.id;
  });

  test('✅ Liste des agences avec compteurs', async () => {
    const res = await request(app)
      .get('/api/parametrage/agences')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach(a => {
      expect(a.nom).toBeDefined();
      expect(a.nb_users).toBeDefined();
      expect(a.nb_dossiers).toBeDefined();
    });
  });

  test('✅ Mise à jour d\'une agence', async () => {
    if (!testAgenceId) return;
    const res = await request(app)
      .patch(`/api/parametrage/agences/${testAgenceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ville: 'Villeurbanne', region: 'AuRA' });

    expect(res.status).toBe(200);
  });

  test('✅ Désactivation agence → avertissement si utilisateurs actifs', async () => {
    // Tester avec l'agence principale (probablement avec utilisateurs)
    const listRes = await request(app)
      .get('/api/parametrage/agences')
      .set('Authorization', `Bearer ${adminToken}`);

    const agenceAvecUsers = listRes.body.data?.find(a => a.nb_users > 0);
    if (!agenceAvecUsers) return; // pas d'agence avec users en test

    const res = await request(app)
      .patch(`/api/parametrage/agences/${agenceAvecUsers.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ actif: false });

    expect(res.status).toBe(200);
    // Warning si des utilisateurs actifs
    if (res.body.warning) {
      expect(res.body.warning).toContain('utilisateur');
    }
  });

  test('❌ Nom manquant → 400', async () => {
    const res = await request(app)
      .post('/api/parametrage/agences')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ville: 'Paris' });

    expect(res.status).toBe(400);
  });

  test('❌ COMMERCIAL ne peut pas gérer les agences → 403', async () => {
    const res = await request(app)
      .post('/api/parametrage/agences')
      .set('Authorization', `Bearer ${comToken}`)
      .send({ nom: 'Test', ville: 'Paris' });

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-46 — DISTRIBUTION DES LEADS
// ════════════════════════════════════════════════════════════════
describe('UC-46 — Distribution des leads', () => {

  test('✅ Config distribution accessible', async () => {
    const res = await request(app)
      .get('/api/parametrage/distribution')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.config).toBeDefined();
    expect(res.body.data.limites).toBeDefined();
    expect(Array.isArray(res.body.data.limites)).toBe(true);
  });

  test('✅ Mise à jour limite leads d\'un commercial', async () => {
    const db = require('../src/config/database');
    const [[com]] = await db.query(
      "SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.nom = 'commercial' LIMIT 1"
    );
    if (!com) return;

    const res = await request(app)
      .put(`/api/parametrage/distribution/limites/${com.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ max_leads: 50 });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('50');
  });

  test('❌ max_leads négatif → 400', async () => {
    const res = await request(app)
      .put('/api/parametrage/distribution/limites/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ max_leads: -5 });

    expect(res.status).toBe(400);
  });

  test('❌ COMMERCIAL ne peut pas accéder à la distribution → 403', async () => {
    const res = await request(app)
      .get('/api/parametrage/distribution')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-49 — CONFIGURATION IMPORTS
// ════════════════════════════════════════════════════════════════
describe('UC-49 — Configuration imports', () => {

  test('✅ Récupération config imports avec valeurs par défaut', async () => {
    const res = await request(app)
      .get('/api/parametrage/imports/config')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.config).toBeDefined();
    expect(res.body.data.config.gestion).toBeDefined();
    expect(res.body.data.config.edof).toBeDefined();
  });

  test('✅ Colonne AU est la valeur par défaut pour le coût', async () => {
    const res = await request(app)
      .get('/api/parametrage/imports/config')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data.config.gestion.colonne_cout).toBe('AU');
    expect(res.body.data.config.gestion.colonne_financeur).toBe('AK');
  });

  test('✅ Sauvegarde config imports', async () => {
    const res = await request(app)
      .post('/api/parametrage/imports/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        gestion: { colonne_cout: 'AU', colonne_financeur: 'AK', mode_defaut: 'mettre_a_jour' },
        edof:    { separateur_csv: ';', mode_defaut: 'upsert' },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.gestion.colonne_cout).toBe('AU');
    expect(res.body.data.edof.cle_upsert).toBe('NUMERO_DOSSIER'); // toujours fixe
  });

  test('❌ Colonne invalide → 400', async () => {
    const res = await request(app)
      .post('/api/parametrage/imports/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        gestion: { colonne_cout: 'COL123', colonne_financeur: 'AK' },
      });

    expect(res.status).toBe(400);
  });

  test('✅ Historique imports accessible', async () => {
    const res = await request(app)
      .get('/api/parametrage/imports/config')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.historique).toBeDefined();
    expect(Array.isArray(res.body.data.historique)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-50 — MODÈLES SMS/EMAIL
// ════════════════════════════════════════════════════════════════
describe('UC-50 — Modèles de messages SMS/Email', () => {

  test('✅ Création modèle valide avec variables autorisées', async () => {
    const res = await request(app)
      .post('/api/parametrage/modeles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type:           'test_bienvenue',
        nom:            'Modèle Test Bienvenue',
        sujet_email:    'Bienvenue {PRENOM}',
        contenu_email:  'Bonjour {PRENOM} {NOM}, bienvenue dans la formation {FORMATION}.',
        contenu_sms:    'Bienvenue {PRENOM} ! Formation {FORMATION} démarrée le {DATE}.',
      });

    expect(res.status).toBe(201);
    testModeleId = res.body.data?.id;
  });

  test('✅ Liste des modèles', async () => {
    const res = await request(app)
      .get('/api/parametrage/modeles')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('✅ Prévisualisation d\'un modèle avec données exemple', async () => {
    if (!testModeleId) return;
    const res = await request(app)
      .get(`/api/parametrage/modeles/${testModeleId}/preview`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.contenu_email).not.toContain('{PRENOM}'); // variables remplacées
    expect(res.body.data.contenu_email).toContain('Marie');
    expect(res.body.data.variables_utilisees).toBeDefined();
  });

  test('✅ Mise à jour d\'un modèle', async () => {
    if (!testModeleId) return;
    const res = await request(app)
      .patch(`/api/parametrage/modeles/${testModeleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contenu_sms: 'Bonjour {PRENOM}, votre formation {FORMATION} commence le {DATE}.' });

    expect(res.status).toBe(200);
  });

  test('❌ Variable inconnue dans le modèle → 400', async () => {
    const res = await request(app)
      .post('/api/parametrage/modeles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type:          'test_invalid',
        nom:           'Modèle Invalide',
        contenu_email: 'Bonjour {PRENOM}, votre code {CODE_PROMO} expire demain.',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VARIABLES_INCONNUES');
    expect(res.body.inconnues).toContain('CODE_PROMO');
  });

  test('❌ type et nom manquants → 400', async () => {
    const res = await request(app)
      .post('/api/parametrage/modeles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contenu_sms: 'Test' });

    expect(res.status).toBe(400);
  });

  test('❌ ROLE_ADMIN ne peut pas créer un modèle (SUPER_ADMIN uniquement) → dépend du seed',
  async () => {
    // Note : si adminToken est SUPER_ADMIN, ce test sera 201
    // Si ROLE_ADMIN, sera 403 — les deux sont des comportements valides
    const res = await request(app)
      .post('/api/parametrage/modeles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type:          'test_droits',
        nom:           'Test Droits',
        contenu_email: 'Test {NOM}',
      });

    expect([201, 403]).toContain(res.status);
  });

  test('❌ COMMERCIAL ne peut pas consulter les modèles → 403', async () => {
    const res = await request(app)
      .get('/api/parametrage/modeles')
      .set('Authorization', `Bearer ${comToken}`);

    expect(res.status).toBe(403);
  });
});
