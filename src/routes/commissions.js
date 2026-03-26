'use strict';

const express                 = require('express');
const router                  = express.Router();
const CommissionsController   = require('../controllers/commissionsController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

const ROLES_READ  = ['super_admin','role_admin','manager','commercial'];
const ROLES_ADMIN = ['super_admin','role_admin','manager'];

/**
 * GET /api/commissions/taux
 * Consultation des taux actuels (config_commissions)
 * Tous les rôles concernés
 */
router.get('/taux', authorize(...ROLES_READ), CommissionsController.getTaux);

/**
 * PATCH /api/commissions/taux
 * UC-39 — Modification des taux de commission
 * SUPER_ADMIN uniquement
 * Body : { role_nom, taux_base?, taux_supplement_equipe? }
 */
router.patch('/taux', authorize('super_admin'), CommissionsController.updateTaux);

/**
 * GET /api/commissions/mes-commissions
 * UC-37 (commercial) / UC-38 (manager auto-détecté)
 * Retourne les commissions de l'utilisateur connecté
 * ?mois=2026-03
 */
router.get(
  '/mes-commissions',
  authorize(...ROLES_READ),
  CommissionsController.getMesCommissions
);

/**
 * GET /api/commissions/equipe
 * UC-38 — Tableau commissions équipe
 * ROLE_ADMIN / MANAGER (limité à son agence)
 * ?agence_id=1 &mois=2026-03
 */
router.get(
  '/equipe',
  authorize(...ROLES_ADMIN),
  CommissionsController.getCommissionsEquipe
);

/**
 * GET /api/commissions/manager/:managerId
 * UC-38 — Détail manager : commission propre + supplément équipe
 * ROLE_ADMIN ou le manager lui-même
 */
router.get(
  '/manager/:managerId',
  authorize(...ROLES_ADMIN),
  CommissionsController.getDetailManager
);

/**
 * GET /api/commissions/export
 * UC-40 — Export historique commissions de l'utilisateur connecté
 * ?mois=12 (nb de mois, défaut 12)
 */
router.get(
  '/export',
  authorize(...ROLES_READ),
  CommissionsController.exportHistorique
);

/**
 * GET /api/commissions/export/:vendeurId
 * UC-40 — Export historique d'un commercial spécifique
 * ROLE_ADMIN / MANAGER uniquement
 */
router.get(
  '/export/:vendeurId',
  authorize(...ROLES_ADMIN),
  CommissionsController.exportHistorique
);

/**
 * GET /api/commissions/simulation
 * UC-43 — Simulation de taux sans enregistrer
 * ROLE_ADMIN uniquement
 * ?taux_commercial=7&taux_supplement_manager=2&agence_id=1
 */
router.get(
  '/simulation',
  authorize('super_admin', 'role_admin'),
  CommissionsController.simulerTaux
);

module.exports = router;
