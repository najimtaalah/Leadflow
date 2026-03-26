'use strict';

const express          = require('express');
const router           = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ImportsController = require('../controllers/importsController');

router.use(authenticate);

const ADMINS = ['super_admin', 'role_admin', 'role_administratif'];

// POST /api/imports/preview — aperçu colonnes + premières lignes
router.post(
  '/preview',
  authorize(...ADMINS),
  ImportsController.upload.single('file'),
  ImportsController.previewFile
);

// POST /api/imports/gestion — import Excel Gestion
router.post(
  '/gestion',
  authorize(...ADMINS),
  ImportsController.upload.single('file'),
  ImportsController.importGestion
);

// POST /api/imports/edof — import CSV EDOF
router.post(
  '/edof',
  authorize(...ADMINS),
  ImportsController.upload.single('file'),
  ImportsController.importEdof
);

// GET /api/imports/historique — historique des imports
router.get(
  '/historique',
  authorize(...ADMINS),
  ImportsController.getHistorique
);

module.exports = router;
