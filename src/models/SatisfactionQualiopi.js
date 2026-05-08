'use strict';

const db = require('../config/database');

const SatisfactionQualiopiModel = {

  async findByDossierAndSession(dossierId, sessionId) {
    const [[row]] = await db.query(
      `SELECT sq.*, sf.code_session, f.nom AS formation_nom
       FROM satisfactions_qualiopi sq
       JOIN sessions_formation sf ON sf.id = sq.session_id
       JOIN formations f          ON f.id  = sf.formation_id
       WHERE sq.dossier_id = ? AND sq.session_id = ?`,
      [dossierId, sessionId]
    );
    return row || null;
  },

  async upsert({ dossier_id, session_id, note_contenu, note_formateur, note_organisation, note_locaux, note_globale, commentaire_libre, recommande }) {
    const now = new Date();
    const [result] = await db.query(
      `INSERT INTO satisfactions_qualiopi
         (dossier_id, session_id, note_contenu, note_formateur, note_organisation,
          note_locaux, note_globale, commentaire_libre, recommande, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         note_contenu      = VALUES(note_contenu),
         note_formateur    = VALUES(note_formateur),
         note_organisation = VALUES(note_organisation),
         note_locaux       = VALUES(note_locaux),
         note_globale      = VALUES(note_globale),
         commentaire_libre = VALUES(commentaire_libre),
         recommande        = VALUES(recommande),
         completed_at      = VALUES(completed_at),
         updated_at        = NOW()`,
      [dossier_id, session_id,
       note_contenu ?? null, note_formateur ?? null, note_organisation ?? null,
       note_locaux ?? null, note_globale ?? null,
       commentaire_libre || null,
       recommande != null ? (recommande ? 1 : 0) : null,
       now, now]
    );
    return result;
  },

  async statsSession(sessionId) {
    const [[row]] = await db.query(
      `SELECT
         COUNT(*)                             AS nb_repondants,
         ROUND(AVG(note_contenu),2)           AS avg_contenu,
         ROUND(AVG(note_formateur),2)         AS avg_formateur,
         ROUND(AVG(note_organisation),2)      AS avg_organisation,
         ROUND(AVG(note_locaux),2)            AS avg_locaux,
         ROUND(AVG(note_globale),2)           AS avg_globale,
         ROUND(
           (AVG(note_contenu)+AVG(note_formateur)+AVG(note_organisation)+
            AVG(note_locaux)+AVG(note_globale)) / 5 * 20, 1
         )                                    AS taux_satisfaction_pct,
         SUM(recommande)                      AS nb_recommande
       FROM satisfactions_qualiopi
       WHERE session_id = ? AND completed_at IS NOT NULL`,
      [sessionId]
    );
    return row;
  },

  async statsByFormation(formationId) {
    const [rows] = await db.query(
      `SELECT
         sf.code_session,
         sf.date_debut,
         sf.date_fin,
         COUNT(sq.id)                         AS nb_repondants,
         ROUND(AVG(sq.note_globale),2)         AS avg_globale,
         ROUND(
           (AVG(sq.note_contenu)+AVG(sq.note_formateur)+AVG(sq.note_organisation)+
            AVG(sq.note_locaux)+AVG(sq.note_globale)) / 5 * 20, 1
         )                                    AS taux_satisfaction_pct
       FROM satisfactions_qualiopi sq
       JOIN sessions_formation sf ON sf.id = sq.session_id
       WHERE sf.formation_id = ? AND sq.completed_at IS NOT NULL
       GROUP BY sf.id, sf.code_session, sf.date_debut, sf.date_fin
       ORDER BY sf.date_debut DESC`,
      [formationId]
    );
    return rows;
  },
};

module.exports = SatisfactionQualiopiModel;
