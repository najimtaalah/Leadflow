'use strict';

const db = require('../config/database');

const RDVModel = {

  /**
   * Liste des RDV avec filtres
   * UC-32 : filtre auto selon le rôle
   */
  async findAll({
    responsable_id, agence_id, type_rdv, statut,
    date_debut, date_fin, lead_id, dossier_id,
    limit = 50, offset = 0
  } = {}) {
    let sql = `
      SELECT
        r.id, r.type_rdv, r.titre, r.description,
        r.date_rdv, r.heure_debut, r.heure_fin,
        r.statut, r.notif_email, r.notif_sms, r.notif_rappel_24h,
        r.responsable_id, r.lead_id, r.dossier_id,
        r.created_at, r.updated_at,
        CONCAT(u.prenom,' ',u.nom) AS responsable_nom,
        -- Lead associé
        CONCAT(l.prenom,' ',l.nom) AS lead_nom,
        -- Dossier associé
        CONCAT(d.prenom,' ',d.nom) AS dossier_nom,
        d.reference AS dossier_reference,
        -- Agence du responsable
        u.agence_id
      FROM agenda_rdv r
      JOIN users u ON u.id = r.responsable_id
      LEFT JOIN leads l   ON l.id = r.lead_id
      LEFT JOIN dossiers d ON d.id = r.dossier_id
      WHERE 1=1`;
    const params = [];

    if (responsable_id) { sql += ' AND r.responsable_id = ?'; params.push(responsable_id); }
    if (agence_id)      { sql += ' AND u.agence_id = ?';      params.push(agence_id); }
    if (type_rdv)       { sql += ' AND r.type_rdv = ?';       params.push(type_rdv); }
    if (statut) {
      const statuts = statut.split(',').map(s => s.trim()).filter(Boolean);
      if (statuts.length === 1) {
        sql += ' AND r.statut = ?'; params.push(statuts[0]);
      } else {
        sql += ` AND r.statut IN (${statuts.map(() => '?').join(',')})`;
        params.push(...statuts);
      }
    }
    if (lead_id)        { sql += ' AND r.lead_id = ?';        params.push(lead_id); }
    if (dossier_id)     { sql += ' AND r.dossier_id = ?';     params.push(dossier_id); }
    if (date_debut)     { sql += ' AND r.date_rdv >= ?';      params.push(date_debut); }
    if (date_fin)       { sql += ' AND r.date_rdv <= ?';      params.push(date_fin); }

    sql += ' ORDER BY r.date_rdv ASC, r.heure_debut ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);
    return rows;
  },

  /**
   * RDV du jour pour le widget Dashboard (UC-36)
   */
  async findToday(agenceId = null, responsableId = null) {
    let sql = `
      SELECT
        r.id, r.type_rdv, r.titre, r.heure_debut, r.heure_fin,
        r.statut, r.date_rdv,
        CONCAT(u.prenom,' ',u.nom) AS responsable_nom,
        CONCAT(COALESCE(l.prenom,''), ' ', COALESCE(l.nom,''))  AS lead_nom,
        CONCAT(COALESCE(d.prenom,''), ' ', COALESCE(d.nom,''))  AS dossier_nom
      FROM agenda_rdv r
      JOIN users u ON u.id = r.responsable_id
      LEFT JOIN leads   l ON l.id = r.lead_id
      LEFT JOIN dossiers d ON d.id = r.dossier_id
      WHERE DATE(r.date_rdv) = CURDATE()
        AND r.statut NOT IN ('annule','effectue')`;
    const params = [];

    if (responsableId) { sql += ' AND r.responsable_id = ?'; params.push(responsableId); }
    if (agenceId)      { sql += ' AND u.agence_id = ?';      params.push(agenceId); }

    sql += ' ORDER BY r.heure_debut ASC LIMIT 10';
    const [rows] = await db.query(sql, params);
    return rows;
  },

  /**
   * Détail d'un RDV
   */
  async findById(id) {
    const [[row]] = await db.query(
      `SELECT
         r.*,
         CONCAT(u.prenom,' ',u.nom) AS responsable_nom,
         u.email AS responsable_email, u.telephone AS responsable_tel,
         CONCAT(l.prenom,' ',l.nom)  AS lead_nom,   l.telephone AS lead_tel,   l.email AS lead_email,
         CONCAT(d.prenom,' ',d.nom)  AS dossier_nom, d.telephone AS dossier_tel, d.email AS dossier_email,
         d.reference AS dossier_reference
       FROM agenda_rdv r
       JOIN users u ON u.id = r.responsable_id
       LEFT JOIN leads   l  ON l.id  = r.lead_id
       LEFT JOIN dossiers d ON d.id  = r.dossier_id
       WHERE r.id = ?`,
      [id]
    );
    return row || null;
  },

  /**
   * Vérifie les conflits d'horaire pour un responsable (UC-31)
   */
  async checkConflict(responsableId, dateRdv, heureDebut, heureFin, excludeId = null) {
    let sql = `
      SELECT id, titre, heure_debut, heure_fin
      FROM agenda_rdv
      WHERE responsable_id = ?
        AND date_rdv = ?
        AND statut NOT IN ('annule')
        AND (
          (heure_debut < ? AND heure_fin > ?)
          OR (heure_debut >= ? AND heure_debut < ?)
        )`;
    const params = [responsableId, dateRdv, heureFin, heureDebut, heureDebut, heureFin];
    if (excludeId) { sql += ' AND id != ?'; params.push(excludeId); }
    const [rows] = await db.query(sql, params);
    return rows;
  },

  /**
   * Crée un RDV (UC-31)
   */
  async create({
    type_rdv, titre, description, date_rdv, heure_debut, heure_fin,
    responsable_id, lead_id, dossier_id,
    notif_email, notif_sms, notif_rappel_24h, created_by
  }) {
    const [result] = await db.query(
      `INSERT INTO agenda_rdv
         (type_rdv, titre, description, date_rdv, heure_debut, heure_fin,
          responsable_id, lead_id, dossier_id,
          statut, notif_email, notif_sms, notif_rappel_24h,
          created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planifie', ?, ?, ?, ?, NOW(), NOW())`,
      [
        type_rdv, titre, description || null, date_rdv, heure_debut, heure_fin,
        responsable_id, lead_id || null, dossier_id || null,
        notif_email ? 1 : 0, notif_sms ? 1 : 0, notif_rappel_24h ? 1 : 0,
        created_by,
      ]
    );
    return result.insertId;
  },

  /**
   * Met à jour un RDV
   */
  async update(id, fields) {
    const allowed = [
      'type_rdv', 'titre', 'description', 'date_rdv',
      'heure_debut', 'heure_fin', 'responsable_id',
      'lead_id', 'dossier_id', 'statut',
      'notif_email', 'notif_sms', 'notif_rappel_24h',
    ];
    const updates = []; const params = [];
    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) { updates.push(`${key} = ?`); params.push(val); }
    }
    if (!updates.length) return false;
    params.push(id);
    await db.query(
      `UPDATE agenda_rdv SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
    return true;
  },

  /**
   * KPIs agenda pour Dashboard (UC-36)
   */
  async getKpis(agenceId = null) {
    let where = "WHERE r.statut NOT IN ('annule')";
    const params = [];
    if (agenceId) { where += ' AND u.agence_id = ?'; params.push(agenceId); }

    const [[kpis]] = await db.query(
      `SELECT
         SUM(DATE(r.date_rdv) = CURDATE())               AS rdv_aujourd_hui,
         SUM(YEARWEEK(r.date_rdv) = YEARWEEK(CURDATE())) AS rdv_cette_semaine,
         SUM(r.statut = 'en_attente')                    AS en_attente,
         SUM(MONTH(r.date_rdv) = MONTH(CURDATE())
           AND YEAR(r.date_rdv) = YEAR(CURDATE()))       AS rdv_ce_mois
       FROM agenda_rdv r
       JOIN users u ON u.id = r.responsable_id
       ${where}`,
      params
    );
    return kpis;
  },

  /**
   * RDV à rappeler dans les prochaines 24h (pour le cron de rappels)
   */
  async findRappels24h() {
    const [rows] = await db.query(
      `SELECT r.*,
         CONCAT(u.prenom,' ',u.nom) AS responsable_nom,
         u.email AS responsable_email,
         COALESCE(l.email, d.email) AS personne_email,
         COALESCE(l.telephone, d.telephone) AS personne_tel,
         COALESCE(CONCAT(l.prenom,' ',l.nom), CONCAT(d.prenom,' ',d.nom)) AS personne_nom
       FROM agenda_rdv r
       JOIN users u ON u.id = r.responsable_id
       LEFT JOIN leads   l  ON l.id  = r.lead_id
       LEFT JOIN dossiers d ON d.id  = r.dossier_id
       WHERE r.notif_rappel_24h = 1
         AND r.statut IN ('planifie','confirme')
         AND r.date_rdv = DATE_ADD(CURDATE(), INTERVAL 1 DAY)`
    );
    return rows;
  },
};

module.exports = RDVModel;
