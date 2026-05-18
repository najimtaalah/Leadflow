'use strict';

const db             = require('../config/database');
const JournalDossier = require('./JournalDossier');

// Transitions autorisées : statut_actuel → [statuts_possibles]
const TRANSITIONS = {
  a_facturer: ['facture', 'annule'],
  facture:    ['paye', 'litige', 'annule'],
  litige:     ['facture', 'paye', 'rembourse', 'annule'],
  paye:       ['rembourse', 'annule'],
  rembourse:  [],
  annule:     [],
};

// Rôles pouvant effectuer chaque type de transition
const ROLES_TRANSITION = {
  'a_facturer->facture':   ['super_admin', 'role_admin', 'gestionnaire'],
  'facture->paye':         ['super_admin', 'role_admin'],
  'facture->litige':       ['super_admin', 'role_admin'],
  'litige->facture':       ['super_admin', 'role_admin'],
  'litige->paye':          ['super_admin', 'role_admin'],
  'litige->rembourse':     ['super_admin', 'role_admin'],
  'paye->rembourse':       ['super_admin', 'role_admin'],
  '*->annule':             ['super_admin', 'role_admin'],
};

// Documents requis par type de financement pour le statut "facturé"
const DOCS_REQUIS = {
  CPF:           ['contrat_edof', 'facture_edof'],
  FRANCE_TRAVAIL:['attestation_prise_en_charge_ft'],
  OPCO:          ['accord_financement_opco', 'facture_opco'],
  PERSONNEL:     ['contrat_formation', 'facture'],
};

const FinancementModel = {

  /** Récupère le financement d'un dossier (null si non créé) */
  async findByDossier(dossierId) {
    const [[row]] = await db.query(
      `SELECT f.*,
              CONCAT(vc.prenom,' ',vc.nom) AS validated_by_nom,
              CONCAT(cc.prenom,' ',cc.nom) AS created_by_nom
       FROM financements f
       LEFT JOIN users vc ON vc.id = f.validated_by
       LEFT JOIN users cc ON cc.id = f.created_by
       WHERE f.dossier_id = ?`,
      [dossierId]
    );
    return row || null;
  },

  /** Crée le financement d'un dossier */
  async create({
    dossier_id, type_financement, identifiant_financeur, nom_organisme,
    date_accord, notes_financeur, montant_total, montant_pris_en_charge,
    notes_comptables, created_by,
  }) {
    this._validateIdentifiant(type_financement, identifiant_financeur, nom_organisme);
    this._validateMontants(montant_total, montant_pris_en_charge);

    const [result] = await db.query(
      `INSERT INTO financements
         (dossier_id, type_financement, identifiant_financeur, nom_organisme,
          date_accord, notes_financeur, montant_total, montant_pris_en_charge,
          notes_comptables, created_by, updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        dossier_id, type_financement,
        identifiant_financeur || null,
        nom_organisme         || null,
        date_accord           || null,
        notes_financeur       || null,
        parseFloat(montant_total),
        parseFloat(montant_pris_en_charge || 0),
        notes_comptables      || null,
        created_by, created_by,
      ]
    );

    await JournalDossier.create({
      dossier_id,
      action:      'financement_cree',
      champ:       'type_financement',
      valeur_avant: null,
      valeur_apres: `type=${type_financement}, montant=${montant_total}€`,
      user_id:     created_by,
    });

    return result.insertId;
  },

  /** Met à jour les champs du financement (avant validation) */
  async update(dossierId, fields, userId) {
    const current = await this.findByDossier(dossierId);
    if (!current) throw Object.assign(new Error('Financement introuvable'), { code: 'NOT_FOUND' });

    const {
      type_financement, identifiant_financeur, nom_organisme,
      date_accord, notes_financeur, montant_total, montant_pris_en_charge,
      notes_comptables,
    } = fields;

    const newType    = type_financement    ?? current.type_financement;
    const newIdent   = identifiant_financeur !== undefined ? identifiant_financeur : current.identifiant_financeur;
    const newOrg     = nom_organisme         !== undefined ? nom_organisme         : current.nom_organisme;
    const newTotal   = montant_total         !== undefined ? parseFloat(montant_total) : current.montant_total;
    const newPEC     = montant_pris_en_charge !== undefined ? parseFloat(montant_pris_en_charge) : current.montant_pris_en_charge;

    this._validateIdentifiant(newType, newIdent, newOrg);
    this._validateMontants(newTotal, newPEC);

    await db.query(
      `UPDATE financements
       SET type_financement=?, identifiant_financeur=?, nom_organisme=?,
           date_accord=?, notes_financeur=?, montant_total=?, montant_pris_en_charge=?,
           notes_comptables=?, updated_by=?
       WHERE dossier_id=?`,
      [
        newType, newIdent || null, newOrg || null,
        date_accord ?? current.date_accord,
        notes_financeur ?? current.notes_financeur,
        newTotal, newPEC,
        notes_comptables ?? current.notes_comptables,
        userId, dossierId,
      ]
    );

    // Journal : enregistre les champs modifiés
    const before = {
      type_financement: current.type_financement,
      identifiant_financeur: current.identifiant_financeur,
      montant_total: String(current.montant_total),
      montant_pris_en_charge: String(current.montant_pris_en_charge),
    };
    const after = {
      type_financement: newType,
      identifiant_financeur: newIdent,
      montant_total: String(newTotal),
      montant_pris_en_charge: String(newPEC),
    };
    await JournalDossier.createChanges(dossierId, before, after, userId);
  },

  /** Validation du bloc financier par Admin/Super Admin — initialise statut à "a_facturer" */
  async validerBloc(dossierId, userId) {
    const current = await this.findByDossier(dossierId);
    if (!current) throw Object.assign(new Error('Financement introuvable'), { code: 'NOT_FOUND' });
    if (current.validated_at)
      throw Object.assign(new Error('Bloc déjà validé'), { code: 'ALREADY_VALIDATED' });

    this._validateIdentifiant(
      current.type_financement,
      current.identifiant_financeur,
      current.nom_organisme,
      { strict: true }
    );

    await db.query(
      `UPDATE financements
       SET statut_facturation='a_facturer', validated_at=NOW(), validated_by=?, updated_by=?
       WHERE dossier_id=?`,
      [userId, userId, dossierId]
    );

    await JournalDossier.create({
      dossier_id: dossierId,
      action:     'financement_valide',
      champ:      'statut_facturation',
      valeur_avant: null,
      valeur_apres: 'a_facturer',
      user_id:    userId,
    });
  },

  /** Changement de statut de facturation avec contrôle des transitions */
  async changerStatut(dossierId, { nouveau_statut, date_effective, commentaire, montant_avoir, motif_avoir }, userId, roleUser) {
    const current = await this.findByDossier(dossierId);
    if (!current) throw Object.assign(new Error('Financement introuvable'), { code: 'NOT_FOUND' });
    if (!current.statut_facturation)
      throw Object.assign(new Error('Bloc financier non validé'), { code: 'NOT_VALIDATED' });

    const statut_actuel = current.statut_facturation;
    const transitionsOk = TRANSITIONS[statut_actuel] || [];
    if (!transitionsOk.includes(nouveau_statut))
      throw Object.assign(
        new Error(`Transition ${statut_actuel} → ${nouveau_statut} non autorisée`),
        { code: 'INVALID_TRANSITION' }
      );

    const roleKey   = `${statut_actuel}->${nouveau_statut}`;
    const rolesOk   = ROLES_TRANSITION[roleKey] || ROLES_TRANSITION['*->annule'] || [];
    const rolesAnnul = ROLES_TRANSITION['*->annule'] || [];
    const allowed   = nouveau_statut === 'annule' ? rolesAnnul : rolesOk;
    if (!allowed.includes(roleUser))
      throw Object.assign(new Error('Rôle insuffisant pour cette transition'), { code: 'FORBIDDEN' });

    // Règle RM-L7-07 : avoir obligatoire si remboursé
    if (nouveau_statut === 'rembourse') {
      if (!montant_avoir || parseFloat(montant_avoir) <= 0)
        throw Object.assign(new Error('montant_avoir requis (> 0) pour remboursement'), { code: 'VALIDATION_ERROR' });
      if (parseFloat(montant_avoir) > parseFloat(current.montant_total))
        throw Object.assign(new Error('montant_avoir ne peut pas dépasser montant_total'), { code: 'VALIDATION_ERROR' });
      if (!motif_avoir || !motif_avoir.trim())
        throw Object.assign(new Error('motif_avoir requis pour remboursement'), { code: 'VALIDATION_ERROR' });
    }

    const updates = {
      statut_facturation: nouveau_statut,
      updated_by:         userId,
    };
    if (nouveau_statut === 'facture'   && date_effective) updates.date_facturation = date_effective;
    if (nouveau_statut === 'paye'      && date_effective) updates.date_paiement    = date_effective;
    if (nouveau_statut === 'rembourse') {
      updates.montant_avoir = parseFloat(montant_avoir);
      updates.motif_avoir   = motif_avoir;
    }

    const setClauses = Object.keys(updates).map(k => `${k}=?`).join(', ');
    await db.query(
      `UPDATE financements SET ${setClauses} WHERE dossier_id=?`,
      [...Object.values(updates), dossierId]
    );

    const msgAudit = nouveau_statut === 'rembourse'
      ? `Statut facturation : ${statut_actuel} → ${nouveau_statut} — avoir ${montant_avoir}€ — motif : ${motif_avoir}`
      : `Statut facturation : ${statut_actuel} → ${nouveau_statut}`;

    await JournalDossier.create({
      dossier_id:  dossierId,
      action:      'statut_facturation_change',
      champ:       'statut_facturation',
      valeur_avant: statut_actuel,
      valeur_apres: nouveau_statut,
      user_id:     userId,
    });

    return { statut_avant: statut_actuel, statut_apres: nouveau_statut };
  },

  /** Liste dossiers pour module /facturation avec filtres */
  async listFacturation({ statuts, type_financement, date_facturation_debut, date_facturation_fin,
    date_paiement_debut, date_paiement_fin, formation_id, commercial_id,
    montant_min, montant_max, limit = 50, offset = 0 } = {}) {

    let where = 'WHERE 1=1';
    const params = [];

    if (statuts?.length)          { where += ` AND f.statut_facturation IN (${statuts.map(() => '?').join(',')})`;  params.push(...statuts); }
    if (type_financement?.length) { where += ` AND f.type_financement IN (${type_financement.map(() => '?').join(',')})`;  params.push(...type_financement); }
    if (date_facturation_debut)   { where += ' AND f.date_facturation >= ?'; params.push(date_facturation_debut); }
    if (date_facturation_fin)     { where += ' AND f.date_facturation <= ?'; params.push(date_facturation_fin); }
    if (date_paiement_debut)      { where += ' AND f.date_paiement >= ?';    params.push(date_paiement_debut); }
    if (date_paiement_fin)        { where += ' AND f.date_paiement <= ?';    params.push(date_paiement_fin); }
    if (commercial_id)            { where += ' AND d.vendeur_id = ?';        params.push(commercial_id); }
    if (montant_min != null)      { where += ' AND f.montant_total >= ?';    params.push(montant_min); }
    if (montant_max != null)      { where += ' AND f.montant_total <= ?';    params.push(montant_max); }

    const [rows] = await db.query(
      `SELECT
         d.id AS dossier_id, d.reference, d.nom, d.prenom, d.formation_souhaitee,
         f.type_financement, f.nom_organisme, f.identifiant_financeur,
         f.montant_total, f.montant_pris_en_charge, f.reste_a_charge,
         f.statut_facturation, f.date_facturation, f.date_paiement, f.reference_facture,
         CONCAT(u.prenom,' ',u.nom) AS commercial_nom
       FROM financements f
       INNER JOIN dossiers d ON d.id = f.dossier_id
       LEFT JOIN users u ON u.id = d.vendeur_id
       ${where}
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM financements f INNER JOIN dossiers d ON d.id = f.dossier_id ${where}`,
      params
    );

    return { financements: rows, total };
  },

  /** Export CSV dossiers facturables */
  async exportDossiersFacturables({ statuts, type_financement, date_facturation_debut, date_facturation_fin } = {}) {
    const statuts_def = statuts?.length ? statuts : ['a_facturer', 'facture'];
    let where = `WHERE f.statut_facturation IN (${statuts_def.map(() => '?').join(',')})`;
    const params = [...statuts_def];

    if (type_financement?.length) { where += ` AND f.type_financement IN (${type_financement.map(() => '?').join(',')})`;  params.push(...type_financement); }
    if (date_facturation_debut)   { where += ' AND f.date_facturation >= ?'; params.push(date_facturation_debut); }
    if (date_facturation_fin)     { where += ' AND f.date_facturation <= ?'; params.push(date_facturation_fin); }

    const [rows] = await db.query(
      `SELECT
         d.reference AS identifiant_dossier,
         CONCAT(d.prenom,' ',d.nom) AS nom_apprenant,
         d.formation_souhaitee AS formation,
         f.type_financement, f.nom_organisme AS organisme,
         f.identifiant_financeur,
         f.montant_total, f.montant_pris_en_charge, f.reste_a_charge,
         f.statut_facturation, f.date_facturation, f.date_paiement,
         f.reference_facture,
         CONCAT(u.prenom,' ',u.nom) AS commercial
       FROM financements f
       INNER JOIN dossiers d ON d.id = f.dossier_id
       LEFT JOIN users u ON u.id = d.vendeur_id
       ${where}
       ORDER BY f.date_facturation DESC, d.reference`,
      params
    );
    return rows;
  },

  /** Export rapport mensuel — agrégat par type de financement */
  async exportRapportMensuel(mois, annee) {
    const dateDebut = `${annee}-${String(mois).padStart(2,'0')}-01`;
    const dateFin   = new Date(annee, mois, 0).toISOString().split('T')[0]; // dernier jour du mois

    const [rows] = await db.query(
      `SELECT
         f.type_financement,
         COUNT(f.id)                                               AS nb_dossiers,
         COALESCE(SUM(f.montant_total),0)                         AS montant_total,
         COALESCE(SUM(f.montant_pris_en_charge),0)                AS montant_pris_en_charge,
         COALESCE(SUM(f.reste_a_charge),0)                        AS reste_a_charge_total,
         SUM(f.statut_facturation='paye')                         AS nb_payes,
         SUM(f.statut_facturation='facture')                      AS nb_factures_non_payes,
         SUM(f.statut_facturation='litige')                       AS nb_litiges,
         COALESCE(SUM(CASE WHEN f.statut_facturation='rembourse' THEN f.montant_avoir ELSE 0 END),0) AS montant_avoirs
       FROM financements f
       WHERE f.date_facturation BETWEEN ? AND ?
         AND f.statut_facturation IS NOT NULL
       GROUP BY f.type_financement
       ORDER BY f.type_financement`,
      [dateDebut, dateFin]
    );
    return rows;
  },

  /** Constantes exportées pour usage dans les controllers */
  TRANSITIONS,
  DOCS_REQUIS,

  // ── Validations internes ──────────────────────────────────────────────────

  _validateIdentifiant(type, identifiant, nom_organisme, { strict = false } = {}) {
    if (type === 'PERSONNEL') return;
    if (strict && (!identifiant || !identifiant.trim())) {
      throw Object.assign(
        new Error(`identifiant_financeur obligatoire pour le type ${type}`),
        { code: 'VALIDATION_ERROR' }
      );
    }
    if (identifiant && type === 'CPF') {
      if (!/^[A-Z0-9-]{6,50}$/i.test(identifiant))
        throw Object.assign(
          new Error('Identifiant EDOF : 6–50 caractères alphanumériques (tirets autorisés)'),
          { code: 'VALIDATION_ERROR' }
        );
    }
    if (identifiant && identifiant.length > 50)
      throw Object.assign(new Error('identifiant_financeur max 50 caractères'), { code: 'VALIDATION_ERROR' });
    if (type === 'OPCO' && strict && (!nom_organisme || !nom_organisme.trim()))
      throw Object.assign(new Error('nom_organisme obligatoire pour le type OPCO'), { code: 'VALIDATION_ERROR' });
  },

  _validateMontants(total, pec) {
    const t = parseFloat(total);
    const p = parseFloat(pec || 0);
    if (isNaN(t) || t <= 0)
      throw Object.assign(new Error('montant_total doit être > 0'), { code: 'VALIDATION_ERROR' });
    if (isNaN(p) || p < 0)
      throw Object.assign(new Error('montant_pris_en_charge doit être >= 0'), { code: 'VALIDATION_ERROR' });
    if (p > t)
      throw Object.assign(new Error('montant_pris_en_charge ne peut pas dépasser montant_total'), { code: 'VALIDATION_ERROR' });
  },
};

module.exports = FinancementModel;
