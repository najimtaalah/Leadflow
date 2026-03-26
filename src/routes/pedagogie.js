'use strict';

const express              = require('express');
const router               = express.Router();
const PedagogieController  = require('../controllers/pedagogieController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// ── Rôles ─────────────────────────────────────────────────────────────────
const ROLES_PEDA   = ['super_admin','role_admin','role_administratif'];
const ROLES_READ   = ['super_admin','role_admin','role_administratif','manager','commercial'];
const ROLES_AGENT  = ['super_admin','role_admin']; // sync CMA et config

/**
 * POST /api/pedagogie/dossiers/:dossierId/inscrire
 * UC-19 — Inscription à une session (théorie / pratique)
 */
router.post(
  '/dossiers/:dossierId/inscrire',
  authorize(...ROLES_PEDA),
  PedagogieController.inscrire
);

/**
 * GET /api/pedagogie/dossiers/:dossierId/inscriptions
 * UC-19 — Liste des inscriptions d'un dossier
 */
router.get(
  '/dossiers/:dossierId/inscriptions',
  authorize(...ROLES_READ),
  PedagogieController.getInscriptions
);

/**
 * PATCH /api/pedagogie/inscriptions/:id/statut
 * Mise à jour du statut d'une inscription (en_cours, termine, abandonne)
 */
router.patch(
  '/inscriptions/:id/statut',
  authorize(...ROLES_PEDA),
  PedagogieController.updateStatutInscription
);

/**
 * GET /api/pedagogie/dossiers/:dossierId/resultats-cma
 * Résultats CMA d'un apprenant
 */
router.get(
  '/dossiers/:dossierId/resultats-cma',
  authorize(...ROLES_READ),
  PedagogieController.getResultatsCMA
);

/**
 * GET /api/pedagogie/sessions/:sessionCode/resultats
 * Résultats CMA d'une session complète
 */
router.get(
  '/sessions/:sessionCode/resultats',
  authorize(...ROLES_READ),
  PedagogieController.getResultatsSession
);

/**
 * GET /api/pedagogie/presentes
 * Liste des apprenants présentés à l'examen
 * ?session_code=S1-2026&type_partie=theorie
 */
router.get(
  '/presentes',
  authorize(...ROLES_READ),
  PedagogieController.getPresentes
);

// ════════════════════════════════════════════════════════════════
// AGENT IA CMA
// ════════════════════════════════════════════════════════════════

/**
 * POST /api/pedagogie/agent-cma/sync
 * UC-20 — Synchronisation manuelle des résultats CMA
 * Body optionnel : { session_code, agence_id }
 */
router.post(
  '/agent-cma/sync',
  authorize(...ROLES_AGENT),
  PedagogieController.syncManuelle
);

/**
 * GET /api/pedagogie/agent-cma/config
 * UC-24 — Config et stats de la synchronisation automatique
 */
router.get(
  '/agent-cma/config',
  authorize(...ROLES_AGENT),
  PedagogieController.getSyncConfig
);

/**
 * PATCH /api/pedagogie/agent-cma/config
 * UC-24 — Mise à jour config sync automatique (actif, fréquence)
 * SUPER_ADMIN uniquement
 */
router.patch(
  '/agent-cma/config',
  authorize('super_admin'),
  PedagogieController.updateSyncConfig
);

module.exports = router;
