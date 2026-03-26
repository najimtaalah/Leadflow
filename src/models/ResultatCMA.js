'use strict';

const db = require('../config/database');

const ResultatCMAModel = {

  /**
   * Trouve un résultat CMA par dossier + session + épreuve
   */
  async findOne(dossierId, sessionCode, typeEpreuve) {
    const [[row]] = await db.query(
      `SELECT * FROM resultats_cma
       WHERE dossier_id = ? AND session_code = ? AND type_epreuve = ?`,
      [dossierId, sessionCode, typeEpreuve]
    );
    return row || null;
  },

  /**
   * Tous les résultats d'un dossier
   */
  async findByDossier(dossierId) {
    const [rows] = await db.query(
      `SELECT r.*, d.nom, d.prenom
       FROM resultats_cma r
       JOIN dossiers d ON d.id = r.dossier_id
       WHERE r.dossier_id = ?
       ORDER BY r.synced_at DESC`,
      [dossierId]
    );
    return rows;
  },

  /**
   * Résultats d'une session complète (pour le rapport de sync — UC-20)
   */
  async findBySession(sessionCode) {
    const [rows] = await db.query(
      `SELECT
         r.*, d.nom, d.prenom, d.email, d.telephone,
         d.formation_souhaitee, d.agence_id
       FROM resultats_cma r
       JOIN dossiers d ON d.id = r.dossier_id
       WHERE r.session_code = ?
       ORDER BY r.type_epreuve, d.nom`,
      [sessionCode]
    );
    return rows;
  },

  /**
   * Upsert un résultat CMA (insert ou update si déjà existant)
   * Clé unique : dossier_id + session_code + type_epreuve
   */
  async upsert({
    dossier_id, session_code, type_epreuve,
    note, resultat, action_auto, sync_source = 'auto',
  }) {
    await db.query(
      `INSERT INTO resultats_cma
         (dossier_id, session_code, type_epreuve, note, resultat,
          action_auto, sync_source, synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         note        = VALUES(note),
         resultat    = VALUES(resultat),
         action_auto = VALUES(action_auto),
         sync_source = VALUES(sync_source),
         synced_at   = NOW(),
         updated_at  = NOW()`,
      [dossier_id, session_code, type_epreuve,
       note || null, resultat, action_auto || null, sync_source]
    );
  },

  /**
   * Statistiques de la dernière synchronisation
   */
  async getLastSyncStats() {
    const [[row]] = await db.query(
      `SELECT
         COUNT(*)                            AS total,
         SUM(resultat = 'admis')             AS admis,
         SUM(resultat = 'echec')             AS echecs,
         SUM(resultat = 'en_attente')        AS en_attente,
         SUM(action_auto IS NOT NULL)        AS actions_declenchees,
         MAX(synced_at)                      AS derniere_sync
       FROM resultats_cma`
    );
    return row;
  },

  /**
   * Config de synchronisation automatique
   */
  async getSyncConfig() {
    const [[row]] = await db.query(
      'SELECT * FROM config_sync_cma ORDER BY id DESC LIMIT 1'
    );
    return row || null;
  },

  /**
   * Met à jour la config et les stats de sync
   */
  async updateSyncStats({ nb_trouves, nb_en_attente, nb_messages_envoyes }) {
    await db.query(
      `UPDATE config_sync_cma
       SET derniere_sync = NOW(),
           nb_trouves = ?,
           nb_en_attente = ?,
           nb_messages_envoyes = ?
       WHERE id = 1`,
      [nb_trouves || 0, nb_en_attente || 0, nb_messages_envoyes || 0]
    );
  },
};

module.exports = ResultatCMAModel;
