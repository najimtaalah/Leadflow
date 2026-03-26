'use strict';

const express              = require('express');
const router               = express.Router();
const ReportingController  = require('../controllers/reportingController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

const ROLES_REPORTING = ['super_admin', 'role_admin', 'manager', 'role_administratif'];
const ROLES_FINANCE   = ['super_admin', 'role_admin', 'manager', 'role_administratif'];
const ROLES_COMM      = ['super_admin', 'role_admin', 'manager'];

/**
 * GET /api/reporting/dashboard
 * Vue agrégée pour l'écran Reporting — KPIs des 3 modules
 */
router.get(
  '/dashboard',
  authorize(...ROLES_REPORTING),
  ReportingController.getDashboardReporting
);

/**
 * GET /api/reporting/kpis-gestion
 * KPIs "Gestion Dossiers" pour le Dashboard
 */
router.get(
  '/kpis-gestion',
  authorize(...ROLES_REPORTING),
  ReportingController.getKpisGestion
);

/**
 * GET /api/reporting/performance
 * UC-41 — Performance Commerciale
 * ?mois=2026-03 &agence_id=1
 */
router.get(
  '/performance',
  authorize(...ROLES_REPORTING),
  ReportingController.getPerformance
);

/**
 * GET /api/reporting/point-financier
 * UC-42 — Point Financier (situation + historique mensuel)
 * ?mois=2026-03 &agence_id=1
 */
router.get(
  '/point-financier',
  authorize(...ROLES_FINANCE),
  ReportingController.getPointFinancier
);

/**
 * GET /api/reporting/commissions
 * UC-43 — Tableau commissions avec simulation optionnelle
 * ?agence_id=1 &taux_simule=7 &suppl_simule=2
 */
router.get(
  '/commissions',
  authorize(...ROLES_COMM),
  ReportingController.getCommissions
);

/**
 * GET /api/reporting/export/:type
 * UC-44 — Export d'un rapport (performance | financier | commissions)
 * ?format=json|pdf|excel &mois=2026-03 &agence_id=1
 */
router.get(
  '/export/:type',
  authorize(...ROLES_REPORTING),
  ReportingController.exportRapport
);

module.exports = router;
