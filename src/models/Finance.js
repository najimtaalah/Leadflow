'use strict';

const db = require('../config/database');

const FinanceModel = {

  // ══════════════════════════════════════════════════════════════
  // ENCAISSEMENTS
  // ══════════════════════════════════════════════════════════════

  /**
   * Liste des encaissements avec filtres
   * UC-28 / UC-29 — Suivi des paiements
   */
  async findEncaissements({
    dossier_id, agence_id, statut_paiement,
    date_debut, date_fin, limit = 50, offset = 0
  } = {}) {
    let sql = `
      SELECT
        e.id, e.dossier_id, e.montant, e.date_encaissement,
        e.mode_paiement, e.notes, e.created_at,
        d.nom, d.prenom, d.reference, d.formation_souhaitee,
        d.agence_id,
        CONCAT(u.prenom,' ',u.nom) AS saisi_par,
        a.nom AS agence_nom,
        -- Calcul statut paiement
        GREATEST(
          COALESCE(d.cout_total_formation, d.fp_manuel, 0)
          - COALESCE(d.part_financeur, 0), 0
        ) AS financement_personnel,
        COALESCE(enc_total.total, 0) AS total_encaisse
      FROM encaissements e
      JOIN dossiers d ON d.id = e.dossier_id
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN agences a ON a.id = d.agence_id
      LEFT JOIN (
        SELECT dossier_id, SUM(montant) AS total
        FROM encaissements GROUP BY dossier_id
      ) enc_total ON enc_total.dossier_id = d.id
      WHERE 1=1`;
    const params = [];

    if (dossier_id)  { sql += ' AND e.dossier_id = ?';        params.push(dossier_id); }
    if (agence_id)   { sql += ' AND d.agence_id = ?';         params.push(agence_id); }
    if (date_debut)  { sql += ' AND e.date_encaissement >= ?'; params.push(date_debut); }
    if (date_fin)    { sql += ' AND e.date_encaissement <= ?'; params.push(date_fin); }

    sql += ' ORDER BY e.date_encaissement DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);

    // Calculer le statut de paiement pour chaque ligne
    return rows.map(r => ({
      ...r,
      statut_paiement: FinanceModel.calcStatutPaiement(
        r.financement_personnel, r.total_encaisse
      ),
    }));
  },

  /**
   * KPIs financiers globaux — UC-28
   */
  async getKpisFinanciers(agenceId = null) {
    let where = 'WHERE d.archived = 0';
    const params = [];
    if (agenceId) { where += ' AND d.agence_id = ?'; params.push(agenceId); }

    const [[kpis]] = await db.query(`
      SELECT
        COALESCE(SUM(enc.total_encaisse), 0)         AS total_encaisse,
        COALESCE(SUM(fp.financement_personnel), 0)    AS total_a_encaisser,
        COALESCE(SUM(GREATEST(
          fp.financement_personnel - COALESCE(enc.total_encaisse, 0), 0
        )), 0)                                        AS reste_a_encaisser,
        SUM(CASE
          WHEN COALESCE(enc.total_encaisse,0) = 0
           AND fp.financement_personnel > 0 THEN 1 ELSE 0
        END)                                          AS nb_neant,
        SUM(CASE
          WHEN COALESCE(enc.total_encaisse,0) > 0
           AND COALESCE(enc.total_encaisse,0) < fp.financement_personnel THEN 1 ELSE 0
        END)                                          AS nb_partiel,
        SUM(CASE
          WHEN COALESCE(enc.total_encaisse,0) >= fp.financement_personnel
           AND fp.financement_personnel > 0 THEN 1 ELSE 0
        END)                                          AS nb_effectue
      FROM dossiers d
      CROSS JOIN LATERAL (
        SELECT GREATEST(
          COALESCE(d.cout_total_formation, d.fp_manuel, 0)
          - COALESCE(d.part_financeur, 0), 0
        ) AS financement_personnel
      ) fp
      LEFT JOIN (
        SELECT dossier_id, SUM(montant) AS total_encaisse
        FROM encaissements GROUP BY dossier_id
      ) enc ON enc.dossier_id = d.id
      ${where}`,
      params
    );
    return kpis;
  },

  /**
   * Liste des dossiers en retard de paiement > N heures — UC-27
   */
  async getDossiersEnRetard(heures = 24, agenceId = null) {
    let sql = `
      SELECT
        d.id, d.reference, d.nom, d.prenom, d.telephone, d.email,
        d.agence_id, a.nom AS agence_nom,
        GREATEST(
          COALESCE(d.cout_total_formation, d.fp_manuel, 0)
          - COALESCE(d.part_financeur, 0), 0
        ) AS financement_personnel,
        COALESCE(enc_t.total, 0) AS total_encaisse,
        GREATEST(
          COALESCE(d.cout_total_formation, d.fp_manuel, 0)
          - COALESCE(d.part_financeur, 0)
          - COALESCE(enc_t.total, 0), 0
        ) AS reste_a_payer,
        MIN(ec.date_echeance) AS prochaine_echeance
      FROM dossiers d
      LEFT JOIN agences a ON a.id = d.agence_id
      LEFT JOIN (
        SELECT dossier_id, SUM(montant) AS total
        FROM encaissements GROUP BY dossier_id
      ) enc_t ON enc_t.dossier_id = d.id
      LEFT JOIN echeances ec ON ec.dossier_id = d.id
        AND ec.statut = 'en_attente'
        AND ec.date_echeance < DATE_SUB(NOW(), INTERVAL ? HOUR)
      WHERE d.archived = 0
        AND GREATEST(
          COALESCE(d.cout_total_formation, d.fp_manuel, 0)
          - COALESCE(d.part_financeur, 0)
          - COALESCE(enc_t.total, 0), 0
        ) > 0
        AND ec.id IS NOT NULL`;
    const params = [heures];

    if (agenceId) { sql += ' AND d.agence_id = ?'; params.push(agenceId); }
    sql += ' GROUP BY d.id ORDER BY prochaine_echeance ASC';

    const [rows] = await db.query(sql, params);
    return rows;
  },

  // ══════════════════════════════════════════════════════════════
  // ÉCHÉANCES / PLAN FINANCIER
  // ══════════════════════════════════════════════════════════════

  /**
   * Récupère le plan financier (échéances) d'un dossier — UC-26
   */
  async getPlanFinancier(dossierId) {
    const [rows] = await db.query(
      `SELECT e.*, d.reference
       FROM echeances e
       JOIN dossiers d ON d.id = e.dossier_id
       WHERE e.dossier_id = ?
       ORDER BY e.date_echeance ASC`,
      [dossierId]
    );
    return rows;
  },

  /**
   * Supprime les échéances existantes d'un dossier
   * (avant de recréer un nouveau plan)
   */
  async deleteEcheances(dossierId) {
    await db.query(
      "DELETE FROM echeances WHERE dossier_id = ? AND statut = 'en_attente'",
      [dossierId]
    );
  },

  /**
   * Crée un plan par mensualités fixes — UC-26
   */
  async createPlanMensualites(dossierId, montantTotal, nbMensualites, dateDebut, prelev = false) {
    await FinanceModel.deleteEcheances(dossierId);

    // Arrondi à 2 décimales — la dernière mensualité absorbe le reste
    const montantParMois = Math.floor((montantTotal / nbMensualites) * 100) / 100;
    const reste          = Math.round((montantTotal - montantParMois * (nbMensualites - 1)) * 100) / 100;

    const date = new Date(dateDebut);
    const inserts = [];

    for (let i = 0; i < nbMensualites; i++) {
      const montant = (i === nbMensualites - 1) ? reste : montantParMois;
      inserts.push([
        dossierId,
        montant,
        date.toISOString().split('T')[0],
        'en_attente',
        prelev ? 1 : 0,
        new Date(),
      ]);
      date.setMonth(date.getMonth() + 1);
    }

    await db.query(
      `INSERT INTO echeances (dossier_id, montant, date_echeance, statut, prelevement_auto, created_at)
       VALUES ?`,
      [inserts]
    );

    return inserts.length;
  },

  /**
   * Crée un plan à dates libres — UC-26
   */
  async createPlanDatesLibres(dossierId, echeances, prelev = false) {
    await FinanceModel.deleteEcheances(dossierId);

    const rows = echeances.map(e => [
      dossierId,
      parseFloat(e.montant),
      e.date_echeance,
      'en_attente',
      prelev ? 1 : 0,
      new Date(),
    ]);

    await db.query(
      `INSERT INTO echeances (dossier_id, montant, date_echeance, statut, prelevement_auto, created_at)
       VALUES ?`,
      [rows]
    );

    return rows.length;
  },

  /**
   * Met à jour le statut d'une échéance (payée / en_attente)
   */
  async updateEcheanceStatut(id, statut) {
    await db.query(
      "UPDATE echeances SET statut = ?, updated_at = NOW() WHERE id = ?",
      [statut, id]
    );
  },

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════

  /**
   * Calcule le statut de paiement d'un dossier — UC-25
   * effectue | partiel | neant | non_concerne
   */
  calcStatutPaiement(financement_personnel, total_encaisse) {
    const fp  = parseFloat(financement_personnel) || 0;
    const enc = parseFloat(total_encaisse)        || 0;
    if (fp <= 0)      return 'non_concerne';
    if (enc <= 0)     return 'neant';
    if (enc >= fp)    return 'effectue';
    return 'partiel';
  },

  /**
   * Résumé financier complet d'un dossier
   */
  async getResumeDossier(dossierId) {
    const [[row]] = await db.query(`
      SELECT
        d.id, d.reference, d.nom, d.prenom,
        COALESCE(d.cout_total_formation, d.fp_manuel, 0)  AS cout_total,
        COALESCE(d.part_financeur, 0)                      AS part_financeur,
        GREATEST(
          COALESCE(d.cout_total_formation, d.fp_manuel, 0)
          - COALESCE(d.part_financeur, 0), 0
        )                                                   AS financement_personnel,
        COALESCE(enc.total, 0)                             AS total_encaisse,
        GREATEST(
          GREATEST(
            COALESCE(d.cout_total_formation, d.fp_manuel, 0)
            - COALESCE(d.part_financeur, 0), 0
          ) - COALESCE(enc.total, 0), 0
        )                                                   AS reste_a_payer
      FROM dossiers d
      LEFT JOIN (
        SELECT dossier_id, SUM(montant) AS total
        FROM encaissements GROUP BY dossier_id
      ) enc ON enc.dossier_id = d.id
      WHERE d.id = ?`,
      [dossierId]
    );
    if (!row) return null;

    row.statut_paiement = FinanceModel.calcStatutPaiement(
      row.financement_personnel, row.total_encaisse
    );
    row.trop_percu = row.total_encaisse > row.financement_personnel
      ? row.total_encaisse - row.financement_personnel
      : 0;

    return row;
  },

  /**
   * Situation financière globale — UC-30
   */
  async getSituationGlobale(agenceId = null, mois = null) {
    let where = 'WHERE d.archived = 0';
    const params = [];

    if (agenceId) { where += ' AND d.agence_id = ?'; params.push(agenceId); }

    if (mois) {
      // Format : YYYY-MM
      where += ' AND DATE_FORMAT(e.date_encaissement, \'%Y-%m\') = ?';
      params.push(mois);
    }

    const [[situation]] = await db.query(`
      SELECT
        COUNT(DISTINCT d.id)                               AS nb_dossiers,
        COALESCE(SUM(e.montant), 0)                        AS total_encaisse,
        COALESCE(SUM(fp.fp), 0)                            AS total_fp,
        COALESCE(SUM(GREATEST(fp.fp - COALESCE(enc_t.total,0), 0)), 0) AS reste_total,
        -- Par statut
        SUM(CASE WHEN COALESCE(enc_t.total,0) >= fp.fp AND fp.fp > 0 THEN 1 ELSE 0 END) AS nb_effectue,
        SUM(CASE WHEN COALESCE(enc_t.total,0) > 0
                  AND COALESCE(enc_t.total,0) < fp.fp THEN 1 ELSE 0 END) AS nb_partiel,
        SUM(CASE WHEN COALESCE(enc_t.total,0) = 0
                  AND fp.fp > 0 THEN 1 ELSE 0 END)                       AS nb_neant
      FROM dossiers d
      CROSS JOIN LATERAL (
        SELECT GREATEST(
          COALESCE(d.cout_total_formation, d.fp_manuel, 0)
          - COALESCE(d.part_financeur, 0), 0
        ) AS fp
      ) fp
      LEFT JOIN encaissements e ON e.dossier_id = d.id
      LEFT JOIN (
        SELECT dossier_id, SUM(montant) AS total
        FROM encaissements GROUP BY dossier_id
      ) enc_t ON enc_t.dossier_id = d.id
      ${where}`,
      params
    );
    return situation;
  },

  /**
   * Liste des dossiers avec leur résumé financier (vue suivi par dossier)
   */
  async getDossiersSuivi(agenceId = null) {
    let where = 'WHERE d.archived = 0';
    const params = [];
    if (agenceId) { where += ' AND d.agence_id = ?'; params.push(agenceId); }

    const [rows] = await db.query(`
      SELECT
        d.id, d.reference, d.nom, d.prenom, d.email, d.telephone,
        d.formation_souhaitee, d.agence_id,
        a.nom AS agence_nom,
        COALESCE(d.cout_total_formation, d.fp_manuel, 0) AS cout_total,
        COALESCE(d.part_financeur, 0) AS part_financeur,
        GREATEST(
          COALESCE(d.cout_total_formation, d.fp_manuel, 0)
          - COALESCE(d.part_financeur, 0), 0
        ) AS financement_personnel,
        COALESCE(enc.total, 0) AS total_encaisse,
        GREATEST(
          GREATEST(
            COALESCE(d.cout_total_formation, d.fp_manuel, 0)
            - COALESCE(d.part_financeur, 0), 0
          ) - COALESCE(enc.total, 0), 0
        ) AS reste_a_payer
      FROM dossiers d
      LEFT JOIN agences a ON a.id = d.agence_id
      LEFT JOIN (
        SELECT dossier_id, SUM(montant) AS total
        FROM encaissements GROUP BY dossier_id
      ) enc ON enc.dossier_id = d.id
      ${where}
      HAVING financement_personnel > 0
      ORDER BY reste_a_payer DESC, d.nom ASC`,
      params
    );

    return rows.map(r => ({
      ...r,
      statut_paiement: FinanceModel.calcStatutPaiement(r.financement_personnel, r.total_encaisse),
      trop_percu: r.total_encaisse > r.financement_personnel
        ? r.total_encaisse - r.financement_personnel : 0,
    }));
  },

  /**
   * Historique mensuel des encaissements (graphique) — UC-42
   */
  async getHistoriqueMensuel(mois = 6, agenceId = null) {
    let where = 'WHERE d.archived = 0';
    const params = [mois];
    if (agenceId) { where += ' AND d.agence_id = ?'; params.push(agenceId); }

    const [rows] = await db.query(`
      SELECT
        DATE_FORMAT(e.date_encaissement, '%Y-%m') AS mois,
        SUM(e.montant)                             AS total,
        COUNT(*)                                   AS nb_encaissements
      FROM encaissements e
      JOIN dossiers d ON d.id = e.dossier_id
      ${where}
        AND e.date_encaissement >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      GROUP BY DATE_FORMAT(e.date_encaissement, '%Y-%m')
      ORDER BY mois ASC`,
      params
    );
    return rows;
  },
};

module.exports = FinanceModel;
