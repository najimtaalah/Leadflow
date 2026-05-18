'use strict';

const express = require('express');
const router  = express.Router();
const FC      = require('../controllers/financementController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

const ROLES_READ  = ['super_admin', 'role_admin', 'gestionnaire', 'commercial'];
const ROLES_WRITE = ['super_admin', 'role_admin', 'gestionnaire'];
const ROLES_ADMIN = ['super_admin', 'role_admin'];

// ── Module Facturation — liste & exports ─────────────────────────────────────
router.get('/',                        authorize(...ROLES_WRITE), FC.listFacturation);
router.get('/export/dossiers-facturables', authorize(...ROLES_ADMIN), FC.exportDossiersFacturables);
router.get('/export/rapport-mensuel',      authorize(...ROLES_ADMIN), FC.exportRapportMensuel);

module.exports = router;
