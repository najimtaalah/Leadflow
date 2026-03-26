'use strict';

const db     = require('../config/database');
const logger = require('../utils/logger');

const LogModel = {

  /**
   * Enregistre une action dans logs_systeme
   * Utilisé pour : login, logout, login_failed, access_denied, user_created, user_updated
   */
  async create({ action, user_id = null, details = null, ip_address = null }) {
    try {
      await db.query(
        `INSERT INTO logs_systeme (action, user_id, details, ip_address, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [
          action,
          user_id,
          details ? JSON.stringify(details) : null,
          ip_address,
        ]
      );
    } catch (err) {
      // Ne jamais bloquer l'application à cause d'un log
      logger.error('[LogModel] Erreur écriture log :', err.message);
    }
  },

  /**
   * Récupère les logs d'un utilisateur
   */
  async findByUser(userId, limit = 50) {
    const [rows] = await db.query(
      `SELECT id, action, details, ip_address, created_at
       FROM logs_systeme
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );
    return rows;
  },

  /**
   * Récupère tous les logs (SUPER_ADMIN)
   */
  async findAll({ action, limit = 100, offset = 0 } = {}) {
    let sql = `
      SELECT l.id, l.action, l.details, l.ip_address, l.created_at,
             u.prenom, u.nom, u.email
      FROM logs_systeme l
      LEFT JOIN users u ON u.id = l.user_id
      WHERE 1=1`;
    const params = [];
    if (action) { sql += ' AND l.action = ?'; params.push(action); }
    sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const [rows] = await db.query(sql, params);
    return rows;
  },
};

module.exports = LogModel;
