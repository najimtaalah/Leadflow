'use strict';

const express            = require('express');
const router             = express.Router();
const FinanceController  = require('../controllers/financeController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

const ROLES_FINANCE  = ['super_admin', 'role_admin', 'role_administratif'];
const ROLES_READ     = ['super_admin', 'role_admin', 'role_administratif', 'manager'];

/**
 * GET /api/finance/dossiers-suivi
 * Vue par dossier : financement personnel, encaissé, reste, statut paiement
 */
router.get(
  '/dossiers-suivi',
  authorize(...ROLES_READ),
  FinanceController.getDossiersSuivi
);

/**
 * GET /api/finance/suivi
 * UC-28 — Suivi des paiements avec KPIs
 * ?dossier_id=X &date_debut=YYYY-MM-DD &date_fin=YYYY-MM-DD
 */
router.get(
  '/suivi',
  authorize(...ROLES_READ),
  FinanceController.getSuiviPaiements
);

/**
 * GET /api/finance/point-financier
 * UC-28 — Point Financier global (situation + historique mensuel)
 * ?mois=2026-03 &agence_id=1
 */
router.get(
  '/point-financier',
  authorize(...ROLES_READ),
  FinanceController.getPointFinancier
);

/**
 * GET /api/finance/retards
 * UC-27 — Dossiers en retard de paiement
 * ?heures=24 (défaut) &agence_id=1
 */
router.get(
  '/retards',
  authorize(...ROLES_READ),
  FinanceController.getRetards
);

/**
 * GET /api/finance/export
 * UC-30 — Export situation financière
 * ?mois=2026-03
 */
router.get(
  '/export',
  authorize(...ROLES_FINANCE),
  FinanceController.exportSituation
);

/**
 * GET /api/finance/export-encaissements-csv
 * Export CSV des encaissements (ouvert à role_administratif)
 * ?date_debut=2026-01-01&date_fin=2026-12-31&dossier_id=42
 */
router.get(
  '/export-encaissements-csv',
  authorize(...ROLES_FINANCE),
  FinanceController.exportEncaissementsCSV
);

/**
 * GET /api/finance/dossiers/:dossierId/resume
 * Résumé financier complet d'un dossier
 */
router.get(
  '/dossiers/:dossierId/resume',
  authorize(...ROLES_READ),
  FinanceController.getResumeDossier
);

/**
 * POST /api/finance/dossiers/:dossierId/encaissements
 * UC-25 — Saisie d'un encaissement
 */
router.post(
  '/dossiers/:dossierId/encaissements',
  authorize(...ROLES_FINANCE),
  FinanceController.addEncaissement
);

/**
 * GET /api/finance/dossiers/:dossierId/plan
 * UC-26 — Récupération du plan financier
 */
router.get(
  '/dossiers/:dossierId/plan',
  authorize(...ROLES_READ),
  FinanceController.getPlan
);

/**
 * POST /api/finance/dossiers/:dossierId/plan
 * UC-26 — Création d'un plan d'échelonnement
 * Body : { mode: 'mensualites', nb_mensualites: 6, date_debut: '2026-04-01' }
 * Body : { mode: 'dates_libres', echeances: [{ montant, date_echeance }] }
 */
router.post(
  '/dossiers/:dossierId/plan',
  authorize(...ROLES_FINANCE),
  FinanceController.createPlan
);

/**
 * POST /api/finance/dossiers/:dossierId/relancer
 * UC-29 — Envoi relance paiement (email + SMS)
 */
router.post(
  '/dossiers/:dossierId/relancer',
  authorize(...ROLES_FINANCE),
  FinanceController.relancer
);

module.exports = router;
