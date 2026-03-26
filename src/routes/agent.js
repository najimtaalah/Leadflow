'use strict';

const express = require('express');
const router  = express.Router();
const Ctrl    = require('../controllers/agentController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

const ADMINS  = ['super_admin', 'role_admin'];
const ALLOWED = ['super_admin', 'role_admin', 'role_administratif'];

/** GET  /api/agent/status          — état général (mode CMA, Ollama, stats) */
router.get('/status',              authorize(...ALLOWED), Ctrl.getStatus);

/** GET  /api/agent/resultats       — liste des résultats CMA */
router.get('/resultats',           authorize(...ALLOWED), Ctrl.getResultats);

/** GET  /api/agent/sessions        — sessions CMA disponibles */
router.get('/sessions',            authorize(...ALLOWED), Ctrl.getSessions);

/** GET  /api/agent/ollama/status   — état Ollama */
router.get('/ollama/status',       authorize(...ALLOWED), Ctrl.getOllamaStatus);

/** POST /api/agent/sync            — sync manuelle (admins seulement) */
router.post('/sync',               authorize(...ADMINS),  Ctrl.lancerSync);

/** PATCH /api/agent/config         — config sync auto */
router.patch('/config',            authorize(...ADMINS),  Ctrl.updateConfig);

/** POST /api/agent/generer-email   — génération email Ollama */
router.post('/generer-email',      authorize(...ALLOWED), Ctrl.genererEmail);

/** POST /api/agent/score-lead      — scoring lead Ollama */
router.post('/score-lead',         authorize(...ALLOWED), Ctrl.scorerLead);

module.exports = router;
