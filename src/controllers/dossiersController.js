'use strict';

const DossierModel  = require('../models/Dossier');
const LogModel      = require('../models/Log');
const TacheModel    = require('../models/Tache');
const ImportService = require('../services/importService');
const logger        = require('../utils/logger');
const db            = require('../config/database');

const MODES_IMPORT_VALIDES = ['remplacer', 'ajouter', 'mettre_a_jour', 'upsert'];

/** Filtre dossiers selon le rôle — miroir de buildRoleFilter leads */
function buildRoleFilter(user) {
  switch (user.role_nom) {
    case 'commercial':        return { vendeur_id: user.id };
    case 'manager':           return { agence_id: user.agence_id };
    case 'role_administratif':return { agence_id: user.agence_id };
    case 'agent_accueil':     return { agence_id: user.agence_id };
    default:                  return {}; // super_admin, role_admin : tout
  }
}

const DossiersController = {

  // ── UC-17 : Liste des dossiers ─────────────────────────────────────────────
  async list(req, res) {
    try {
      const roleFilter = buildRoleFilter(req.user);
      const { statut_id, frais_cma_paye, search, archived, limit, offset } = req.query;

      const result = await DossierModel.findAll({
        ...roleFilter,
        statut_id:    statut_id ? parseInt(statut_id) : undefined,
        frais_cma_paye: frais_cma_paye !== undefined ? frais_cma_paye === '1' : undefined,
        search,
        archived:     archived === '1',
        limit:        parseInt(limit,  10) || 50,
        offset:       parseInt(offset, 10) || 0,
      });

      return res.status(200).json({
        success: true,
        data:    result.dossiers,
        total:   result.total,
      });
    } catch (err) {
      logger.error('Erreur liste dossiers', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-17 : Détail d'un dossier ────────────────────────────────────────────
  async getOne(req, res) {
    try {
      const dossier = await DossierModel.findById(parseInt(req.params.id));
      if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });

      if (req.user.role_nom === 'commercial' && dossier.vendeur_id !== req.user.id) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Accès refusé.' });
      }

      const encaissements = await DossierModel.getEncaissements(dossier.id);
      const statut_paiement = DossierModel.getStatutPaiement(
        dossier.financement_personnel, dossier.total_encaisse
      );

      return res.status(200).json({
        success: true,
        data: { ...dossier, encaissements, statut_paiement },
      });
    } catch (err) {
      logger.error('Erreur getOne dossier', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-13 : Création manuelle d'un dossier ─────────────────────────────────
  async create(req, res) {
    const {
      nom, prenom, telephone, email, formation_souhaitee, agence_id, vendeur_id,
      session_cours_id, session_edof_id, examen_id,
      cout_total_formation, part_financeur,
    } = req.body;

    if (!nom?.trim() || !telephone?.trim()) {
      return res.status(400).json({
        success: false,
        code:    'VALIDATION_ERROR',
        message: 'Nom et téléphone sont requis.',
      });
    }

    try {
      const { statut } = req.body;
      let statut_id = null;
      if (statut) {
        const [[sd]] = await db.query('SELECT id FROM statuts_dossier WHERE nom = ? LIMIT 1', [statut]);
        statut_id = sd?.id || null;
      }
      if (!statut_id) {
        const [[sd]] = await db.query("SELECT id FROM statuts_dossier WHERE nom = 'Actif' LIMIT 1");
        statut_id = sd?.id || null;
      }

      const { id, reference } = await DossierModel.create({
        nom: nom.trim(), prenom: prenom?.trim() || '',
        telephone: telephone.trim(),
        email:     email?.toLowerCase().trim() || null,
        formation_souhaitee, agence_id,
        vendeur_id:       vendeur_id || req.user.id,
        statut_id,
        session_cours_id: session_cours_id || null,
        session_edof_id:  session_edof_id  || null,
        examen_id:        examen_id        || null,
        cout_total_formation: cout_total_formation || null,
        part_financeur:       part_financeur       || null,
      });

      await LogModel.create({
        action:  'dossier_created_manual',
        user_id: req.user.id,
        details: { dossier_id: id, reference },
        ip_address: req.ip,
      });

      // Générer les tâches automatiques pour ce dossier
      TacheModel.createForDossier(id).catch((e) =>
        logger.error('Erreur génération tâches dossier', { error: e.message, dossier_id: id })
      );

      return res.status(201).json({ success: true, message: 'Dossier créé.', data: { id, reference } });
    } catch (err) {
      logger.error('Erreur création dossier', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-17 : Mise à jour d'un dossier ─────────────────────────────────────
  async update(req, res) {
    const id = parseInt(req.params.id);
    try {
      const dossier = await DossierModel.findById(id);
      if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });

      const allowed = ['nom', 'prenom', 'telephone', 'email', 'formation_souhaitee',
                       'statut_id', 'cout_total_formation', 'part_financeur', 'fp_manuel',
                       'session_cours_id', 'session_edof_id', 'examen_id',
                       'apprenant_id', 'id_lead_origine', 'type_financement',
                       'reference_financeur', 'numero_cma', 'numero_dossier_edof'];
      const updates = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      // Accept statut by name and resolve to statut_id
      if (req.body.statut && !req.body.statut_id) {
        const [[sd]] = await db.query('SELECT id FROM statuts_dossier WHERE nom = ? LIMIT 1', [req.body.statut]);
        if (sd?.id) updates.statut_id = sd.id;
      }

      await DossierModel.update(id, updates);

      await LogModel.create({
        action:  'dossier_updated',
        user_id: req.user.id,
        details: { dossier_id: id, changes: Object.keys(updates) },
        ip_address: req.ip,
      });

      return res.status(200).json({ success: true, message: 'Dossier mis à jour.' });
    } catch (err) {
      logger.error('Erreur update dossier', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-14 : Saisie des frais CMA ──────────────────────────────────────────
  async updateCMA(req, res) {
    const id = parseInt(req.params.id);
    const { frais_cma, frais_cma_paye, pieces_collectees, espace_cma_ouvert } = req.body;

    try {
      const dossier = await DossierModel.findById(id);
      if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });

      // Seuls admin et administratif peuvent saisir les frais CMA (UC-14)
      if (!['super_admin', 'role_admin', 'role_administratif'].includes(req.user.role_nom)) {
        return res.status(403).json({
          success: false, code: 'FORBIDDEN',
          message: 'Seuls Admin et Administratif peuvent saisir les frais CMA.',
        });
      }

      if (frais_cma_paye && !frais_cma && !dossier.frais_cma) {
        return res.status(400).json({
          success: false,
          code:    'VALIDATION_ERROR',
          message: 'Saisir le montant des frais CMA avant de marquer comme payé.',
        });
      }

      const updates = {};
      if (frais_cma !== undefined)        updates.frais_cma        = parseFloat(frais_cma);
      if (frais_cma_paye !== undefined)   updates.frais_cma_paye   = frais_cma_paye ? 1 : 0;

      await DossierModel.update(id, updates);

      const message = frais_cma_paye
        ? 'Frais CMA marqués comme payés. Dossier débloqué pour validation.'
        : 'Frais CMA mis à jour.';

      await LogModel.create({
        action:  'cma_updated',
        user_id: req.user.id,
        details: { dossier_id: id, frais_cma, frais_cma_paye },
        ip_address: req.ip,
      });

      return res.status(200).json({ success: true, message });
    } catch (err) {
      logger.error('Erreur update CMA', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-15 : Validation d'un dossier ───────────────────────────────────────
  async validate(req, res) {
    const id = parseInt(req.params.id);
    try {
      const check = await DossierModel.canBeValidated(id);
      if (!check.ok) {
        const messages = {
          DOSSIER_NOT_FOUND: 'Dossier introuvable.',
          CMA_NOT_PAID:      'Frais CMA non réglés — validation impossible.',
        };
        return res.status(400).json({
          success: false,
          code:    check.reason,
          message: messages[check.reason] || 'Validation impossible.',
        });
      }

      // Récupérer le statut "Validé" dans statuts_dossier
      const [[statutValide]] = await db.query(
        "SELECT id FROM statuts_dossier WHERE nom LIKE '%valid%' LIMIT 1"
      );

      await DossierModel.update(id, {
        statut_id: statutValide?.id || null,
      });

      await LogModel.create({
        action:  'dossier_validated',
        user_id: req.user.id,
        details: { dossier_id: id },
        ip_address: req.ip,
      });

      logger.info('Dossier validé', { dossier_id: id, by: req.user.id });

      return res.status(200).json({ success: true, message: 'Dossier validé avec succès.' });
    } catch (err) {
      logger.error('Erreur validation dossier', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-18 : Archivage d'un dossier ────────────────────────────────────────
  async archive(req, res) {
    const id = parseInt(req.params.id);
    const { force } = req.body; // force=true pour archiver même si formation non terminée

    try {
      const check = await DossierModel.canBeArchived(id);
      if (!check.ok) {
        const messages = {
          DOSSIER_NOT_FOUND: 'Dossier introuvable.',
          ALREADY_ARCHIVED:  'Ce dossier est déjà archivé.',
          SOLDE_NON_SOLDE:   'Archivage impossible — solde non soldé.',
        };
        return res.status(400).json({
          success: false,
          code:    check.reason,
          message: messages[check.reason] || 'Archivage impossible.',
        });
      }

      await DossierModel.update(id, { archived: 1 });

      await LogModel.create({
        action:  'dossier_archived',
        user_id: req.user.id,
        details: { dossier_id: id, forced: !!force },
        ip_address: req.ip,
      });

      return res.status(200).json({ success: true, message: 'Dossier archivé.' });
    } catch (err) {
      logger.error('Erreur archivage dossier', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Encaissements ─────────────────────────────────────────────────────────
  async getEncaissements(req, res) {
    try {
      const enc = await DossierModel.getEncaissements(parseInt(req.params.id));
      return res.status(200).json({ success: true, data: enc });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async addEncaissement(req, res) {
    const dossierId = parseInt(req.params.id);
    const { montant, date_encaissement, mode_paiement, notes } = req.body;

    if (!montant || isNaN(parseFloat(montant)) || parseFloat(montant) <= 0) {
      return res.status(400).json({ success: false, message: 'Montant valide requis.' });
    }
    if (!date_encaissement) {
      return res.status(400).json({ success: false, message: 'Date d\'encaissement requise.' });
    }

    try {
      const dossier = await DossierModel.findById(dossierId);
      if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });

      const montantNum = parseFloat(montant);

      // Alerte trop-perçu
      const nouveauTotal = dossier.total_encaisse + montantNum;
      const tropPercu    = nouveauTotal > dossier.financement_personnel;

      const encId = await DossierModel.addEncaissement({
        dossier_id:        dossierId,
        montant:           montantNum,
        date_encaissement,
        mode_paiement:     mode_paiement || 'virement',
        user_id:           req.user.id,
        notes,
      });

      await LogModel.create({
        action:  'encaissement_added',
        user_id: req.user.id,
        details: { dossier_id: dossierId, montant: montantNum },
        ip_address: req.ip,
      });

      const dossierMaj = await DossierModel.findById(dossierId);
      const statut_paiement = DossierModel.getStatutPaiement(
        dossierMaj.financement_personnel, dossierMaj.total_encaisse
      );

      return res.status(201).json({
        success: true,
        message: tropPercu
          ? 'Encaissement enregistré — attention : trop-perçu détecté.'
          : 'Encaissement enregistré.',
        data:    { id: encId, trop_percu: tropPercu, statut_paiement },
        warning: tropPercu ? 'TROP_PERCU' : null,
      });
    } catch (err) {
      logger.error('Erreur ajout encaissement', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-16 : Import Excel Gestion ──────────────────────────────────────────
  async importGestion(req, res) {
    const { mode = 'mettre_a_jour' } = req.body;
    const rows = req.parsedRows; // injecté par le middleware de parsing xlsx

    if (!rows || !rows.length) {
      return res.status(400).json({ success: false, message: 'Fichier vide ou non parsé.' });
    }
    if (!MODES_IMPORT_VALIDES.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: `Mode invalide. Valeurs : ${MODES_IMPORT_VALIDES.join(', ')}`,
      });
    }

    try {
      const rapport = await ImportService.processGestion(rows, mode, req.user.id);
      return res.status(200).json({ success: true, rapport });
    } catch (err) {
      logger.error('Erreur import gestion', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur import.' });
    }
  },

  // ── UC-16 : Import EDOF ───────────────────────────────────────────────────
  async importEDOF(req, res) {
    const { mode = 'upsert' } = req.body;
    const rows = req.parsedRows;

    if (!rows || !rows.length) {
      return res.status(400).json({ success: false, message: 'Fichier vide ou non parsé.' });
    }

    try {
      const rapport = await ImportService.processEDOF(rows, mode, req.user.id);
      return res.status(200).json({ success: true, rapport });
    } catch (err) {
      logger.error('Erreur import EDOF', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur import.' });
    }
  },

  // ── Historique des imports ────────────────────────────────────────────────
  async getImportHistory(req, res) {
    try {
      const history = await ImportService.getHistory(20);
      return res.status(200).json({ success: true, data: history });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },
};

module.exports = DossiersController;
