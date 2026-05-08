'use strict';

const db = require('../config/database');

const EvaluationQualiopiModel = {

  async findByDossierAndSession(dossierId, sessionId) {
    const [rows] = await db.query(
      `SELECT eq.*, sf.code_session, f.nom AS formation_nom,
              CONCAT(u.prenom,' ',u.nom) AS cree_par_nom
       FROM evaluations_qualiopi eq
       JOIN sessions_formation sf ON sf.id = eq.session_id
       JOIN formations f          ON f.id  = sf.formation_id
       LEFT JOIN users u          ON u.id  = eq.created_by
       WHERE eq.dossier_id = ? AND eq.session_id = ?
       ORDER BY eq.type_eval ASC`,
      [dossierId, sessionId]
    );
    return rows;
  },

  async findOne(dossierId, sessionId, typeEval) {
    const [[row]] = await db.query(
      `SELECT eq.*, sf.code_session, f.nom AS formation_nom
       FROM evaluations_qualiopi eq
       JOIN sessions_formation sf ON sf.id = eq.session_id
       JOIN formations f          ON f.id  = sf.formation_id
       WHERE eq.dossier_id = ? AND eq.session_id = ? AND eq.type_eval = ?`,
      [dossierId, sessionId, typeEval]
    );
    return row || null;
  },

  async upsert({ dossier_id, session_id, type_eval, reponses, score_total, commentaire, created_by }) {
    const reponsesJson = JSON.stringify(reponses || []);
    const now = new Date();
    const [result] = await db.query(
      `INSERT INTO evaluations_qualiopi
         (dossier_id, session_id, type_eval, reponses, score_total, commentaire, created_by, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         reponses     = VALUES(reponses),
         score_total  = VALUES(score_total),
         commentaire  = VALUES(commentaire),
         completed_at = VALUES(completed_at),
         updated_at   = NOW()`,
      [dossier_id, session_id, type_eval, reponsesJson,
       score_total ?? null, commentaire || null, created_by || null, now, now]
    );
    return result;
  },

  async statsSession(sessionId) {
    const [rows] = await db.query(
      `SELECT
         type_eval,
         COUNT(*)                        AS nb_completes,
         ROUND(AVG(score_total), 1)      AS score_moyen
       FROM evaluations_qualiopi
       WHERE session_id = ? AND completed_at IS NOT NULL
       GROUP BY type_eval`,
      [sessionId]
    );
    return rows;
  },
};

module.exports = EvaluationQualiopiModel;
