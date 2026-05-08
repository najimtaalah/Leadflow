'use strict';

const db = require('../config/database');

const EmargementModel = {

  async findBySession(sessionId) {
    const [rows] = await db.query(
      `SELECT
         e.id, e.dossier_id, e.session_id, e.date_seance,
         e.heure_debut, e.heure_fin, e.present, e.motif_absence,
         e.signature_hash, e.signe_par_user, e.created_at, e.updated_at,
         d.nom AS apprenant_nom, d.prenom AS apprenant_prenom,
         CONCAT(u.prenom,' ',u.nom) AS signe_par_nom
       FROM emargements e
       JOIN dossiers d ON d.id = e.dossier_id
       LEFT JOIN users u ON u.id = e.signe_par_user
       WHERE e.session_id = ?
       ORDER BY e.date_seance ASC, d.nom ASC, d.prenom ASC`,
      [sessionId]
    );
    return rows;
  },

  async findByDossierAndSession(dossierId, sessionId) {
    const [rows] = await db.query(
      `SELECT e.*, sf.code_session, f.nom AS formation_nom
       FROM emargements e
       JOIN sessions_formation sf ON sf.id = e.session_id
       JOIN formations f          ON f.id  = sf.formation_id
       WHERE e.dossier_id = ? AND e.session_id = ?
       ORDER BY e.date_seance ASC`,
      [dossierId, sessionId]
    );
    return rows;
  },

  async upsert({ dossier_id, session_id, date_seance, heure_debut, heure_fin, present, motif_absence, signe_par_user }) {
    const [result] = await db.query(
      `INSERT INTO emargements
         (dossier_id, session_id, date_seance, heure_debut, heure_fin, present, motif_absence, signe_par_user, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         present       = VALUES(present),
         heure_debut   = VALUES(heure_debut),
         heure_fin     = VALUES(heure_fin),
         motif_absence = VALUES(motif_absence),
         signe_par_user = VALUES(signe_par_user),
         updated_at    = NOW()`,
      [dossier_id, session_id, date_seance, heure_debut || '09:00:00', heure_fin || '17:00:00',
       present ? 1 : 0, motif_absence || null, signe_par_user || null]
    );
    return result;
  },

  async signBulk(sessionId, dateSeance, signeParUser, signatureHash) {
    const [result] = await db.query(
      `UPDATE emargements
       SET signature_hash = ?, signe_par_user = ?, updated_at = NOW()
       WHERE session_id = ? AND date_seance = ? AND present = 1`,
      [signatureHash, signeParUser, sessionId, dateSeance]
    );
    return result.affectedRows;
  },

  async statsSession(sessionId) {
    const [[row]] = await db.query(
      `SELECT
         COUNT(*)          AS total,
         SUM(present)      AS presents,
         COUNT(DISTINCT date_seance) AS nb_seances
       FROM emargements
       WHERE session_id = ?`,
      [sessionId]
    );
    return row;
  },
};

module.exports = EmargementModel;
