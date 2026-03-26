'use strict';

const db = require('../config/database');

const InscriptionModel = {

  /**
   * Liste des inscriptions d'un dossier
   */
  async findByDossier(dossierId) {
    const [rows] = await db.query(
      `SELECT
         i.id, i.dossier_id, i.session_id, i.type_partie,
         i.statut, i.date_inscription, i.created_at,
         s.code_session, s.date_debut, s.date_fin,
         f.nom AS formation_nom,
         f.config_pedagogique
       FROM inscriptions i
       JOIN sessions_formation s ON s.id = i.session_id
       JOIN formations f         ON f.id = s.formation_id
       WHERE i.dossier_id = ?
       ORDER BY i.created_at ASC`,
      [dossierId]
    );
    return rows;
  },

  /**
   * Trouve une inscription par ID
   */
  async findById(id) {
    const [[row]] = await db.query(
      `SELECT i.*, s.code_session, s.formation_id,
              f.nom AS formation_nom, f.config_pedagogique,
              d.nom AS apprenant_nom, d.prenom AS apprenant_prenom,
              d.email AS apprenant_email, d.telephone AS apprenant_tel
       FROM inscriptions i
       JOIN sessions_formation s ON s.id = i.session_id
       JOIN formations f         ON f.id = s.formation_id
       JOIN dossiers d           ON d.id = i.dossier_id
       WHERE i.id = ?`,
      [id]
    );
    return row || null;
  },

  /**
   * Vérifie si une inscription existe déjà pour ce dossier/session/partie
   */
  async exists(dossierId, sessionId, typePartie) {
    const [[row]] = await db.query(
      `SELECT id FROM inscriptions
       WHERE dossier_id = ? AND session_id = ? AND type_partie = ?`,
      [dossierId, sessionId, typePartie]
    );
    return row || null;
  },

  /**
   * Crée une inscription (UC-19)
   */
  async create({ dossier_id, session_id, type_partie, statut = 'inscrit', user_id }) {
    const [result] = await db.query(
      `INSERT INTO inscriptions
         (dossier_id, session_id, type_partie, statut, date_inscription, created_by, created_at)
       VALUES (?, ?, ?, ?, NOW(), ?, NOW())`,
      [dossier_id, session_id, type_partie, statut, user_id || null]
    );
    return result.insertId;
  },

  /**
   * Met à jour le statut d'une inscription
   */
  async updateStatut(id, statut) {
    await db.query(
      'UPDATE inscriptions SET statut = ?, updated_at = NOW() WHERE id = ?',
      [statut, id]
    );
  },

  /**
   * Liste tous les dossiers assignés à un examen (UC-20)
   * Utilise le FK examen_id sur dossiers (remplace l'ancienne table inscriptions)
   */
  async findPresentes({ sessionCode, agenceId } = {}) {
    let sql = `
      SELECT
        d.id AS dossier_id,
        d.nom, d.prenom, d.email, d.telephone,
        d.agence_id, d.formation_souhaitee,
        se.code_session,
        f.nom AS formation_nom
      FROM dossiers d
      JOIN sessions_formation se ON se.id = d.examen_id
      JOIN formations f          ON f.id = se.formation_id
      WHERE d.examen_id IS NOT NULL`;
    const params = [];

    if (sessionCode) { sql += ' AND se.code_session = ?'; params.push(sessionCode); }
    if (agenceId)    { sql += ' AND d.agence_id = ?';     params.push(agenceId); }

    sql += ' ORDER BY d.nom, d.prenom';
    const [rows] = await db.query(sql, params);
    return rows;
  },

  /**
   * Vérifie la config pédagogique d'une formation
   * Retourne : 'theorie_seule' | 'pratique_seule' | 'theorie_et_pratique'
   */
  async getConfigPedagogique(sessionId) {
    const [[row]] = await db.query(
      `SELECT f.config_pedagogique
       FROM sessions_formation s
       JOIN formations f ON f.id = s.formation_id
       WHERE s.id = ?`,
      [sessionId]
    );
    return row?.config_pedagogique || 'theorie_et_pratique';
  },

  /**
   * Trouve la session pratique pour une même formation
   * (pour inscription auto après admis théorie — UC-21)
   */
  async findSessionPratique(sessionId) {
    const [[session]] = await db.query(
      `SELECT s2.id, s2.code_session, s2.capacite_max,
              COUNT(i.id) AS inscrits
       FROM sessions_formation s1
       JOIN sessions_formation s2 ON s2.formation_id = s1.formation_id
         AND s2.id != s1.id
       LEFT JOIN inscriptions i ON i.session_id = s2.id
       WHERE s1.id = ?
         AND s2.date_debut >= CURDATE()
       GROUP BY s2.id
       HAVING inscrits < s2.capacite_max
       ORDER BY s2.date_debut ASC
       LIMIT 1`,
      [sessionId]
    );
    return session || null;
  },
};

module.exports = InscriptionModel;
