'use strict';

const express         = require('express');
const router          = express.Router();
const ApprenantModel  = require('../models/Apprenant');
const JournalDossier  = require('../models/JournalDossier');
const { authenticate, authorize } = require('../middleware/auth');
const logger          = require('../utils/logger');

// Tous les endpoints nécessitent une authentification
router.use(authenticate);

// ── GET /api/apprenants — liste paginée ─────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, limit, offset } = req.query;
    const result = await ApprenantModel.findAll({
      search,
      limit:  parseInt(limit,  10) || 50,
      offset: parseInt(offset, 10) || 0,
    });
    return res.json({ success: true, data: result.apprenants, total: result.total });
  } catch (err) {
    logger.error('Erreur liste apprenants', { error: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ── GET /api/apprenants/:id — détail ────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const apprenant = await ApprenantModel.findById(parseInt(req.params.id));
    if (!apprenant) return res.status(404).json({ success: false, message: 'Apprenant introuvable.' });
    return res.json({ success: true, data: apprenant });
  } catch (err) {
    logger.error('Erreur getOne apprenant', { error: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ── POST /api/apprenants — création manuelle ────────────────────────────────
router.post('/',
  authorize('super_admin', 'role_admin', 'role_administratif'),
  async (req, res) => {
    const { id_lead_origine, nom, prenom, date_naissance, telephone, email, adresse } = req.body;
    if (!nom?.trim()) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Nom requis.' });
    }
    try {
      const id = await ApprenantModel.create({ id_lead_origine, nom: nom.trim(), prenom, date_naissance, telephone, email, adresse });
      return res.status(201).json({ success: true, data: { id } });
    } catch (err) {
      logger.error('Erreur création apprenant', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  }
);

// ── POST /api/apprenants/from-lead/:leadId — conversion lead → apprenant ───
router.post('/from-lead/:leadId',
  authorize('super_admin', 'role_admin', 'role_administratif'),
  async (req, res) => {
    try {
      const leadId = parseInt(req.params.leadId);
      const existing = await ApprenantModel.findByLead(leadId);
      if (existing) {
        return res.status(409).json({
          success: false,
          code: 'ALREADY_EXISTS',
          message: 'Un apprenant existe déjà pour ce lead.',
          data: { id: existing.id },
        });
      }
      const id = await ApprenantModel.createFromLead(leadId);
      return res.status(201).json({ success: true, data: { id } });
    } catch (err) {
      if (err.message === 'Lead introuvable') {
        return res.status(404).json({ success: false, message: 'Lead introuvable.' });
      }
      logger.error('Erreur conversion lead → apprenant', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  }
);

// ── PATCH /api/apprenants/:id — mise à jour ─────────────────────────────────
router.patch('/:id',
  authorize('super_admin', 'role_admin', 'role_administratif'),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ok = await ApprenantModel.update(id, req.body);
      if (!ok) return res.status(400).json({ success: false, message: 'Aucun champ valide fourni.' });
      return res.json({ success: true, message: 'Apprenant mis à jour.' });
    } catch (err) {
      logger.error('Erreur update apprenant', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  }
);

// ── GET /api/apprenants/:id/dossiers-journal — journal d'audit ──────────────
// (lecture via dossier_id, exposé ici pour commodité)
router.get('/dossiers/:dossierId/journal',
  async (req, res) => {
    try {
      const rows = await JournalDossier.findByDossier(parseInt(req.params.dossierId));
      return res.json({ success: true, data: rows });
    } catch (err) {
      logger.error('Erreur journal dossier', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  }
);

module.exports = router;
