'use strict';

const db = require('../config/database');
const JournalDossier = require('./JournalDossier');

const DossierModel = {

  /**
   * Liste des dossiers avec filtres et calculs financiers intégrés
   * UC-17 : filtre automatique selon le rôle
   */
  async findAll({
    vendeur_id, agence_id, statut_id, archived = 0,
    frais_cma_paye, search, limit = 50, offset = 0,
  } = {}) {
    const joins = `
      FROM dossiers d
      LEFT JOIN statuts_dossier sd ON sd.id = d.statut_id
      LEFT JOIN users u             ON u.id  = d.vendeur_id
      LEFT JOIN agences a           ON a.id  = d.agence_id
      LEFT JOIN (
        SELECT dossier_id, SUM(montant) AS total_encaisse
        FROM encaissements GROUP BY dossier_id
      ) enc ON enc.dossier_id = d.id
      WHERE d.archived = ?`;

    let where = '';
    const filterParams = [archived ? 1 : 0];

    if (vendeur_id !== undefined)     { where += ' AND d.vendeur_id = ?';      filterParams.push(vendeur_id); }
    if (agence_id !== undefined)      { where += ' AND d.agence_id = ?';       filterParams.push(agence_id); }
    if (statut_id !== undefined)      { where += ' AND d.statut_id = ?';       filterParams.push(statut_id); }
    if (frais_cma_paye !== undefined) { where += ' AND d.frais_cma_paye = ?';  filterParams.push(frais_cma_paye ? 1 : 0); }
    if (search) {
      where += ' AND (d.nom LIKE ? OR d.prenom LIKE ? OR d.reference LIKE ? OR d.telephone LIKE ?)';
      const s = `%${search}%`;
      filterParams.push(s, s, s, s);
    }

    const [rows] = await db.query(`
      SELECT
        d.id, d.reference, d.nom, d.prenom, d.telephone, d.email,
        d.formation_souhaitee, d.frais_cma, d.frais_cma_paye,
        d.archived, d.created_at, d.updated_at,
        d.cout_total_formation, d.part_financeur, d.fp_manuel,
        sd.nom  AS statut_nom,
        CONCAT(u.prenom,' ',u.nom) AS vendeur_nom, d.vendeur_id,
        a.nom   AS agence_nom, d.agence_id,
        GREATEST(
          COALESCE(d.cout_total_formation, d.fp_manuel, 0)
          - COALESCE(d.part_financeur, 0), 0
        ) AS financement_personnel,
        COALESCE(enc.total_encaisse, 0) AS total_encaisse,
        GREATEST(
          GREATEST(
            COALESCE(d.cout_total_formation, d.fp_manuel, 0)
            - COALESCE(d.part_financeur, 0), 0
          ) - COALESCE(enc.total_encaisse, 0), 0
        ) AS reste_a_payer
      ${joins}${where}
      ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
      [...filterParams, parseInt(limit), parseInt(offset)]
    );

    const [[total]] = await db.query(
      `SELECT COUNT(*) AS total ${joins}${where}`,
      filterParams
    );

    return { dossiers: rows, total: total.total };
  },

  /** Détail complet d'un dossier avec calculs financiers */
  async findById(id) {
    const [[dossier]] = await db.query(
      `SELECT
         d.*,
         sd.nom AS statut_nom,
         CONCAT(u.prenom,' ',u.nom) AS vendeur_nom,
         a.nom  AS agence_nom,
         sc.code_session AS session_cours_code, sc.date_debut AS session_cours_debut,
         se.code_session AS session_edof_code,  se.date_debut AS session_edof_debut,
         ex.code_session AS examen_code,        ex.date_debut AS examen_debut,
         GREATEST(
           COALESCE(d.cout_total_formation, d.fp_manuel, 0)
           - COALESCE(d.part_financeur, 0), 0
         ) AS financement_personnel,
         COALESCE(enc.total_encaisse, 0) AS total_encaisse,
         GREATEST(
           GREATEST(
             COALESCE(d.cout_total_formation, d.fp_manuel, 0)
             - COALESCE(d.part_financeur, 0), 0
           ) - COALESCE(enc.total_encaisse, 0), 0
         ) AS reste_a_payer
       FROM dossiers d
       LEFT JOIN statuts_dossier sd ON sd.id = d.statut_id
       LEFT JOIN users u             ON u.id  = d.vendeur_id
       LEFT JOIN agences a           ON a.id  = d.agence_id
       LEFT JOIN sessions_formation sc ON sc.id = d.session_cours_id
       LEFT JOIN sessions_formation se ON se.id = d.session_edof_id
       LEFT JOIN sessions_formation ex ON ex.id = d.examen_id
       LEFT JOIN (
         SELECT dossier_id, SUM(montant) AS total_encaisse
         FROM encaissements GROUP BY dossier_id
       ) enc ON enc.dossier_id = d.id
       WHERE d.id = ?`,
      [id]
    );
    return dossier || null;
  },

  /** Génère un numéro de dossier unique : DOS-YYYY-NNNN */
  async generateReference() {
    const year   = new Date().getFullYear();
    const prefix = `DOS-${year}-`;
    const [[row]] = await db.query(
      `SELECT MAX(CAST(SUBSTRING(reference, ?) AS UNSIGNED)) AS last_num
       FROM dossiers WHERE reference LIKE ?`,
      [prefix.length + 1, `${prefix}%`]
    );
    const next = (row.last_num || 0) + 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  },

  /** Crée un dossier avec numéro automatique */
  async create({ lead_id, apprenant_id, nom, prenom, telephone, email,
                 formation_souhaitee, agence_id, vendeur_id, statut_id,
                 session_cours_id, session_edof_id, examen_id,
                 cout_total_formation, part_financeur,
                 type_financement, reference_financeur, numero_cma,
                 reference }) {
    const ref = reference || await this.generateReference();
    const id_lead_origine = lead_id || null;
    const [result] = await db.query(
      `INSERT INTO dossiers
         (reference, lead_id, apprenant_id, id_lead_origine,
          nom, prenom, telephone, email,
          formation_souhaitee, agence_id, vendeur_id, statut_id,
          session_cours_id, session_edof_id, examen_id,
          cout_total_formation, part_financeur,
          type_financement, reference_financeur, numero_cma,
          frais_cma_paye, archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW(), NOW())`,
      [ref, id_lead_origine, apprenant_id || null, id_lead_origine,
       nom, prenom || '', telephone,
       email || null, formation_souhaitee || null,
       agence_id || null, vendeur_id || null, statut_id || null,
       session_cours_id || null, session_edof_id || null, examen_id || null,
       cout_total_formation || null, part_financeur || null,
       type_financement || null, reference_financeur || null, numero_cma || null]
    );
    const dossierId = result.insertId;
    await JournalDossier.create({ dossier_id: dossierId, action: 'created' });
    return { id: dossierId, reference: ref };
  },

  /**
   * Met à jour un dossier.
   * Génère automatiquement les entrées de journal pour chaque champ modifié.
   */
  async update(id, fields, { user_id = null } = {}) {
    const allowed = [
      'nom', 'prenom', 'telephone', 'email', 'formation_souhaitee',
      'statut_id', 'agence_id', 'vendeur_id', 'archived',
      'cout_total_formation', 'part_financeur', 'fp_manuel',
      'frais_cma', 'frais_cma_paye',
      'session_cours_id', 'session_edof_id', 'examen_id',
      'apprenant_id', 'id_lead_origine', 'type_financement',
      'reference_financeur', 'numero_cma', 'numero_dossier_edof',
    ];
    const updates = []; const params = [];
    const accepted = {};
    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        updates.push(`${key} = ?`);
        params.push(val);
        accepted[key] = val;
      }
    }
    if (!updates.length) return false;

    const [[before]] = await db.query(
      `SELECT ${Object.keys(accepted).join(',')} FROM dossiers WHERE id = ?`,
      [id]
    );
    params.push(id);
    await db.query(
      `UPDATE dossiers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
    await JournalDossier.createChanges(id, before || {}, accepted, user_id);
    return true;
  },

  /** Vérifie si le dossier peut être validé — UC-15 */
  async canBeValidated(id) {
    const [[row]] = await db.query(
      'SELECT frais_cma_paye, frais_cma FROM dossiers WHERE id = ?',
      [id]
    );
    if (!row)              return { ok: false, reason: 'DOSSIER_NOT_FOUND' };
    if (!row.frais_cma_paye) return { ok: false, reason: 'CMA_NOT_PAID' };
    return { ok: true };
  },

  /** Vérifie si le dossier peut être archivé — UC-18 */
  async canBeArchived(id) {
    const [[row]] = await db.query(
      `SELECT d.archived,
              GREATEST(
                COALESCE(d.cout_total_formation, d.fp_manuel, 0)
                - COALESCE(d.part_financeur, 0), 0
              ) - COALESCE(enc.total_encaisse, 0) AS reste
       FROM dossiers d
       LEFT JOIN (
         SELECT dossier_id, SUM(montant) AS total_encaisse
         FROM encaissements GROUP BY dossier_id
       ) enc ON enc.dossier_id = d.id
       WHERE d.id = ?`,
      [id]
    );
    if (!row)         return { ok: false, reason: 'DOSSIER_NOT_FOUND' };
    if (row.archived) return { ok: false, reason: 'ALREADY_ARCHIVED' };
    if (row.reste > 0) return { ok: false, reason: 'SOLDE_NON_SOLDE' };
    return { ok: true };
  },

  /** Liste les encaissements d'un dossier */
  async getEncaissements(dossierId) {
    const [rows] = await db.query(
      `SELECT e.*, CONCAT(u.prenom,' ',u.nom) AS saisi_par
       FROM encaissements e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.dossier_id = ?
       ORDER BY e.date_encaissement DESC`,
      [dossierId]
    );
    return rows;
  },

  /** Ajoute un encaissement */
  async addEncaissement({ dossier_id, montant, date_encaissement, mode_paiement, user_id, notes }) {
    const [result] = await db.query(
      `INSERT INTO encaissements
         (dossier_id, montant, date_encaissement, mode_paiement, user_id, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [dossier_id, montant, date_encaissement, mode_paiement || 'virement', user_id, notes || null]
    );
    return result.insertId;
  },

  /** Calcule le statut de paiement d'un dossier */
  getStatutPaiement(financement_personnel, total_encaisse) {
    if (financement_personnel <= 0) return 'non_concerne';
    if (total_encaisse <= 0)        return 'neant';
    if (total_encaisse >= financement_personnel) return 'effectue';
    return 'partiel';
  },
};

module.exports = DossierModel;
