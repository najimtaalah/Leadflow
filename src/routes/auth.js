'use strict';

const express        = require('express');
const router         = express.Router();
const AuthController = require('../controllers/authController');
const { authenticate }    = require('../middleware/auth');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');

/**
 * POST /api/auth/register
 * UC-05 — Création de compte (auto-inscription)
 * Rate limited : 5 créations / heure par IP
 */
router.post('/register', registerLimiter, AuthController.register);

/**
 * POST /api/auth/login
 * UC-01 — Connexion, génération JWT
 * Rate limited : 10 tentatives / 15 min
 */
router.post('/login', loginLimiter, AuthController.login);

/**
 * POST /api/auth/logout
 * UC-03 — Déconnexion, révocation token
 * Requiert authentification
 */
router.post('/logout', authenticate, AuthController.logout);

/**
 * GET /api/auth/me
 * Retourne les infos de l'utilisateur connecté
 * Requiert authentification
 */
router.get('/me', authenticate, AuthController.me);

module.exports = router;
