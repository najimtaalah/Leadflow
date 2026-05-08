'use strict';

const express          = require('express');
const router           = express.Router();
const UsersController  = require('../controllers/usersController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES }        = require('../constants');

// Toutes les routes users nécessitent d'être authentifié
router.use(authenticate);

/**
 * GET /api/users/me
 * Profil de l'utilisateur connecté
 */
router.get('/me', UsersController.getMe);

/**
 * PATCH /api/users/me
 * Mise à jour du profil de l'utilisateur connecté (nom, prénom, email, password)
 */
router.patch('/me', UsersController.updateMe);

/**
 * GET /api/users
 * UC-02 — Liste des utilisateurs
 * SUPER_ADMIN : tous · ROLE_ADMIN : lecture seule
 */
router.get(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.ROLE_ADMIN),
  UsersController.list
);

/**
 * GET /api/users/:id
 * UC-02 — Détail d'un utilisateur
 */
router.get(
  '/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.ROLE_ADMIN),
  UsersController.getOne
);

/**
 * POST /api/users
 * UC-02 — Création d'un utilisateur
 * SUPER_ADMIN uniquement
 */
router.post(
  '/',
  authorize(ROLES.SUPER_ADMIN),
  UsersController.create
);

/**
 * PATCH /api/users/:id
 * UC-02 — Mise à jour d'un utilisateur (rôle, statut, agence…)
 * SUPER_ADMIN uniquement
 */
router.patch(
  '/:id',
  authorize(ROLES.SUPER_ADMIN),
  UsersController.update
);

/**
 * DELETE /api/users/:id
 * UC-02 — Suppression définitive (NULL FK → delete)
 * SUPER_ADMIN uniquement
 */
router.delete(
  '/:id',
  authorize(ROLES.SUPER_ADMIN),
  UsersController.remove
);

/**
 * POST /api/users/:id/reset-password
 * UC-02 — Réinitialisation du mot de passe
 * SUPER_ADMIN uniquement
 */
router.post(
  '/:id/reset-password',
  authorize(ROLES.SUPER_ADMIN),
  UsersController.resetPassword
);

/**
 * GET /api/users/:id/logs
 * Consultation des logs d'un utilisateur
 * SUPER_ADMIN uniquement
 */
router.get(
  '/:id/logs',
  authorize(ROLES.SUPER_ADMIN),
  UsersController.getLogs
);

module.exports = router;
