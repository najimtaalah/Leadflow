'use strict';

const db = require('../config/database');

const CommissionModel = {

  /**
   * Récupère les taux depuis config_commissions
   * UC-39 : taux modifiables sans toucher au code
   */
  async getTaux() {
    const [rows] = await db.query(
      'SELECT role_nom, taux_base, taux_supplement_equipe FROM config_commissions WHERE actif = 1'
    );
    const taux = {};
    rows.forEach(r => { taux[r.role_nom] = r; });
    return taux;
  },

  /**
   * Calcule les commissions via la vue vue_commissions
   * UC-37 / UC-38 — inclut supplement_equipe pour le manager
   */
  async getCommissions({ vendeur_id, agence_id, mois } = {}) {
    let sql = `
      SELECT
        vc.vendeur_id,
        vc.vendeur_nom,
        vc.role_nom,
        vc.nb_dossiers,
        vc.base_calcul,
        vc.commission_base,
        vc.supplement_equipe,
        vc.commission_totale,
        vc.agence_nom,
        vc.agence_id,
        cc.taux_base,
        cc.taux_supplement_equipe
      FROM vue_commissions vc
      LEFT JOIN config_commissions cc ON cc.role_nom = vc.role_nom
      WHERE 1=1`;
    const params = [];

    if (vendeur_id) { sql += ' AND vc.vendeur_id = ?'; params.push(vendeur_id); }
    if (agence_id)  { sql += ' AND vc.agence_id = ?';  params.push(agence_id); }

    sql += ' ORDER BY vc.commission_totale DESC';
    const [rows] = await db.query(sql, params);
    return rows;
  },

  /**
   * Commissions d'un commercial sur une période donnée (mois)
   * UC-37 : filtrage par mois optionnel
   */
  async getCommissionsPeriode(vendeurId, mois = null) {
    let sql = `
      SELECT
        d.id AS dossier_id,
        d.reference,
        CONCAT(d.prenom,' ',d.nom) AS apprenant_nom,
        d.formation_souhaitee,
        d.cout_total_formation     AS base_calcul,
        d.created_at,
        cc.taux_base,
        ROUND(d.cout_total_formation * cc.taux_base / 100, 2) AS commission
      FROM dossiers d
      JOIN users u   ON u.id = d.vendeur_id
      JOIN roles r   ON r.id = u.role_id
      JOIN config_commissions cc ON cc.role_nom = r.nom
      WHERE d.vendeur_id = ?
        AND d.archived = 0
        AND d.cout_total_formation > 0`;
    const params = [vendeurId];

    if (mois) {
      sql += " AND DATE_FORMAT(d.created_at, '%Y-%m') = ?";
      params.push(mois);
    }

    sql += ' ORDER BY d.created_at DESC';
    const [rows] = await db.query(sql, params);

    // Totaux
    const total_base    = rows.reduce((s, r) => s + (parseFloat(r.base_calcul)  || 0), 0);
    const total_comm    = rows.reduce((s, r) => s + (parseFloat(r.commission)    || 0), 0);
    const taux_base     = rows[0]?.taux_base || 6.5;

    return { dossiers: rows, total_base, total_commission: total_comm, taux_base };
  },

  /**
   * Détail des commissions équipe pour un manager
   * UC-38 : 6.5% propre + 1.5% × Σ commissions commerciaux
   */
  async getCommissionsManager(managerId, mois = null) {
    // Commission propre du manager
    const propre = await CommissionModel.getCommissionsPeriode(managerId, mois);

    // Récupérer l'agence du manager
    const [[manager]] = await db.query(
      'SELECT agence_id FROM users WHERE id = ?', [managerId]
    );
    if (!manager) return null;

    // Commissions de l'équipe (commerciaux de la même agence)
    let sql = `
      SELECT
        u.id AS vendeur_id,
        CONCAT(u.prenom,' ',u.nom) AS vendeur_nom,
        COUNT(d.id)                AS nb_dossiers,
        COALESCE(SUM(d.cout_total_formation), 0) AS base_calcul,
        cc.taux_base,
        ROUND(COALESCE(SUM(d.cout_total_formation), 0) * cc.taux_base / 100, 2) AS commission
      FROM users u
      JOIN roles r   ON r.id = u.role_id AND r.nom = 'commercial'
      JOIN config_commissions cc ON cc.role_nom = 'commercial'
      LEFT JOIN dossiers d ON d.vendeur_id = u.id
        AND d.archived = 0
        AND d.cout_total_formation > 0
        ${mois ? "AND DATE_FORMAT(d.created_at, '%Y-%m') = ?" : ''}
      WHERE u.agence_id = ? AND u.actif = 1
      GROUP BY u.id, u.prenom, u.nom, cc.taux_base
      ORDER BY commission DESC`;

    const paramsEquipe = [];
    if (mois) paramsEquipe.push(mois);
    paramsEquipe.push(manager.agence_id);

    const [equipe] = await db.query(sql, paramsEquipe);

    // Calculer le supplément manager (1.5% × total commissions équipe)
    const [[configManager]] = await db.query(
      "SELECT taux_supplement_equipe FROM config_commissions WHERE role_nom = 'manager' LIMIT 1"
    );
    const tauxSuppl       = parseFloat(configManager?.taux_supplement_equipe || 1.5);
    const totalCommEquipe = equipe.reduce((s, e) => s + parseFloat(e.commission || 0), 0);
    const supplement      = Math.round(totalCommEquipe * tauxSuppl / 100 * 100) / 100;

    return {
      manager: {
        commission_propre:    propre.total_commission,
        taux_base:            propre.taux_base,
        nb_dossiers_propres:  propre.dossiers.length,
        base_calcul_propre:   propre.total_base,
      },
      equipe: {
        membres:              equipe,
        total_comm_equipe:    totalCommEquipe,
        taux_supplement:      tauxSuppl,
        supplement_manager:   supplement,
      },
      totaux: {
        commission_propre:    propre.total_commission,
        supplement_equipe:    supplement,
        commission_totale:    Math.round((propre.total_commission + supplement) * 100) / 100,
      },
    };
  },

  /**
   * KPIs commissions globaux
   */
  async getKpis(agenceId = null) {
    let where = '';
    const params = [];
    if (agenceId) { where = 'WHERE vc.agence_id = ?'; params.push(agenceId); }

    const [[kpis]] = await db.query(
      `SELECT
         COUNT(DISTINCT vc.vendeur_id)  AS nb_commerciaux,
         SUM(vc.nb_dossiers)            AS nb_dossiers_total,
         SUM(vc.base_calcul)            AS ca_total,
         SUM(vc.commission_totale)      AS total_commissions,
         MAX(vc.commission_totale)      AS commission_max
       FROM vue_commissions vc
       ${where}`,
      params
    );
    return kpis;
  },

  /**
   * Historique mensuel des commissions pour l'export (UC-40)
   */
  async getHistoriqueMensuel(vendeurId, nbMois = 12) {
    const [rows] = await db.query(
      `SELECT
         DATE_FORMAT(d.created_at, '%Y-%m') AS mois,
         COUNT(d.id)                         AS nb_dossiers,
         SUM(d.cout_total_formation)         AS base_calcul,
         cc.taux_base,
         ROUND(SUM(d.cout_total_formation) * cc.taux_base / 100, 2) AS commission
       FROM dossiers d
       JOIN users u ON u.id = d.vendeur_id
       JOIN roles r ON r.id = u.role_id
       JOIN config_commissions cc ON cc.role_nom = r.nom
       WHERE d.vendeur_id = ?
         AND d.archived = 0
         AND d.cout_total_formation > 0
         AND d.created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY DATE_FORMAT(d.created_at, '%Y-%m'), cc.taux_base
       ORDER BY mois ASC`,
      [vendeurId, nbMois]
    );
    return rows;
  },

  /**
   * Mise à jour des taux (UC-39 — SUPER_ADMIN uniquement)
   */
  async updateTaux(roleNom, { taux_base, taux_supplement_equipe }) {
    const updates = []; const params = [];
    if (taux_base !== undefined) {
      updates.push('taux_base = ?'); params.push(parseFloat(taux_base));
    }
    if (taux_supplement_equipe !== undefined) {
      updates.push('taux_supplement_equipe = ?'); params.push(parseFloat(taux_supplement_equipe));
    }
    if (!updates.length) return false;
    params.push(roleNom);
    await db.query(
      `UPDATE config_commissions SET ${updates.join(', ')}, updated_at = NOW() WHERE role_nom = ?`,
      params
    );
    return true;
  },

  /**
   * Vérifie si le rôle est manager (pour la règle du supplément)
   */
  async isManager(userId) {
    const [[row]] = await db.query(
      "SELECT r.nom FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? AND r.nom = 'manager'",
      [userId]
    );
    return !!row;
  },
};

module.exports = CommissionModel;
