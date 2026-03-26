'use strict';

const db = require('../config/database');

const ReportingModel = {

  // ══════════════════════════════════════════════════════════════
  // UC-41 — PERFORMANCE COMMERCIALE
  // ══════════════════════════════════════════════════════════════

  /**
   * KPIs performance globaux
   */
  async getKpisPerformance(agenceId = null, mois = null) {
    let where = 'WHERE 1=1';
    const params = [];

    if (agenceId) { where += ' AND l.agence_id = ?';  params.push(agenceId); }
    if (mois)     {
      where += " AND DATE_FORMAT(l.created_at, '%Y-%m') = ?";
      params.push(mois);
    }

    const [[kpis]] = await db.query(`
      SELECT
        COUNT(*)                                          AS total_leads,
        SUM(l.statut = 'gagne')                          AS leads_gagnes,
        SUM(l.statut IN ('perdu','annule'))               AS leads_perdus,
        SUM(l.statut IN ('entrant','contacte','qualifie',
                         'rdv_booke','en_suspens'))       AS leads_actifs,
        ROUND(
          SUM(l.statut = 'gagne') * 100.0
          / NULLIF(COUNT(*), 0), 1
        )                                                 AS taux_conversion,
        AVG(CASE WHEN l.statut != 'entrant'
            THEN TIMESTAMPDIFF(HOUR, l.created_at, l.updated_at)
            END)                                          AS delai_moyen_contact_h
      FROM leads l
      ${where}`,
      params
    );
    return kpis;
  },

  /**
   * Performance par commercial — tableau détaillé
   */
  async getPerformanceParCommercial(agenceId = null, mois = null) {
    let having = '';
    const params = [];
    const whereDate = mois
      ? `AND DATE_FORMAT(l.created_at, '%Y-%m') = ?`
      : '';
    if (mois) params.push(mois);
    if (agenceId) params.push(agenceId);

    const [rows] = await db.query(`
      SELECT
        u.id                           AS vendeur_id,
        CONCAT(u.prenom,' ',u.nom)     AS vendeur_nom,
        COUNT(l.id)                    AS nb_leads,
        SUM(l.statut != 'entrant')     AS nb_contactes,
        SUM(l.statut = 'rdv_booke'
          OR l.statut = 'gagne')       AS nb_rdv,
        SUM(l.statut = 'gagne')        AS nb_gagnes,
        SUM(l.statut IN ('perdu','annule')) AS nb_perdus,
        ROUND(
          SUM(l.statut = 'gagne') * 100.0
          / NULLIF(COUNT(l.id), 0), 1
        )                              AS taux_conversion
      FROM users u
      JOIN roles r ON r.id = u.role_id
        AND r.nom IN ('commercial','manager')
      LEFT JOIN leads l ON l.vendeur_id = u.id
        ${whereDate}
      WHERE u.actif = 1
        ${agenceId ? 'AND u.agence_id = ?' : ''}
      GROUP BY u.id, u.prenom, u.nom
      ORDER BY nb_gagnes DESC, taux_conversion DESC`,
      params
    );
    return rows;
  },

  /**
   * Évolution mensuelle des leads — graphique (6 derniers mois)
   */
  async getEvolutionMensuelle(nbMois = 6, agenceId = null) {
    let where = 'WHERE l.created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)';
    const params = [nbMois];
    if (agenceId) { where += ' AND l.agence_id = ?'; params.push(agenceId); }

    const [rows] = await db.query(`
      SELECT
        DATE_FORMAT(l.created_at, '%Y-%m')  AS mois,
        COUNT(*)                             AS total,
        SUM(l.statut = 'gagne')             AS gagnes,
        SUM(l.statut IN ('perdu','annule')) AS perdus,
        ROUND(
          SUM(l.statut = 'gagne') * 100.0
          / NULLIF(COUNT(*), 0), 1
        )                                   AS taux_conversion
      FROM leads l
      ${where}
      GROUP BY DATE_FORMAT(l.created_at, '%Y-%m')
      ORDER BY mois ASC`,
      params
    );
    return rows;
  },

  /**
   * Répartition des leads par source
   */
  async getRepartitionSources(agenceId = null, mois = null) {
    let where = 'WHERE 1=1';
    const params = [];
    if (agenceId) { where += ' AND l.agence_id = ?';  params.push(agenceId); }
    if (mois)     {
      where += " AND DATE_FORMAT(l.created_at, '%Y-%m') = ?";
      params.push(mois);
    }

    const [rows] = await db.query(`
      SELECT
        COALESCE(s.nom, 'Inconnu') AS source_nom,
        COUNT(*)                    AS total,
        SUM(l.statut = 'gagne')    AS gagnes,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct_total
      FROM leads l
      LEFT JOIN sources_leads s ON s.id = l.source_id
      ${where}
      GROUP BY s.id, s.nom
      ORDER BY total DESC`,
      params
    );
    return rows;
  },

  // ══════════════════════════════════════════════════════════════
  // UC-42 — POINT FINANCIER (réexposé depuis Finance)
  // ══════════════════════════════════════════════════════════════

  /**
   * Situation financière globale — délégué à FinanceModel
   * (le Point Financier est dans Finance, mais le Reporting y accède aussi)
   */
  async getPointFinancier(agenceId = null, mois = null) {
    const FinanceModel = require('./Finance');
    const [situation, historique] = await Promise.all([
      FinanceModel.getSituationGlobale(agenceId, mois),
      FinanceModel.getHistoriqueMensuel(6, agenceId),
    ]);
    return { situation, historique };
  },

  // ══════════════════════════════════════════════════════════════
  // DASHBOARD — KPIs Gestion Dossiers
  // ══════════════════════════════════════════════════════════════

  /**
   * KPIs pour le sous-menu "Gestion Dossiers" du Dashboard
   */
  async getKpisGestion(agenceId = null) {
    const agenceWhere = agenceId ? 'AND d.agence_id = ?' : '';
    const params      = agenceId ? [agenceId] : [];

    const [[kpis]] = await db.query(`
      SELECT
        COUNT(*)                                                       AS dossiers_crees,
        SUM(d.session_cours_id IS NULL AND d.session_edof_id IS NULL)  AS affectation_a_faire,
        SUM(d.frais_cma IS NULL)                                       AS espace_cma_a_creer,
        SUM(d.frais_cma > 0 AND d.frais_cma_paye = 0)                 AS paiement_cma_a_faire
      FROM dossiers d
      WHERE d.archived = 0 ${agenceWhere}
    `, params);

    const [[sess]] = await db.query(
      'SELECT COUNT(*) AS sessions_ouvertes FROM sessions_formation WHERE actif = 1'
    );

    return {
      dossiers_crees:       parseInt(kpis.dossiers_crees)       || 0,
      affectation_a_faire:  parseInt(kpis.affectation_a_faire)  || 0,
      espace_cma_a_creer:   parseInt(kpis.espace_cma_a_creer)   || 0,
      paiement_cma_a_faire: parseInt(kpis.paiement_cma_a_faire) || 0,
      sessions_ouvertes:    parseInt(sess.sessions_ouvertes)    || 0,
    };
  },

  // ══════════════════════════════════════════════════════════════
  // UC-43 — COMMISSIONS (réexposé depuis CommissionModel)
  // ══════════════════════════════════════════════════════════════

  /**
   * Tableau commissions avec détail — délégué à CommissionModel
   */
  async getTableauCommissions(agenceId = null) {
    const CommissionModel = require('./Commission');
    const [commissions, kpis, taux] = await Promise.all([
      CommissionModel.getCommissions({ agence_id: agenceId }),
      CommissionModel.getKpis(agenceId),
      CommissionModel.getTaux(),
    ]);
    return { commissions, kpis, taux };
  },

  // ══════════════════════════════════════════════════════════════
  // UC-44 — EXPORT DONNÉES RAPPORT
  // ══════════════════════════════════════════════════════════════

  /**
   * Données complètes pour export Performance Commerciale
   */
  async buildExportPerformance(agenceId = null, mois = null) {
    const [kpis, parCommercial, evolution, sources] = await Promise.all([
      ReportingModel.getKpisPerformance(agenceId, mois),
      ReportingModel.getPerformanceParCommercial(agenceId, mois),
      ReportingModel.getEvolutionMensuelle(6, agenceId),
      ReportingModel.getRepartitionSources(agenceId, mois),
    ]);
    return {
      type:           'performance_commerciale',
      generated_at:   new Date().toISOString(),
      periode:        mois || 'Toutes périodes',
      agence_id:      agenceId,
      kpis,
      par_commercial: parCommercial,
      evolution_mensuelle: evolution,
      sources,
    };
  },

  /**
   * Données complètes pour export Commissions
   */
  async buildExportCommissions(agenceId = null, mois = null) {
    const CommissionModel = require('./Commission');
    const [commissions, kpis, taux] = await Promise.all([
      CommissionModel.getCommissions({ agence_id: agenceId }),
      CommissionModel.getKpis(agenceId),
      CommissionModel.getTaux(),
    ]);
    return {
      type:         'commissions',
      generated_at: new Date().toISOString(),
      periode:      mois || 'Toutes périodes',
      agence_id:    agenceId,
      kpis,
      commissions,
      taux,
    };
  },

  /**
   * Données complètes pour export Point Financier
   */
  async buildExportFinancier(agenceId = null, mois = null) {
    const data = await ReportingModel.getPointFinancier(agenceId, mois);
    return {
      type:         'point_financier',
      generated_at: new Date().toISOString(),
      periode:      mois || 'Toutes périodes',
      agence_id:    agenceId,
      ...data,
    };
  },

  /**
   * Sauvegarde un rapport demandé dans rapports_config
   */
  async saveRapportConfig({ type, params, user_id }) {
    const [result] = await db.query(
      `INSERT INTO rapports_config (type, params, created_by, created_at)
       VALUES (?, ?, ?, NOW())`,
      [type, JSON.stringify(params), user_id]
    );
    return result.insertId;
  },
};

module.exports = ReportingModel;
