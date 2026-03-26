'use strict';

const express        = require('express');
const router         = express.Router();
const AuthController = require('../controllers/authController');
const { authenticate }    = require('../middleware/auth');
const { loginLimiter }    = require('../middleware/rateLimiter');

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
