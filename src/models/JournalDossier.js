'use strict';

const db     = require('../config/database');
const logger = require('../utils/logger');

const JournalDossierModel = {

  /**
   * Enregistre une entrée d'audit pour un dossier.
   * Appelé automatiquement par DossierModel.update() et les autres mutations.
   */
  async create({ dossier_id, action, champ = null, valeur_avant = null, valeur_apres = null, user_id = null }) {
    try {
      await db.query(
        `INSERT INTO journal_dossier
           (dossier_id, action, champ, valeur_avant, valeur_apres, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [dossier_id, action, champ, valeur_avant, valeur_apres, user_id || null]
      );
    } catch (err) {
      logger.error('[JournalDossier] Erreur écriture audit :', err.message);
    }
  },

  /**
   * Enregistre plusieurs changements de champs en une seule opération.
   * before / after : objets { champ: valeur }
   */
  async createChanges(dossier_id, before, after, user_id = null) {
    const entries = [];
    for (const key of Object.keys(after)) {
      const valBefore = before[key] !== undefined ? String(before[key] ?? '') : null;
      const valAfter  = after[key]  !== undefined ? String(after[key]  ?? '') : null;
      if (valBefore !== valAfter) {
        entries.push({ dossier_id, action: 'updated', champ: key, valeur_avant: valBefore, valeur_apres: valAfter, user_id });
      }
    }
    for (const entry of entries) {
      await this.create(entry);
    }
  },

  /** Récupère le journal d'un dossier, du plus récent au plus ancien */
  async findByDossier(dossierId, { limit = 100, offset = 0 } = {}) {
    const [rows] = await db.query(
      `SELECT j.id, j.action, j.champ, j.valeur_avant, j.valeur_apres, j.created_at,
              CONCAT(u.prenom,' ',u.nom) AS auteur
       FROM journal_dossier j
       LEFT JOIN users u ON u.id = j.user_id
       WHERE j.dossier_id = ?
       ORDER BY j.created_at DESC
       LIMIT ? OFFSET ?`,
      [dossierId, parseInt(limit), parseInt(offset)]
    );
    return rows;
  },
};

module.exports = JournalDossierModel;
