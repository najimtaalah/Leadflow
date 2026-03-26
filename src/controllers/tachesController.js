'use strict';

const TacheModel = require('../models/Tache');
const logger     = require('../utils/logger');

function buildFilter(user) {
  switch (user.role_nom) {
    case 'commercial': return { vendeur_id: user.id };
    case 'manager':    return { agence_id: user.agence_id };
    default:           return {};
  }
}

const TachesController = {

  async list(req, res) {
    try {
      const roleFilter = buildFilter(req.user);
      const { dossier_id, statut, limit, offset } = req.query;
      const result = await TacheModel.findAll({
        ...roleFilter,
        dossier_id: dossier_id ? parseInt(dossier_id) : undefined,
        statut:     statut     || undefined,
        limit:      parseInt(limit,  10) || 100,
        offset:     parseInt(offset, 10) || 0,
      });
      return res.json({ success: true, data: result.taches, total: result.total });
    } catch (err) {
      logger.error('Erreur list taches', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async update(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { statut, assigned_to, notes } = req.body;
      await TacheModel.update(id, { statut, assigned_to, notes });
      return res.json({ success: true, message: 'Tâche mise à jour.' });
    } catch (err) {
      logger.error('Erreur update tache', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },
};

module.exports = TachesController;
