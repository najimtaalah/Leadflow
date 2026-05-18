'use strict';

const express             = require('express');
const router              = express.Router();
const DossiersController  = require('../controllers/dossiersController');
const FinancementCtrl     = require('../controllers/financementController');
const { authenticate, authorize } = require('../middleware/auth');

// Toutes les routes dossiers nécessitent authentification
router.use(authenticate);

// ── Rôles autorisés à accéder aux dossiers ────────────────────────────────
const ROLES_DOSSIERS = ['super_admin', 'role_admin', 'manager',
                        'role_administratif', 'agent_accueil', 'commercial'];
const ROLES_ADMIN    = ['super_admin', 'role_admin'];
const ROLES_CMA      = ['super_admin', 'role_admin', 'role_administratif'];

/**
 * GET /api/dossiers
 * UC-17 — Liste des dossiers (filtrée selon le rôle)
 * ?archived=1 pour voir les archivés
 * ?frais_cma_paye=0 pour filtrer CMA non réglées
 */
router.get('/', authorize(...ROLES_DOSSIERS), DossiersController.list);

/**
 * GET /api/dossiers/kpis
 * KPIs pour le Dashboard dossiers
 */
router.get('/kpis', authorize(...ROLES_DOSSIERS), async (req, res) => {
  try {
    const DossierModel = require('../models/Dossier');
    const agenceId = ['super_admin', 'role_admin'].includes(req.user.role_nom)
      ? req.query.agence_id || null
      : req.user.agence_id;
    const kpis = await DossierModel.getKpis(agenceId);
    return res.status(200).json({ success: true, data: kpis });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

/**
 * GET /api/dossiers/import/history
 * UC-16 — Historique des imports
 */
router.get(
  '/import/history',
  authorize(...ROLES_CMA),
  DossiersController.getImportHistory
);

/**
 * GET /api/dossiers/:id
 * UC-17 — Détail d'un dossier avec encaissements et statut paiement
 */
router.get('/:id', authorize(...ROLES_DOSSIERS), DossiersController.getOne);

/**
 * POST /api/dossiers
 * UC-13 — Création manuelle d'un dossier
 * (la création auto se fait depuis leadsController._createDossier)
 */
router.post(
  '/',
  authorize('super_admin', 'role_admin', 'role_administratif'),
  DossiersController.create
);

/**
 * PATCH /api/dossiers/:id
 * UC-17 — Mise à jour infos dossier
 */
router.patch(
  '/:id',
  authorize(...ROLES_CMA),
  DossiersController.update
);

/**
 * PATCH /api/dossiers/:id/cma
 * UC-14 — Saisie/mise à jour des frais CMA
 * Admin et Administratif uniquement
 */
router.patch(
  '/:id/cma',
  authorize(...ROLES_CMA),
  DossiersController.updateCMA
);

/**
 * POST /api/dossiers/:id/valider
 * UC-15 — Validation du dossier (bloqué si CMA non payée)
 */
router.post(
  '/:id/valider',
  authorize(...ROLES_CMA),
  DossiersController.validate
);

/**
 * POST /api/dossiers/:id/archiver
 * UC-18 — Archivage (bloqué si solde > 0)
 * ROLE_ADMIN+ uniquement
 */
router.post(
  '/:id/archiver',
  authorize(...ROLES_ADMIN),
  DossiersController.archive
);

/**
 * GET /api/dossiers/:id/encaissements
 * Liste des encaissements d'un dossier
 */
router.get(
  '/:id/encaissements',
  authorize(...ROLES_DOSSIERS),
  DossiersController.getEncaissements
);

/**
 * POST /api/dossiers/:id/encaissements
 * UC-25 — Saisie d'un encaissement (Finance module)
 * Ici exposé aussi côté dossiers pour accès direct
 */
router.post(
  '/:id/encaissements',
  authorize(...ROLES_CMA),
  DossiersController.addEncaissement
);

/**
 * POST /api/dossiers/import/gestion
 * UC-16 — Import fichier Gestion .xlsx
 * Le body doit contenir rows (tableau parsé par le middleware multer + parser)
 */
router.post(
  '/import/gestion',
  authorize(...ROLES_CMA),
  DossiersController.importGestion
);

/**
 * POST /api/dossiers/import/edof
 * UC-16 — Import fichier EDOF .xls / .csv
 */
router.post(
  '/import/edof',
  authorize(...ROLES_CMA),
  DossiersController.importEDOF
);

// ── Lot 7 — Financement par dossier ──────────────────────────────────────────
const ROLES_FIN_READ  = ['super_admin', 'role_admin', 'gestionnaire', 'commercial'];
const ROLES_FIN_WRITE = ['super_admin', 'role_admin', 'gestionnaire'];
const ROLES_FIN_ADMIN = ['super_admin', 'role_admin'];

router.get(  '/:dossierId/financement',         authorize(...ROLES_FIN_READ),  FinancementCtrl.get);
router.post( '/:dossierId/financement',         authorize(...ROLES_FIN_WRITE), FinancementCtrl.create);
router.patch('/:dossierId/financement',         authorize(...ROLES_FIN_WRITE), FinancementCtrl.update);
router.post( '/:dossierId/financement/valider', authorize(...ROLES_FIN_ADMIN), FinancementCtrl.valider);
router.post( '/:dossierId/financement/statut',  authorize(...ROLES_FIN_WRITE), FinancementCtrl.changerStatut);

module.exports = router;
