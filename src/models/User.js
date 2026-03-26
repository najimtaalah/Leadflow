'use strict';

const db = require('../config/database');

const UserModel = {

  /**
   * Trouve un utilisateur par email avec son rôle et son agence
   * Utilisé lors de la connexion (UC-01)
   */
  async findByEmail(email) {
    const [rows] = await db.query(
      `SELECT u.id, u.prenom, u.nom, u.email, u.password_hash,
              u.actif, u.agence_id,
              r.nom  AS role_nom,
              r.id   AS role_id,
              a.nom  AS agence_nom
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN agences a ON a.id = u.agence_id
       WHERE u.email = ?
       LIMIT 1`,
      [email.toLowerCase().trim()]
    );
    return rows[0] || null;
  },

  /**
   * Trouve un utilisateur par ID
   * Utilisé par le middleware authenticate pour vérifier le compte à chaque requête
   */
  async findById(id) {
    const [rows] = await db.query(
      `SELECT u.id, u.prenom, u.nom, u.email, u.actif, u.agence_id,
              r.nom AS role_nom
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?
       LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Liste tous les utilisateurs (UC-02 — gestion utilisateurs)
   * Filtres optionnels : role_nom, actif, agence_id
   */
  async findAll({ role_nom, actif, agence_id } = {}) {
    let sql = `
      SELECT u.id, u.prenom, u.nom, u.email, u.actif,
             u.created_at, u.agence_id,
             r.nom  AS role_nom,
             a.nom  AS agence_nom
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN agences a ON a.id = u.agence_id
      WHERE 1=1`;
    const params = [];

    if (role_nom)  { sql += ' AND r.nom = ?';     params.push(role_nom); }
    if (actif !== undefined) { sql += ' AND u.actif = ?'; params.push(actif ? 1 : 0); }
    if (agence_id) { sql += ' AND u.agence_id = ?'; params.push(agence_id); }

    sql += ' ORDER BY u.prenom, u.nom';
    const [rows] = await db.query(sql, params);
    return rows;
  },

  /**
   * Crée un nouvel utilisateur (UC-02)
   */
  async create({ prenom, nom, email, password_hash, role_id, agence_id }) {
    const [result] = await db.query(
      `INSERT INTO users (prenom, nom, email, password_hash, role_id, agence_id, actif, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
      [prenom, nom, email.toLowerCase().trim(), password_hash, role_id, agence_id || null]
    );
    return result.insertId;
  },

  /**
   * Met à jour un utilisateur (UC-02)
   */
  async update(id, fields) {
    const allowed  = ['prenom', 'nom', 'email', 'role_id', 'agence_id', 'actif', 'password_hash'];
    const updates  = [];
    const params   = [];

    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        updates.push(`${key} = ?`);
        params.push(val);
      }
    }
    if (!updates.length) return false;

    params.push(id);
    await db.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
    return true;
  },

  /**
   * Enregistre la dernière connexion
   */
  async updateLastLogin(id) {
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [id]
    );
  },

  /**
   * Vérifie si un email est déjà utilisé
   */
  async emailExists(email, excludeId = null) {
    let sql = 'SELECT id FROM users WHERE email = ?';
    const params = [email.toLowerCase().trim()];
    if (excludeId) { sql += ' AND id != ?'; params.push(excludeId); }
    const [rows] = await db.query(sql, params);
    return rows.length > 0;
  },
};

module.exports = UserModel;
