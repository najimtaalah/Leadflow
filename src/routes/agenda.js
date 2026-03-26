'use strict';

const express           = require('express');
const router            = express.Router();
const AgendaController  = require('../controllers/agendaController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

const ROLES_ALL    = ['super_admin','role_admin','manager','commercial',
                      'role_administratif','agent_accueil'];
const ROLES_CREATE = ['super_admin','role_admin','manager','commercial',
                      'role_administratif','agent_accueil'];
const ROLES_ADMIN  = ['super_admin','role_admin','manager'];

/**
 * GET /api/agenda
 * UC-32 — Liste des RDV (filtrée selon le rôle)
 * ?type_rdv=commercial &statut=confirme &date_debut=2026-03-01 &date_fin=2026-03-31
 */
router.get('/', authorize(...ROLES_ALL), AgendaController.list);

/**
 * GET /api/agenda/today
 * UC-36 — Widget Dashboard : RDV du jour + KPIs
 */
router.get('/today', authorize(...ROLES_ALL), AgendaController.getToday);

/**
 * GET /api/agenda/:id
 * UC-31 — Détail d'un RDV
 */
router.get('/:id', authorize(...ROLES_ALL), AgendaController.getOne);

/**
 * POST /api/agenda
 * UC-31 — Création d'un RDV
 * Body : {
 *   type_rdv, titre, date_rdv, heure_debut, heure_fin,
 *   responsable_id, lead_id?, dossier_id?,
 *   notif_email?, notif_sms?, notif_rappel_24h?
 * }
 */
router.post('/', authorize(...ROLES_CREATE), AgendaController.create);

/**
 * PATCH /api/agenda/:id
 * Modification d'un RDV (titre, horaires, responsable…)
 */
router.patch('/:id', authorize(...ROLES_CREATE), AgendaController.update);

/**
 * POST /api/agenda/:id/confirmer
 * UC-33 — Confirmation d'un RDV + notification
 */
router.post(
  '/:id/confirmer',
  authorize(...ROLES_ALL),
  AgendaController.confirmer
);

/**
 * POST /api/agenda/:id/effectue
 * UC-34 — Marquer un RDV comme effectué
 */
router.post(
  '/:id/effectue',
  authorize(...ROLES_ALL),
  AgendaController.marquerEffectue
);

/**
 * POST /api/agenda/:id/annuler
 * UC-35 — Annulation d'un RDV + notification
 * Body optionnel : { motif }
 */
router.post(
  '/:id/annuler',
  authorize(...ROLES_ADMIN),
  AgendaController.annuler
);

/**
 * POST /api/agenda/:id/rappel
 * Envoi manuel d'un rappel (email + SMS)
 */
router.post(
  '/:id/rappel',
  authorize(...ROLES_ALL),
  AgendaController.envoyerRappel
);

module.exports = router;
