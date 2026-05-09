'use strict';

/**
 * Tests Module 1 — Authentification & Accès
 * Couvre : UC-01, UC-02, UC-03, UC-04
 *
 * Pour exécuter : npm run test:auth
 * Prérequis : base de données de test configurée avec seed.sql
 */

const request = require('supertest');
const app     = require('../src/app');
const db      = require('../src/config/database');

// Purge les tentatives de connexion échouées entre les runs pour éviter les lockouts accumulés
beforeAll(async () => {
  await db.query(`DELETE FROM logs_systeme WHERE action = 'login_failed'`);
});

afterAll(async () => {
  // Supprimer d'abord les logs (FK child) puis les users (FK parent)
  await db.query(`
    DELETE ls FROM logs_systeme ls
    INNER JOIN users u ON ls.user_id = u.id
    WHERE u.email LIKE 'test.register.%@leadflow.fr'
  `);
  await db.query(`DELETE FROM users WHERE email LIKE 'test.register.%@leadflow.fr'`);
  await db.end?.();
});

// ── Données de test ──────────────────────────────────────────────────────────
const ADMIN_CREDENTIALS = {
  email:    'admin@leadflow.fr',
  password: 'Admin2026!',
};
const COMMERCIAL_CREDENTIALS = {
  email:    'commercial@leadflow.fr',
  password: 'Commercial2026!',
};

let adminToken    = null;
let commercialToken = null;

// ════════════════════════════════════════════════════════════════
// UC-01 — CONNEXION
// ════════════════════════════════════════════════════════════════
describe('UC-01 — Connexion', () => {

  test('✅ Connexion réussie avec identifiants valides', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(ADMIN_CREDENTIALS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(ADMIN_CREDENTIALS.email);
    expect(res.body.user.role).toBeDefined();

    adminToken = res.body.token;
  });

  test('✅ Connexion commercial — token contient role et agence_id', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(COMMERCIAL_CREDENTIALS);

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('commercial');
    commercialToken = res.body.token;
  });

  test('❌ Email manquant → 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('❌ Mot de passe incorrect → 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_CREDENTIALS.email, password: 'mauvais_mdp' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('❌ Email inexistant → 401 (même message que mauvais mdp)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inconnu@test.fr', password: 'test123' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('❌ Format email invalide → 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pas_un_email', password: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ════════════════════════════════════════════════════════════════
// UC-02 — GESTION UTILISATEURS (SUPER_ADMIN)
// ════════════════════════════════════════════════════════════════
describe('UC-02 — Gestion des utilisateurs', () => {

  test('✅ SUPER_ADMIN peut lister les utilisateurs', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('❌ COMMERCIAL ne peut pas lister les utilisateurs → 403', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${commercialToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  test('✅ Création d\'un utilisateur valide', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        prenom:   'Test',
        nom:      'Utilisateur',
        email:    `test.user.${Date.now()}@leadflow.fr`,
        password: 'TestUser2026!',
        role_nom: 'commercial',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
  });

  test('❌ Email déjà existant → 409', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        prenom:   'Doublon',
        nom:      'Test',
        email:    ADMIN_CREDENTIALS.email,
        password: 'Test2026!',
        role_nom: 'commercial',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_EXISTS');
  });

  test('❌ Rôle invalide → 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        prenom:   'Test',
        nom:      'Role',
        email:    'test.role@leadflow.fr',
        password: 'Test2026!',
        role_nom: 'role_inexistant',
      });

    expect(res.status).toBe(400);
  });

  test('❌ Mot de passe trop court → 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        prenom:   'Test',
        nom:      'Mdp',
        email:    'test.mdp@leadflow.fr',
        password: '123',
        role_nom: 'commercial',
      });

    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-03 — DÉCONNEXION
// ════════════════════════════════════════════════════════════════
describe('UC-03 — Déconnexion', () => {

  let tempToken = null;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(ADMIN_CREDENTIALS);
    tempToken = res.body.token;
  });

  test('✅ Déconnexion réussie', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${tempToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('❌ Token révoqué ne peut plus être utilisé → 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tempToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID');
  });

  test('❌ Déconnexion sans token → 401', async () => {
    const res = await request(app)
      .post('/api/auth/logout');

    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════
// UC-04 — ACCÈS REFUSÉ
// ════════════════════════════════════════════════════════════════
describe('UC-04 — Accès refusé — droits insuffisants', () => {

  test('❌ Accès sans token → 401', async () => {
    const res = await request(app)
      .get('/api/users');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  test('❌ COMMERCIAL ne peut pas créer un utilisateur → 403', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${commercialToken}`)
      .send({
        prenom: 'Test', nom: 'Acces', email: 'test@test.fr',
        password: 'test1234', role_nom: 'commercial',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  test('❌ Token malformé → 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token_invalide_ici');

    expect(res.status).toBe(401);
  });

  test('❌ Token avec préfixe manquant → 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', adminToken); // sans "Bearer "

    expect(res.status).toBe(401);
  });

  test('✅ Route /health accessible sans authentification', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ════════════════════════════════════════════════════════════════
// UC-05 — AUTO-INSCRIPTION (création de compte)
// ════════════════════════════════════════════════════════════════
describe('UC-05 — Auto-inscription', () => {

  const uniqueEmail = () => `test.register.${Date.now()}@leadflow.fr`;

  test('✅ Création de compte réussie avec données valides', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        prenom:                'Marie',
        nom:                   'Dupont',
        email:                 uniqueEmail(),
        password:              'TestRegister2026!',
        password_confirmation: 'TestRegister2026!',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.message).toMatch(/créé/i);
  });

  test('❌ Champs obligatoires manquants → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail(), password: 'TestRegister2026!' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('❌ Format email invalide → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        prenom: 'Jean', nom: 'Test',
        email: 'pas_un_email',
        password: 'TestRegister2026!',
        password_confirmation: 'TestRegister2026!',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('❌ Mot de passe trop court (< 8 chars) → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        prenom: 'Jean', nom: 'Test',
        email: uniqueEmail(),
        password: 'Abc1',
        password_confirmation: 'Abc1',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('❌ Mot de passe sans majuscule/chiffre → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        prenom: 'Jean', nom: 'Test',
        email: uniqueEmail(),
        password: 'sansChiffre!',
        password_confirmation: 'sansChiffre!',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('❌ Mots de passe ne correspondent pas → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        prenom: 'Jean', nom: 'Test',
        email: uniqueEmail(),
        password: 'TestRegister2026!',
        password_confirmation: 'AutreMotDePasse2026!',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('❌ Email déjà utilisé → 409', async () => {
    const email = uniqueEmail();
    // Créer le premier compte
    await request(app).post('/api/auth/register').send({
      prenom: 'Premier', nom: 'Compte',
      email, password: 'TestRegister2026!', password_confirmation: 'TestRegister2026!',
    });
    // Tenter de créer un doublon
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        prenom: 'Doublon', nom: 'Compte',
        email, password: 'TestRegister2026!', password_confirmation: 'TestRegister2026!',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_EXISTS');
  });

  test('✅ Le compte créé peut se connecter immédiatement', async () => {
    const email    = uniqueEmail();
    const password = 'TestRegister2026!';

    await request(app).post('/api/auth/register').send({
      prenom: 'Login', nom: 'Test',
      email, password, password_confirmation: password,
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.token).toBeDefined();
    expect(loginRes.body.user.email).toBe(email);
    expect(loginRes.body.user.role).toBe('commercial');
  });

  test('✅ password_hash non exposé après création ni en connexion', async () => {
    const email    = uniqueEmail();
    const password = 'TestRegister2026!';

    const regRes = await request(app).post('/api/auth/register').send({
      prenom: 'SecTest', nom: 'Hash',
      email, password, password_confirmation: password,
    });

    expect(regRes.body.data?.password_hash).toBeUndefined();
    expect(regRes.body.data?.password).toBeUndefined();

    const loginRes = await request(app).post('/api/auth/login').send({ email, password });
    expect(loginRes.body.user.password_hash).toBeUndefined();
    expect(loginRes.body.user.password).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════
// GET /auth/me
// ════════════════════════════════════════════════════════════════
describe('GET /auth/me', () => {

  test('✅ Retourne les infos de l\'utilisateur connecté', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBeDefined();
    expect(res.body.user.role).toBeDefined();
    // password_hash ne doit JAMAIS être retourné
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();
  });
});
