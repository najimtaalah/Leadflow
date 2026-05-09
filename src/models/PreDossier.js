'use strict';

const db = require('../config/database');

const PreDossierModel = {

  /** Crée un pré-dossier lié à un lead */
  async create({ id_lead }) {
    const [result] = await db.query(
      `INSERT INTO pre_dossiers
         (id_lead, statut_bloc_admin, statut_bloc_financier, created_at, updated_at)
       VALUES (?, 'en_attente', 'en_attente', NOW(), NOW())`,
      [id_lead]
    );
    return result.insertId;
  },

  /** Retrouve un pré-dossier par son id */
  async findById(id) {
    const [[row]] = await db.query(
      `SELECT pd.*,
              l.nom AS lead_nom, l.prenom AS lead_prenom,
              l.telephone, l.email, l.statut AS lead_statut,
              a.nom AS apprenant_nom, a.prenom AS apprenant_prenom
       FROM pre_dossiers pd
       JOIN leads l ON l.id = pd.id_lead
       LEFT JOIN apprenants a ON a.id = pd.apprenant_id
       WHERE pd.id = ?`,
      [id]
    );
    return row || null;
  },

  /** Retrouve le pré-dossier actif d'un lead */
  async findByLead(leadId) {
    const [[row]] = await db.query(
      'SELECT * FROM pre_dossiers WHERE id_lead = ? ORDER BY created_at DESC LIMIT 1',
      [leadId]
    );
    return row || null;
  },

  /**
   * Met à jour le statut d'un bloc (admin ou financier).
   * bloc : 'admin' | 'financier'
   * statut : 'en_attente' | 'valide' | 'rejete'
   */
  async updateBloc(id, bloc, statut) {
    const col = bloc === 'admin' ? 'statut_bloc_admin' : 'statut_bloc_financier';
    await db.query(
      `UPDATE pre_dossiers SET ${col} = ?, updated_at = NOW() WHERE id = ?`,
      [statut, id]
    );
  },

  /**
   * Active le pré-dossier : rattache un apprenant.
   * Déclenché quand les deux blocs sont validés.
   */
  async activer(id, apprenantId) {
    await db.query(
      'UPDATE pre_dossiers SET apprenant_id = ?, updated_at = NOW() WHERE id = ?',
      [apprenantId, id]
    );
  },

  /** Vérifie si les deux blocs sont validés */
  async estPretPourConversion(id) {
    const [[row]] = await db.query(
      `SELECT statut_bloc_admin, statut_bloc_financier, apprenant_id
       FROM pre_dossiers WHERE id = ?`,
      [id]
    );
    if (!row) return { ok: false, reason: 'PRE_DOSSIER_NOT_FOUND' };
    if (row.statut_bloc_admin !== 'valide')     return { ok: false, reason: 'BLOC_ADMIN_NON_VALIDE' };
    if (row.statut_bloc_financier !== 'valide') return { ok: false, reason: 'BLOC_FINANCIER_NON_VALIDE' };
    return { ok: true, apprenant_id: row.apprenant_id };
  },
};

module.exports = PreDossierModel;
