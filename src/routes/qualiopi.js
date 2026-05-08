'use strict';

const express    = require('express');
const router     = express.Router();
const C          = require('../controllers/qualiopiController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES }  = require('../constants');

router.use(authenticate);

const ADMIN  = [ROLES.SUPER_ADMIN, ROLES.ROLE_ADMIN];
const STAFF  = [ROLES.SUPER_ADMIN, ROLES.ROLE_ADMIN, ROLES.ROLE_ADMINISTRATIF];
const READ   = [ROLES.SUPER_ADMIN, ROLES.ROLE_ADMIN, ROLES.ROLE_ADMINISTRATIF, ROLES.MANAGER];

// ── Indicateur 3 — Émargement ─────────────────────────────────────────────────
router.get('/sessions/:sessionId/emargements',        authorize(...READ),  C.getEmargements);
router.post('/sessions/:sessionId/emargements',       authorize(...STAFF), C.upsertEmargement);
router.post('/sessions/:sessionId/emargements/bulk',  authorize(...STAFF), C.upsertEmargementBulk);
router.get('/sessions/:sessionId/emargements/pdf',    authorize(...STAFF), C.getFeuilleEmargementPDF);

// ── Indicateur 5 — Évaluations ────────────────────────────────────────────────
router.get('/dossiers/:dossierId/evaluations',        authorize(...READ),  C.getEvaluations);
router.post('/dossiers/:dossierId/evaluations',       authorize(...STAFF), C.upsertEvaluation);
router.get('/sessions/:sessionId/evaluations/stats',  authorize(...READ),  C.getEvaluationsStats);

// ── Indicateur 6 — Satisfaction ───────────────────────────────────────────────
router.get('/dossiers/:dossierId/satisfaction',              authorize(...READ),  C.getSatisfaction);
router.post('/dossiers/:dossierId/satisfaction',             authorize(...STAFF), C.upsertSatisfaction);
router.get('/sessions/:sessionId/satisfaction/stats',        authorize(...READ),  C.getSatisfactionStats);
router.get('/formations/:formationId/satisfaction/stats',    authorize(...READ),  C.getSatisfactionStatsByFormation);

// ── Documents réglementaires ──────────────────────────────────────────────────
router.get('/dossiers/:dossierId/documents',                        authorize(...READ),  C.getDocuments);
router.post('/dossiers/:dossierId/documents/attestation',           authorize(...STAFF), C.generateAttestation);
router.post('/dossiers/:dossierId/documents/convention',            authorize(...STAFF), C.generateConvention);
router.post('/dossiers/:dossierId/documents/convocation',           authorize(...STAFF), C.generateConvocation);

// ── Tableau de bord ───────────────────────────────────────────────────────────
router.get('/dashboard', authorize(...READ), C.getDashboard);

module.exports = router;
