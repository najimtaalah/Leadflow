'use strict';

const express                 = require('express');
const router                  = express.Router();
const ParametrageController   = require('../controllers/parametrageController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

const SUPER    = ['super_admin'];
const ADMINS   = ['super_admin', 'role_admin'];
const READONLY = ['super_admin', 'role_admin', 'manager', 'role_administratif'];

// ════════════════════════════════════════════════════════════════
// UC-45 — FORMATIONS (config pédagogique)
// ════════════════════════════════════════════════════════════════

/** GET  /api/parametrage/formations */
router.get('/formations', authorize(...READONLY), ParametrageController.listFormations);

/** GET  /api/parametrage/formations/:id */
router.get('/formations/:id', authorize(...READONLY), ParametrageController.getFormation);

/**
 * POST /api/parametrage/formations
 * Body : { nom, config_pedagogique, duree_heures?, cout_defaut?, frais_cma_defaut? }
 */
router.post('/formations', authorize(...ADMINS), ParametrageController.createFormation);

/**
 * PATCH /api/parametrage/formations/:id
 * UC-45 : avertissement si apprenants actifs + config_peda changée
 */
router.patch('/formations/:id', authorize(...ADMINS), ParametrageController.updateFormation);

/** DELETE /api/parametrage/formations/:id */
router.delete('/formations/:id', authorize(...ADMINS), ParametrageController.deleteFormation);

// ════════════════════════════════════════════════════════════════
// UC-48 — SESSIONS DE FORMATION
// ════════════════════════════════════════════════════════════════

/** GET  /api/parametrage/sessions ?formation_id=1 &actif=1 */
router.get('/sessions', authorize(...READONLY), ParametrageController.listSessions);

/**
 * POST /api/parametrage/sessions
 * Body : { formation_id, code_session, date_debut, date_fin, capacite_max?, lieu? }
 */
router.post('/sessions', authorize(...ADMINS), ParametrageController.createSession);

/** PATCH /api/parametrage/sessions/:id */
router.patch('/sessions/:id', authorize(...ADMINS), ParametrageController.updateSession);

/**
 * DELETE /api/parametrage/sessions/:id
 * Suppression définitive (bloquée si des dossiers sont affectés)
 */
router.delete('/sessions/:id', authorize(...ADMINS), ParametrageController.deleteSession);

/**
 * POST /api/parametrage/sessions/:id/cloturer
 * UC-48 — Clôture une session (inscriptions en cours conservées)
 */
router.post('/sessions/:id/cloturer', authorize(...ADMINS), ParametrageController.cloturerSession);

// ════════════════════════════════════════════════════════════════
// UC-47 — AGENCES
// ════════════════════════════════════════════════════════════════

/** GET  /api/parametrage/agences ?actif=1 */
router.get('/agences', authorize(...READONLY), ParametrageController.listAgences);

/** POST /api/parametrage/agences */
router.post('/agences', authorize(...ADMINS), ParametrageController.createAgence);

/**
 * PATCH /api/parametrage/agences/:id
 * UC-47 : avertissement si désactivation avec utilisateurs actifs
 */
router.patch('/agences/:id', authorize(...ADMINS), ParametrageController.updateAgence);

/** DELETE /api/parametrage/agences/:id */
router.delete('/agences/:id', authorize(...ADMINS), ParametrageController.deleteAgence);

// ════════════════════════════════════════════════════════════════
// UC-46 — DISTRIBUTION DES LEADS
// ════════════════════════════════════════════════════════════════

/** GET  /api/parametrage/distribution */
router.get('/distribution', authorize(...ADMINS), ParametrageController.getDistribution);

/** PATCH /api/parametrage/distribution/:id */
router.patch('/distribution/:id', authorize(...SUPER), ParametrageController.updateDistribution);

/**
 * PUT /api/parametrage/distribution/limites/:userId
 * Définir la limite de leads pour un commercial
 */
router.put(
  '/distribution/limites/:userId',
  authorize(...ADMINS),
  ParametrageController.updateAgentLimite
);

// ════════════════════════════════════════════════════════════════
// UC-49 — CONFIGURATION IMPORTS
// ════════════════════════════════════════════════════════════════

/** GET  /api/parametrage/imports/config */
router.get('/imports/config', authorize(...ADMINS), ParametrageController.getConfigImports);

/**
 * POST /api/parametrage/imports/config
 * Body : { gestion: { colonne_cout, colonne_financeur, mode_defaut },
 *          edof:    { separateur_csv, mode_defaut } }
 */
router.post('/imports/config', authorize(...ADMINS), ParametrageController.saveConfigImports);

// ════════════════════════════════════════════════════════════════
// UC-50 — MODÈLES SMS / EMAIL
// ════════════════════════════════════════════════════════════════

/** GET  /api/parametrage/modeles */
router.get('/modeles', authorize(...READONLY), ParametrageController.listModeles);

/**
 * POST /api/parametrage/modeles
 * Body : { type, nom, sujet_email?, contenu_email?, contenu_sms? }
 * UC-50 : variables autorisées {NOM} {PRENOM} {FORMATION} {DATE} {EPREUVE} {NOTE} {AGENCE}
 */
router.post('/modeles', authorize(...SUPER), ParametrageController.createModele);

/** PATCH /api/parametrage/modeles/:id */
router.patch('/modeles/:id', authorize(...SUPER), ParametrageController.updateModele);

/**
 * GET /api/parametrage/modeles/:id/preview
 * Prévisualisation avec données d'exemple
 */
router.get('/modeles/:id/preview', authorize(...ADMINS), ParametrageController.previewModele);

module.exports = router;
