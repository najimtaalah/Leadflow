'use strict';

const express = require('express');
const router  = express.Router();
const Ctrl    = require('../controllers/prelevementsController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

const ADMINS   = ['super_admin', 'role_admin'];
const FINANCE  = ['super_admin', 'role_admin', 'role_administratif'];

/** GET  /api/prelevements/status          — mode actif + stats */
router.get('/status',            authorize(...FINANCE), Ctrl.getStatus);

/** GET  /api/prelevements/echeances-dues  — liste des prélèvements à traiter */
router.get('/echeances-dues',    authorize(...FINANCE), Ctrl.getEcheancesDues);

/** POST /api/prelevements/lancer/:id      — traiter UN prélèvement */
router.post('/lancer/:echeanceId', authorize(...ADMINS), Ctrl.lancerPrelevement);

/** POST /api/prelevements/lancer-tous     — traiter TOUS les prélèvements dus */
router.post('/lancer-tous',       authorize(...ADMINS), Ctrl.lancerTous);

/** GET  /api/prelevements/log             — historique */
router.get('/log',                authorize(...FINANCE), Ctrl.getLog);

/** PATCH /api/prelevements/dossiers/:id/sepa — configurer IBAN d'un dossier */
router.patch('/dossiers/:dossierId/sepa', authorize(...ADMINS), Ctrl.configurerSepa);

module.exports = router;
