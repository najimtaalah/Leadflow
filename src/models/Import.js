'use strict';

const db = require('../config/database');

const ImportModel = {

  /** Crée un job d'import */
  async createJob({ type, mode, fichier_nom, user_id }) {
    const [result] = await db.query(
      `INSERT INTO imports_jobs
         (type, mode, fichier_nom, statut, user_id, created_at)
       VALUES (?, ?, ?, 'en_cours', ?, NOW())`,
      [type, mode, fichier_nom, user_id]
    );
    return result.insertId;
  },

  /** Met à jour un job d'import avec les résultats */
  async updateJob(jobId, { nb_lus, nb_crees, nb_maj, nb_rejetes, statut, erreur }) {
    await db.query(
      `UPDATE imports_jobs
       SET nb_lus = ?, nb_crees = ?, nb_maj = ?, nb_rejetes = ?,
           statut = ?, erreur = ?, updated_at = NOW()
       WHERE id = ?`,
      [nb_lus || 0, nb_crees || 0, nb_maj || 0, nb_rejetes || 0,
       statut || 'termine', erreur || null, jobId]
    );
  },

  /** Enregistre une ligne rejetée */
  async addRejet({ job_id, ligne, raison, donnees }) {
    await db.query(
      `INSERT INTO imports_rejets (job_id, ligne, raison, donnees, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [job_id, ligne, raison, donnees ? JSON.stringify(donnees) : null]
    );
  },

  /** Historique des imports */
  async findAll({ limit = 20, offset = 0 } = {}) {
    const [rows] = await db.query(
      `SELECT ij.*, CONCAT(u.prenom,' ',u.nom) AS declenche_par
       FROM imports_jobs ij
       LEFT JOIN users u ON u.id = ij.user_id
       ORDER BY ij.created_at DESC LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );
    return rows;
  },

  /** Détail d'un job avec ses rejets */
  async findById(jobId) {
    const [[job]] = await db.query('SELECT * FROM imports_jobs WHERE id = ?', [jobId]);
    if (!job) return null;
    const [rejets] = await db.query(
      'SELECT * FROM imports_rejets WHERE job_id = ? ORDER BY ligne ASC',
      [jobId]
    );
    return { ...job, rejets };
  },
};

module.exports = ImportModel;
