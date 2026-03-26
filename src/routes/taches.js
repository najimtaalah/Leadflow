'use strict';

const express           = require('express');
const router            = express.Router();
const TachesController  = require('../controllers/tachesController');
const { authenticate }  = require('../middleware/auth');

router.use(authenticate);

/**
 * GET /api/taches
 * Liste des tâches (filtrée par rôle)
 * ?dossier_id=1 &statut=en_attente
 */
router.get('/', TachesController.list);

/**
 * PATCH /api/taches/:id
 * Mettre à jour le statut / assigned_to / notes
 */
router.patch('/:id', TachesController.update);

module.exports = router;
