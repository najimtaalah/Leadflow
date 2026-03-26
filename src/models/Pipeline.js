'use strict';

const db = require('../config/database');

const PipelineModel = {

  /**
   * Enregistre une transition de statut dans pipeline_historique
   * Appelé à chaque changement de statut (UC-08)
   */
  async create({ lead_id, statut_avant, statut_apres, user_id, notes }) {
    const [result] = await db.query(
      `INSERT INTO pipeline_historique
         (lead_id, statut_avant, statut_apres, user_id, notes, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [lead_id, statut_avant || null, statut_apres, user_id, notes || null]
    );
    return result.insertId;
  },

  /** Récupère l'historique complet d'un lead */
  async findByLead(leadId) {
    const [rows] = await db.query(
      `SELECT
         ph.id, ph.statut_avant, ph.statut_apres, ph.notes, ph.created_at,
         CONCAT(u.prenom,' ',u.nom) AS fait_par
       FROM pipeline_historique ph
       LEFT JOIN users u ON u.id = ph.user_id
       WHERE ph.lead_id = ?
       ORDER BY ph.created_at ASC`,
      [leadId]
    );
    return rows;
  },
};

module.exports = PipelineModel;
