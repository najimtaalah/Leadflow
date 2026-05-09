'use strict';

const db = require('../config/database');

const LeadModel = {

  /**
   * Liste des leads avec filtres
   * UC-07 : COMMERCIAL ne voit que ses leads (vendeur_id)
   * UC-07 : MANAGER voit les leads de son équipe (agence_id)
   * UC-07 : ROLE_ADMIN / SUPER_ADMIN voient tout
   */
  async findAll({ vendeur_id, agence_id, statut, source_id, formation, search, limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT
        l.id, l.nom, l.prenom, l.telephone, l.email,
        l.statut, l.source_id, l.formation_souhaitee,
        l.created_at, l.updated_at,
        s.nom           AS source_nom,
        CONCAT(u.prenom,' ',u.nom) AS vendeur_nom,
        l.vendeur_id,
        a.nom           AS agence_nom,
        l.agence_id
      FROM leads l
      LEFT JOIN sources_leads s  ON s.id  = l.source_id
      LEFT JOIN users u          ON u.id  = l.vendeur_id
      LEFT JOIN agences a        ON a.id  = l.agence_id
      WHERE 1=1`;
    const params = [];

    if (vendeur_id) { sql += ' AND l.vendeur_id = ?';  params.push(vendeur_id); }
    if (agence_id)  { sql += ' AND l.agence_id = ?';   params.push(agence_id); }
    if (statut)     { sql += ' AND l.statut = ?';      params.push(statut); }
    if (source_id)  { sql += ' AND l.source_id = ?';   params.push(source_id); }
    if (formation)  { sql += ' AND l.formation_souhaitee LIKE ?'; params.push(`%${formation}%`); }
    if (search) {
      sql += ' AND (l.nom LIKE ? OR l.prenom LIKE ? OR l.telephone LIKE ? OR l.email LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows]    = await db.query(sql, params);
    const [[count]] = await db.query(
      `SELECT COUNT(*) AS total FROM leads l WHERE 1=1
       ${vendeur_id ? 'AND l.vendeur_id = ?' : ''}
       ${agence_id  ? 'AND l.agence_id = ?'  : ''}
       ${statut     ? 'AND l.statut = ?'      : ''}`,
      [...(vendeur_id ? [vendeur_id] : []),
       ...(agence_id  ? [agence_id]  : []),
       ...(statut     ? [statut]     : [])]
    );
    return { leads: rows, total: count.total };
  },

  /** Détail d'un lead avec historique de pipeline */
  async findById(id) {
    const [[lead]] = await db.query(
      `SELECT
         l.*, s.nom AS source_nom,
         CONCAT(u.prenom,' ',u.nom) AS vendeur_nom,
         f.nom AS formation_nom
       FROM leads l
       LEFT JOIN sources_leads s ON s.id = l.source_id
       LEFT JOIN users u         ON u.id = l.vendeur_id
       LEFT JOIN formations f    ON f.nom = l.formation_souhaitee
       WHERE l.id = ?`,
      [id]
    );
    return lead || null;
  },

  /** Vérifie si un doublon existe (même email ou téléphone) */
  async checkDuplicate(email, telephone, excludeId = null) {
    let sql = 'SELECT id, nom, prenom, statut FROM leads WHERE (email = ? OR telephone = ?)';
    const params = [email, telephone];
    if (excludeId) { sql += ' AND id != ?'; params.push(excludeId); }
    const [rows] = await db.query(sql, params);
    return rows[0] || null;
  },

  /** Crée un lead */
  async create({ nom, prenom, telephone, email, source_id, formation_souhaitee, agence_id, vendeur_id, notes }) {
    const [result] = await db.query(
      `INSERT INTO leads
         (nom, prenom, telephone, email, source_id, formation_souhaitee,
          agence_id, vendeur_id, statut, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'entrant', ?, NOW(), NOW())`,
      [nom, prenom, telephone, email || null,
       source_id || null, formation_souhaitee || null,
       agence_id || null, vendeur_id || null, notes || null]
    );
    return result.insertId;
  },

  /** Met à jour un lead */
  async update(id, fields) {
    const allowed = ['nom', 'prenom', 'telephone', 'email', 'source_id',
                     'formation_souhaitee', 'vendeur_id', 'agence_id', 'statut', 'notes',
                     'badge_pre_dossier'];
    const updates = []; const params = [];
    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) { updates.push(`${key} = ?`); params.push(val); }
    }
    if (!updates.length) return false;
    params.push(id);
    await db.query(`UPDATE leads SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    return true;
  },

  /** Récupère le vendeur initial (premier dans pipeline_historique) */
  async getOriginalVendeur(leadId) {
    const [rows] = await db.query(
      `SELECT vendeur_id FROM pipeline_historique
       WHERE lead_id = ? ORDER BY created_at ASC LIMIT 1`,
      [leadId]
    );
    return rows[0]?.vendeur_id || null;
  },

  /** Enregistre une réassignation */
  async createReassignation({ lead_id, ancien_vendeur_id, nouveau_vendeur_id, motif, fait_par }) {
    await db.query(
      `INSERT INTO reassignations
         (lead_id, ancien_vendeur_id, nouveau_vendeur_id, motif, fait_par_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [lead_id, ancien_vendeur_id, nouveau_vendeur_id, motif || 'auto', fait_par]
    );
  },

  /** Compte les leads d'un commercial pour vérifier les limites */
  async countByVendeur(vendeurId, statuts = ['entrant','contacte','qualifie','rdv_booke']) {
    const placeholders = statuts.map(() => '?').join(',');
    const [[row]] = await db.query(
      `SELECT COUNT(*) AS total FROM leads WHERE vendeur_id = ? AND statut IN (${placeholders})`,
      [vendeurId, ...statuts]
    );
    return row.total;
  },

  /** Récupère la config de distribution */
  async getDistributionConfig(agenceId = null) {
    let sql = 'SELECT * FROM config_distribution WHERE actif = 1';
    const params = [];
    if (agenceId) { sql += ' AND (agence_id = ? OR agence_id IS NULL) ORDER BY agence_id DESC'; params.push(agenceId); }
    sql += ' LIMIT 1';
    const [rows] = await db.query(sql, params);
    return rows[0] || null;
  },

  /** Trouve le commercial disponible avec le moins de leads actifs */
  async findAvailableCommercial(agenceId = null) {
    let sql = `
      SELECT u.id, u.prenom, u.nom,
             COALESCE(al.max_leads, 999) AS max_leads,
             COUNT(l.id) AS leads_actifs
      FROM users u
      JOIN roles r ON r.id = u.role_id AND r.nom IN ('commercial','manager')
      LEFT JOIN agent_limites al ON al.user_id = u.id
      LEFT JOIN leads l ON l.vendeur_id = u.id
        AND l.statut IN ('entrant','contacte','qualifie','rdv_booke')
      WHERE u.actif = 1`;
    const params = [];
    if (agenceId) { sql += ' AND u.agence_id = ?'; params.push(agenceId); }
    sql += ' GROUP BY u.id HAVING leads_actifs < max_leads ORDER BY leads_actifs ASC LIMIT 1';
    const [rows] = await db.query(sql, params);
    return rows[0] || null;
  },
};

module.exports = LeadModel;
