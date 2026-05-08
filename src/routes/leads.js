'use strict';

const express         = require('express');
const router          = express.Router();
const LeadsController = require('../controllers/leadsController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES }       = require('../constants');

// Toutes les routes leads nécessitent authentification
router.use(authenticate);

/**
 * GET /api/leads
 * UC-07 — Liste des leads (filtrée selon le rôle)
 * Tous les rôles y ont accès (filtre automatique appliqué dans le controller)
 */
router.get('/', LeadsController.list);

/**
 * GET /api/leads/:id
 * UC-07 — Détail d'un lead + historique pipeline
 */
router.get('/:id', LeadsController.getOne);

/**
 * POST /api/leads
 * UC-05 — Création manuelle d'un lead
 * AGENT_ACCUEIL, ROLE_ADMIN, SUPER_ADMIN, MANAGER
 */
router.post(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.ROLE_ADMIN, ROLES.MANAGER, ROLES.AGENT_ACCUEIL),
  LeadsController.create
);

/**
 * POST /api/leads/webhook
 * UC-06 — Réception automatique Meta Ads / Formulaire
 * Pas d'authentification JWT (clé API à ajouter en production via middleware séparé)
 */
router.post('/webhook', LeadsController.webhook);

/**
 * PATCH /api/leads/:id
 * UC-10 — Mise à jour infos d'un lead
 * COMMERCIAL (ses leads) + rôles supérieurs
 */
router.patch('/:id', LeadsController.update);

/**
 * PATCH /api/leads/:id/statut
 * UC-08 — Mise à jour du statut (déclenche actions auto)
 * COMMERCIAL (ses leads) + rôles supérieurs
 */
router.patch('/:id/statut', LeadsController.updateStatut);

/**
 * POST /api/leads/:id/interactions
 * UC-10 — Enregistrement appel / SMS / email
 */
router.post('/:id/interactions', LeadsController.logInteraction);

/**
 * POST /api/leads/:id/reassign
 * UC-12 — Réassignation manuelle
 * ROLE_ADMIN, SUPER_ADMIN, MANAGER
 */
router.post(
  '/:id/reassign',
  authorize(ROLES.SUPER_ADMIN, ROLES.ROLE_ADMIN, ROLES.MANAGER),
  LeadsController.reassign
);

/**
 * GET /api/leads/:id/interactions
 * Historique des interactions (appels, SMS, emails) d'un lead
 * Tous les rôles (filtre accès dans le controller)
 */
router.get('/:id/interactions', LeadsController.getInteractions);

/**
 * GET /api/leads/:id/historique
 * UC-08 / UC-12 — Historique pipeline d'un lead
 */
router.get('/:id/historique', LeadsController.getHistorique);

/**
 * DELETE /api/leads/:id
 * Suppression d'un lead — ROLE_ADMIN, SUPER_ADMIN uniquement
 */
router.delete(
  '/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.ROLE_ADMIN),
  LeadsController.remove
);

module.exports = router;
