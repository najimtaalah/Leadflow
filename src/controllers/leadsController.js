'use strict';

const LeadModel          = require('../models/Lead');
const PipelineModel      = require('../models/Pipeline');
const LogModel           = require('../models/Log');
const DistributionService = require('../services/distributionService');
const logger             = require('../utils/logger');
const db                 = require('../config/database');
const { STATUTS_LEAD, STATUTS_REASSIGN } = require('../constants');

const STATUTS_VALIDES = Object.values(STATUTS_LEAD);
const STATUT_GAGNE    = STATUTS_LEAD.GAGNE;
const STATUT_RDV      = STATUTS_LEAD.RDV_BOOKE;

/**
 * Filtre les leads selon le rôle de l'utilisateur connecté (UC-07)
 */
function buildRoleFilter(user) {
  switch (user.role_nom) {
    case 'commercial':
      return { vendeur_id: user.id };
    case 'manager':
      return { agence_id: user.agence_id };
    case 'agent_accueil':
      return { agence_id: user.agence_id };
    default: // super_admin, role_admin, role_administratif
      return {};
  }
}

const LeadsController = {

  // ── UC-07 : Liste des leads ────────────────────────────────────────────────
  async list(req, res) {
    try {
      const roleFilter = buildRoleFilter(req.user);
      const { statut, source_id, formation, search, limit, offset } = req.query;

      const result = await LeadModel.findAll({
        ...roleFilter,
        statut, source_id, formation, search,
        limit:  parseInt(limit,  10) || 50,
        offset: parseInt(offset, 10) || 0,
      });

      return res.status(200).json({
        success: true,
        data:    result.leads,
        total:   result.total,
        filters: roleFilter,
      });
    } catch (err) {
      logger.error('Erreur liste leads', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-07 : Détail d'un lead ───────────────────────────────────────────────
  async getOne(req, res) {
    try {
      const lead = await LeadModel.findById(parseInt(req.params.id));
      if (!lead) return res.status(404).json({ success: false, message: 'Lead introuvable.' });

      // COMMERCIAL ne peut voir que ses propres leads
      if (req.user.role_nom === 'commercial' && lead.vendeur_id !== req.user.id) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Accès refusé.' });
      }

      // Historique pipeline
      const historique = await PipelineModel.findByLead(lead.id);

      return res.status(200).json({ success: true, data: { ...lead, historique } });
    } catch (err) {
      logger.error('Erreur getOne lead', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-05 : Création manuelle d'un lead ───────────────────────────────────
  async create(req, res) {
    const { nom, prenom, telephone, email, source_id, formation_souhaitee, notes, agence_id } = req.body;

    // Validation
    if (!nom?.trim() || !telephone?.trim()) {
      return res.status(400).json({
        success: false,
        code:    'VALIDATION_ERROR',
        message: 'Nom et téléphone sont requis.',
      });
    }

    try {
      // Vérification doublon (UC-05)
      if (email || telephone) {
        const doublon = await LeadModel.checkDuplicate(email || '', telephone || '');
        if (doublon) {
          return res.status(409).json({
            success: false,
            code:    'DUPLICATE_LEAD',
            message: 'Un lead avec cet email ou ce téléphone existe déjà.',
            data:    { existing_lead_id: doublon.id, statut: doublon.statut },
          });
        }
      }

      const effectiveAgenceId = agence_id || req.user.agence_id;

      const leadId = await LeadModel.create({
        nom:                 nom.trim(),
        prenom:              prenom?.trim() || '',
        telephone:           telephone.trim(),
        email:               email?.toLowerCase().trim() || null,
        source_id:           source_id || null,
        formation_souhaitee: formation_souhaitee || null,
        agence_id:           effectiveAgenceId,
        vendeur_id:          null,
        notes,
      });

      // Enregistrer première entrée dans pipeline_historique
      await PipelineModel.create({
        lead_id:      leadId,
        statut_avant: null,
        statut_apres: 'entrant',
        user_id:      req.user.id,
        notes:        'Création manuelle',
      });

      // Distribution automatique (UC-05)
      const vendeurId = await DistributionService.assignLead(leadId, effectiveAgenceId);

      await LogModel.create({
        action:     'lead_created',
        user_id:    req.user.id,
        details:    { leadId, vendeur_id: vendeurId, source: 'manual' },
        ip_address: req.ip,
      });

      logger.info('Lead créé manuellement', { leadId, by: req.user.id, vendeur_id: vendeurId });

      return res.status(201).json({
        success: true,
        message: vendeurId
          ? 'Lead créé et assigné automatiquement.'
          : 'Lead créé. Aucun commercial disponible — assignation manuelle requise.',
        data: { id: leadId, vendeur_id: vendeurId },
      });

    } catch (err) {
      logger.error('Erreur création lead', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-06 : Réception webhook (Meta Ads / Formulaire) ─────────────────────
  async webhook(req, res) {
    const { nom, prenom, telephone, email, source, formation_souhaitee, agence_id } = req.body;

    if (!nom || !telephone) {
      return res.status(400).json({ success: false, message: 'Nom et téléphone requis.' });
    }

    try {
      // Déterminer la source automatiquement
      const [[source_row]] = await db.query(
        'SELECT id FROM sources_leads WHERE nom LIKE ? LIMIT 1',
        [`%${source || 'Meta'}%`]
      );

      // Vérification doublon
      const doublon = await LeadModel.checkDuplicate(email || '', telephone);
      if (doublon) {
        logger.warn('Webhook — doublon détecté', { email, telephone, existing_id: doublon.id });
        // Toujours répondre 200 au webhook pour éviter les rejeux
        return res.status(200).json({
          success: true,
          code:    'DUPLICATE_DETECTED',
          message: 'Lead doublon ignoré.',
          data:    { existing_lead_id: doublon.id },
        });
      }

      const leadId = await LeadModel.create({
        nom, prenom: prenom || '',
        telephone, email: email?.toLowerCase() || null,
        source_id:           source_row?.id || null,
        formation_souhaitee: formation_souhaitee || null,
        agence_id:           agence_id || null,
        vendeur_id:          null,
        notes:               `Source webhook: ${source || 'inconnu'}`,
      });

      await PipelineModel.create({
        lead_id:      leadId,
        statut_avant: null,
        statut_apres: 'entrant',
        user_id:      null,
        notes:        `Webhook ${source || 'auto'}`,
      });

      const vendeurId = await DistributionService.assignLead(leadId, agence_id || null);

      logger.info('Lead reçu via webhook', { leadId, source, vendeur_id: vendeurId });

      return res.status(200).json({
        success: true,
        message: 'Lead enregistré.',
        data:    { id: leadId, vendeur_id: vendeurId },
      });

    } catch (err) {
      logger.error('Erreur webhook lead', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-08 : Mise à jour du statut ─────────────────────────────────────────
  async updateStatut(req, res) {
    const leadId = parseInt(req.params.id);
    const { statut, notes } = req.body;

    if (!statut || !STATUTS_VALIDES.includes(statut)) {
      return res.status(400).json({
        success: false,
        code:    'VALIDATION_ERROR',
        message: `Statut invalide. Valeurs : ${STATUTS_VALIDES.join(', ')}`,
      });
    }

    try {
      const lead = await LeadModel.findById(leadId);
      if (!lead) return res.status(404).json({ success: false, message: 'Lead introuvable.' });

      // COMMERCIAL : ne peut modifier que ses propres leads
      if (req.user.role_nom === 'commercial' && lead.vendeur_id !== req.user.id) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Accès refusé.' });
      }

      const ancienStatut = lead.statut;

      // Mettre à jour le statut
      await LeadModel.update(leadId, { statut });

      // Enregistrer la transition dans pipeline_historique
      await PipelineModel.create({
        lead_id:      leadId,
        statut_avant: ancienStatut,
        statut_apres: statut,
        user_id:      req.user.id,
        notes,
      });

      const response = {
        success:       true,
        message:       `Statut mis à jour : ${ancienStatut} → ${statut}`,
        actions_auto:  [],
      };

      // ── Action auto : Statut GAGNÉ → création dossier (UC-08) ────────────
      if (statut === STATUT_GAGNE) {
        const dossierId = await LeadsController._createDossier(lead, req.user.id);
        response.actions_auto.push({ type: 'dossier_cree', dossier_id: dossierId });
        response.dossier_id = dossierId;
      }

      // ── Action auto : RDV BOOKÉ → création RDV agenda (UC-08) ────────────
      if (statut === STATUT_RDV) {
        response.actions_auto.push({
          type:    'rdv_suggere',
          message: 'Pensez à créer un RDV dans l\'agenda pour ce lead.',
        });
      }

      // ── Action auto : PERDU / ANNULÉ → réaffectation (UC-09) ─────────────
      if (STATUTS_REASSIGN.includes(statut)) {
        const newVendeurId = await DistributionService.reassignToOriginal(
          leadId, lead.vendeur_id, req.user.id
        );
        if (newVendeurId) {
          response.actions_auto.push({ type: 'reassigne', nouveau_vendeur_id: newVendeurId });
        } else {
          response.actions_auto.push({ type: 'reassign_echec', reason: 'commercial_inactif' });
        }
      }

      await LogModel.create({
        action:     'lead_statut_updated',
        user_id:    req.user.id,
        details:    { leadId, de: ancienStatut, vers: statut },
        ip_address: req.ip,
      });

      return res.status(200).json(response);

    } catch (err) {
      logger.error('Erreur update statut lead', { error: err.message, leadId });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-10 : Mise à jour générale d'un lead ────────────────────────────────
  async update(req, res) {
    const leadId = parseInt(req.params.id);
    const { nom, prenom, telephone, email, source_id, formation_souhaitee, notes, vendeur_id } = req.body;

    try {
      const lead = await LeadModel.findById(leadId);
      if (!lead) return res.status(404).json({ success: false, message: 'Lead introuvable.' });

      if (req.user.role_nom === 'commercial' && lead.vendeur_id !== req.user.id) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Accès refusé.' });
      }

      const updates = {};
      if (nom)                 updates.nom                 = nom.trim();
      if (prenom)              updates.prenom              = prenom.trim();
      if (telephone)           updates.telephone           = telephone.trim();
      if (email !== undefined) updates.email               = email?.toLowerCase().trim() || null;
      if (source_id)           updates.source_id           = source_id;
      if (formation_souhaitee) updates.formation_souhaitee = formation_souhaitee;
      if (notes !== undefined) updates.notes               = notes;

      // Réassignation manuelle — ROLE_ADMIN+ seulement
      if (vendeur_id && ['super_admin', 'role_admin', 'manager'].includes(req.user.role_nom)) {
        updates.vendeur_id = vendeur_id;
      }

      await LeadModel.update(leadId, updates);

      await LogModel.create({
        action:     'lead_updated',
        user_id:    req.user.id,
        details:    { leadId, changes: Object.keys(updates) },
        ip_address: req.ip,
      });

      return res.status(200).json({ success: true, message: 'Lead mis à jour.' });

    } catch (err) {
      logger.error('Erreur update lead', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-10 : Enregistrement d'une interaction (appel / SMS / email) ─────────
  async logInteraction(req, res) {
    const leadId = parseInt(req.params.id);
    const { type, contenu, duree } = req.body;

    const TYPES_VALIDES = ['appel', 'sms', 'email', 'rdv', 'note'];
    if (!type || !TYPES_VALIDES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Type d'interaction invalide. Valeurs : ${TYPES_VALIDES.join(', ')}`,
      });
    }

    try {
      const lead = await LeadModel.findById(leadId);
      if (!lead) return res.status(404).json({ success: false, message: 'Lead introuvable.' });

      if (req.user.role_nom === 'commercial' && lead.vendeur_id !== req.user.id) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Accès refusé.' });
      }

      const [result] = await db.query(
        `INSERT INTO interactions (lead_id, type, contenu, duree, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [leadId, type, contenu || null, duree || null, req.user.id]
      );

      return res.status(201).json({
        success: true,
        message: 'Interaction enregistrée.',
        data:    { id: result.insertId },
      });

    } catch (err) {
      logger.error('Erreur log interaction', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-12 : Réassignation manuelle ────────────────────────────────────────
  async reassign(req, res) {
    const leadId = parseInt(req.params.id);
    const { vendeur_id, motif } = req.body;

    if (!vendeur_id) {
      return res.status(400).json({ success: false, message: 'vendeur_id requis.' });
    }

    try {
      const lead = await LeadModel.findById(leadId);
      if (!lead) return res.status(404).json({ success: false, message: 'Lead introuvable.' });

      // Vérifier que le nouveau commercial est actif
      const [[vendeur]] = await db.query(
        'SELECT id, actif FROM users WHERE id = ?', [vendeur_id]
      );
      if (!vendeur || !vendeur.actif) {
        return res.status(400).json({ success: false, message: 'Commercial inactif ou introuvable.' });
      }

      const ancienVendeurId = lead.vendeur_id;
      await LeadModel.update(leadId, { vendeur_id });
      await LeadModel.createReassignation({
        lead_id:            leadId,
        ancien_vendeur_id:  ancienVendeurId,
        nouveau_vendeur_id: vendeur_id,
        motif:              motif || 'reassign_manuel',
        fait_par:           req.user.id,
      });

      await LogModel.create({
        action:     'lead_reassigned',
        user_id:    req.user.id,
        details:    { leadId, de: ancienVendeurId, vers: vendeur_id, motif },
        ip_address: req.ip,
      });

      return res.status(200).json({ success: true, message: 'Lead réassigné.' });

    } catch (err) {
      logger.error('Erreur réassignation lead', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── GET interactions d'un lead ────────────────────────────────────────────
  async getInteractions(req, res) {
    const leadId = parseInt(req.params.id);
    try {
      const lead = await LeadModel.findById(leadId);
      if (!lead) return res.status(404).json({ success: false, message: 'Lead introuvable.' });

      // Commercial : ne peut voir que les interactions de ses propres leads
      if (req.user.role_nom === 'commercial' && lead.vendeur_id !== req.user.id) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Accès refusé.' });
      }

      const [rows] = await db.query(
        `SELECT i.id, i.type, i.contenu, i.duree, i.created_at,
                CONCAT(u.prenom, ' ', u.nom) AS fait_par
         FROM interactions i
         LEFT JOIN users u ON u.id = i.user_id
         WHERE i.lead_id = ?
         ORDER BY i.created_at DESC`,
        [leadId]
      );
      return res.status(200).json({ success: true, data: rows });
    } catch (err) {
      logger.error('Erreur getInteractions', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-08 : Historique pipeline d'un lead ─────────────────────────────────
  async getHistorique(req, res) {
    try {
      const historique = await PipelineModel.findByLead(parseInt(req.params.id));
      return res.status(200).json({ success: true, data: historique });
    } catch (err) {
      logger.error('Erreur historique lead', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Méthode interne : création dossier après lead gagné ───────────────────
  async _createDossier(lead, userId) {
    try {
      const [result] = await db.query(
        `INSERT INTO dossiers
           (lead_id, nom, prenom, telephone, email,
            formation_souhaitee, agence_id, vendeur_id,
            frais_cma_paye, archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW(), NOW())`,
        [
          lead.id, lead.nom, lead.prenom, lead.telephone,
          lead.email, lead.formation_souhaitee,
          lead.agence_id, lead.vendeur_id,
        ]
      );
      const dossierId = result.insertId;
      logger.info('Dossier créé automatiquement', { leadId: lead.id, dossierId, userId });
      await LogModel.create({
        action:  'dossier_created_auto',
        user_id: userId,
        details: { leadId: lead.id, dossierId },
      });
      return dossierId;
    } catch (err) {
      logger.error('Erreur création dossier auto', { error: err.message, leadId: lead.id });
      return null;
    }
  },

  // ── Suppression d'un lead ──────────────────────────────────────────────────
  async remove(req, res) {
    const id = parseInt(req.params.id);
    try {
      const [[lead]] = await db.query('SELECT id, nom, prenom FROM leads WHERE id = ?', [id]);
      if (!lead) {
        return res.status(404).json({ success: false, message: 'Lead introuvable.' });
      }
      await db.query('DELETE FROM leads WHERE id = ?', [id]);
      await LogModel.create({
        action:     'lead_deleted',
        user_id:    req.user.id,
        details:    { lead_id: id, nom: lead.nom, prenom: lead.prenom },
        ip_address: req.ip,
      });
      logger.info('Lead supprimé', { leadId: id, by: req.user.id });
      return res.status(200).json({ success: true, message: 'Lead supprimé.' });
    } catch (err) {
      logger.error('Erreur suppression lead', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },
};

module.exports = LeadsController;
