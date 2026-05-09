'use strict';

const express         = require('express');
const router          = express.Router();
const PreDossierModel = require('../models/PreDossier');
const ApprenantModel  = require('../models/Apprenant');
const LeadModel       = require('../models/Lead');
const DossierModel    = require('../models/Dossier');
const JournalDossier  = require('../models/JournalDossier');
const { authenticate, authorize } = require('../middleware/auth');
const logger          = require('../utils/logger');
const db              = require('../config/database');

router.use(authenticate);

// ── POST /api/predossiers — crée un pré-dossier depuis un lead ──────────────
router.post('/',
  authorize('super_admin', 'role_admin', 'role_administratif', 'commercial'),
  async (req, res) => {
    const { id_lead } = req.body;
    if (!id_lead) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'id_lead requis.' });
    }
    try {
      const id = await PreDossierModel.create({ id_lead: parseInt(id_lead) });
      // Marquer le badge sur le lead
      await LeadModel.update(parseInt(id_lead), { badge_pre_dossier: 1 });
      return res.status(201).json({ success: true, data: { id } });
    } catch (err) {
      logger.error('Erreur création pré-dossier', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  }
);

// ── GET /api/predossiers/:id — détail ───────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const pd = await PreDossierModel.findById(parseInt(req.params.id));
    if (!pd) return res.status(404).json({ success: false, message: 'Pré-dossier introuvable.' });
    return res.json({ success: true, data: pd });
  } catch (err) {
    logger.error('Erreur getOne pré-dossier', { error: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ── GET /api/predossiers/lead/:leadId — pré-dossier d'un lead ───────────────
router.get('/lead/:leadId', async (req, res) => {
  try {
    const pd = await PreDossierModel.findByLead(parseInt(req.params.leadId));
    if (!pd) return res.status(404).json({ success: false, message: 'Aucun pré-dossier pour ce lead.' });
    return res.json({ success: true, data: pd });
  } catch (err) {
    logger.error('Erreur findByLead pré-dossier', { error: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ── PATCH /api/predossiers/:id/blocs — valide / rejette un bloc ─────────────
router.patch('/:id/blocs',
  authorize('super_admin', 'role_admin', 'role_administratif'),
  async (req, res) => {
    const { bloc, statut } = req.body;
    if (!['admin', 'financier'].includes(bloc)) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'bloc doit être "admin" ou "financier".' });
    }
    if (!['en_attente', 'valide', 'rejete'].includes(statut)) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'statut invalide.' });
    }
    try {
      await PreDossierModel.updateBloc(parseInt(req.params.id), bloc, statut);
      return res.json({ success: true, message: 'Bloc mis à jour.' });
    } catch (err) {
      logger.error('Erreur updateBloc pré-dossier', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  }
);

// ── POST /api/predossiers/:id/activer — active le pré-dossier ──────────────
// Crée l'apprenant s'il n'existe pas encore, puis l'attache au pré-dossier.
router.post('/:id/activer',
  authorize('super_admin', 'role_admin', 'role_administratif'),
  async (req, res) => {
    const pdId = parseInt(req.params.id);
    try {
      const { ok, reason, apprenant_id } = await PreDossierModel.estPretPourConversion(pdId);
      if (!ok) {
        return res.status(422).json({ success: false, code: reason, message: `Pré-dossier non convertible : ${reason}` });
      }
      const pd = await PreDossierModel.findById(pdId);

      // Crée ou récupère l'apprenant
      let appId = apprenant_id;
      if (!appId) {
        const existing = await ApprenantModel.findByLead(pd.id_lead);
        appId = existing ? existing.id : await ApprenantModel.createFromLead(pd.id_lead);
        await PreDossierModel.activer(pdId, appId);
      }

      return res.json({ success: true, data: { apprenant_id: appId } });
    } catch (err) {
      logger.error('Erreur activation pré-dossier', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  }
);

module.exports = router;
