'use strict';

const db = require('../config/database');

const ApprenantModel = {

  /** Crée un apprenant — typiquement lors de la conversion d'un lead */
  async create({ id_lead_origine, nom, prenom, date_naissance, telephone, email, adresse }) {
    const [result] = await db.query(
      `INSERT INTO apprenants
         (id_lead_origine, nom, prenom, date_naissance, telephone, email, adresse,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id_lead_origine || null,
        nom,
        prenom || '',
        date_naissance || null,
        telephone || null,
        email ? email.toLowerCase().trim() : null,
        adresse || null,
      ]
    );
    return result.insertId;
  },

  /** Retrouve un apprenant par son id */
  async findById(id) {
    const [[row]] = await db.query(
      `SELECT a.*,
              l.statut AS lead_statut,
              CONCAT(u.prenom,' ',u.nom) AS commercial_nom
       FROM apprenants a
       LEFT JOIN leads l ON l.id = a.id_lead_origine
       LEFT JOIN users u ON u.id = l.vendeur_id
       WHERE a.id = ?`,
      [id]
    );
    return row || null;
  },

  /** Retrouve l'apprenant issu d'un lead précis */
  async findByLead(leadId) {
    const [[row]] = await db.query(
      'SELECT * FROM apprenants WHERE id_lead_origine = ? LIMIT 1',
      [leadId]
    );
    return row || null;
  },

  /** Liste paginée */
  async findAll({ search, limit = 50, offset = 0 } = {}) {
    let sql = `SELECT a.id, a.nom, a.prenom, a.telephone, a.email,
                      a.id_lead_origine, a.created_at
               FROM apprenants a WHERE 1=1`;
    const params = [];
    if (search) {
      sql += ' AND (a.nom LIKE ? OR a.prenom LIKE ? OR a.telephone LIKE ? OR a.email LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [rows] = await db.query(sql, params);
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM apprenants a WHERE 1=1
       ${search ? 'AND (a.nom LIKE ? OR a.prenom LIKE ? OR a.telephone LIKE ? OR a.email LIKE ?)' : ''}`,
      search ? [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`] : []
    );
    return { apprenants: rows, total };
  },

  /** Met à jour un apprenant */
  async update(id, fields) {
    const allowed = ['nom', 'prenom', 'date_naissance', 'telephone', 'email', 'adresse'];
    const updates = [];
    const params = [];
    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) { updates.push(`${key} = ?`); params.push(val); }
    }
    if (!updates.length) return false;
    params.push(id);
    await db.query(
      `UPDATE apprenants SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
    return true;
  },

  /**
   * Crée un apprenant depuis un lead existant.
   * Copie nom/prénom/téléphone/email du lead, retourne l'id apprenant.
   */
  async createFromLead(leadId) {
    const [[lead]] = await db.query(
      'SELECT id, nom, prenom, telephone, email FROM leads WHERE id = ?',
      [leadId]
    );
    if (!lead) throw new Error('Lead introuvable');
    return this.create({
      id_lead_origine: lead.id,
      nom:             lead.nom,
      prenom:          lead.prenom,
      telephone:       lead.telephone,
      email:           lead.email,
    });
  },
};

module.exports = ApprenantModel;
