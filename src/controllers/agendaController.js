'use strict';

const RDVModel            = require('../models/RDV');
const LogModel            = require('../models/Log');
const NotificationService = require('../services/notificationService');
const logger              = require('../utils/logger');
const db                  = require('../config/database');

const TYPES_RDV    = ['commercial', 'administratif', 'interne'];
const STATUTS_RDV  = ['planifie', 'confirme', 'effectue', 'annule', 'en_attente'];

/**
 * Applique le filtre selon le rôle (UC-32)
 * COMMERCIAL          → ses RDV uniquement (responsable_id)
 * MANAGER             → RDV de son agence
 * ROLE_ADMIN/SUPER    → tout
 * ROLE_ADMINISTRATIF  → RDV de son agence
 * AGENT_ACCUEIL       → RDV de son agence
 */
function buildRoleFilter(user) {
  switch (user.role_nom) {
    case 'commercial':
      return { responsable_id: user.id };
    case 'manager':
    case 'role_administratif':
    case 'agent_accueil':
      return { agence_id: user.agence_id };
    default:
      return {};
  }
}

const AgendaController = {

  // ── UC-32 : Liste des RDV (calendrier + liste) ────────────────────────────
  async list(req, res) {
    try {
      const roleFilter = buildRoleFilter(req.user);
      const {
        type_rdv, statut, date_debut, date_fin,
        lead_id, dossier_id, limit, offset
      } = req.query;

      const rdvs = await RDVModel.findAll({
        ...roleFilter,
        type_rdv, statut, lead_id, dossier_id,
        date_debut, date_fin,
        limit:  parseInt(limit,  10) || 50,
        offset: parseInt(offset, 10) || 0,
      });

      return res.status(200).json({
        success: true,
        data:    rdvs,
        total:   rdvs.length,
        filters: roleFilter,
      });
    } catch (err) {
      logger.error('Erreur liste RDV', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-36 : Widget Dashboard — RDV du jour ────────────────────────────────
  async getToday(req, res) {
    try {
      const agenceId     = ['super_admin','role_admin'].includes(req.user.role_nom)
        ? req.query.agence_id || null
        : req.user.agence_id;
      const responsableId = req.user.role_nom === 'commercial' ? req.user.id : null;

      const [rdvs, kpis] = await Promise.all([
        RDVModel.findToday(agenceId, responsableId),
        RDVModel.getKpis(agenceId),
      ]);

      return res.status(200).json({ success: true, data: rdvs, kpis });
    } catch (err) {
      logger.error('Erreur getToday', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-31 : Détail d'un RDV ───────────────────────────────────────────────
  async getOne(req, res) {
    try {
      const rdv = await RDVModel.findById(parseInt(req.params.id));
      if (!rdv) return res.status(404).json({ success: false, message: 'RDV introuvable.' });

      // COMMERCIAL ne voit que ses RDV
      if (req.user.role_nom === 'commercial' && rdv.responsable_id !== req.user.id) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Accès refusé.' });
      }

      return res.status(200).json({ success: true, data: rdv });
    } catch (err) {
      logger.error('Erreur getOne RDV', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-31 : Création d'un RDV ─────────────────────────────────────────────
  async create(req, res) {
    const {
      type_rdv, titre, description, date_rdv, heure_debut, heure_fin,
      responsable_id, lead_id, dossier_id,
      notif_email = true, notif_sms = true, notif_rappel_24h = false,
    } = req.body;

    // Validation
    const erreurs = [];
    if (!type_rdv || !TYPES_RDV.includes(type_rdv))
      erreurs.push(`type_rdv invalide. Valeurs : ${TYPES_RDV.join(', ')}`);
    if (!titre?.trim())    erreurs.push('Titre requis.');
    if (!date_rdv)         erreurs.push('date_rdv requise.');
    if (!heure_debut)      erreurs.push('heure_debut requise.');
    if (!heure_fin)        erreurs.push('heure_fin requise.');
    if (!responsable_id)   erreurs.push('responsable_id requis.');
    if (heure_debut && heure_fin && heure_debut >= heure_fin)
      erreurs.push('heure_fin doit être postérieure à heure_debut.');

    // Vérifications métier selon le type
    if (type_rdv === 'commercial' && !lead_id)
      erreurs.push('lead_id requis pour un RDV de type Commercial.');
    if (type_rdv === 'administratif' && !dossier_id)
      erreurs.push('dossier_id requis pour un RDV de type Administratif.');

    if (erreurs.length) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', errors: erreurs });
    }

    try {
      // Vérifier que le responsable existe (UC-31)
      const [[responsable]] = await db.query(
        'SELECT id, prenom, nom, email FROM users WHERE id = ? AND actif = 1',
        [responsable_id]
      );
      if (!responsable) {
        return res.status(404).json({
          success: false,
          code:    'RESPONSABLE_NOT_FOUND',
          message: 'Responsable introuvable ou inactif.',
        });
      }

      // Vérifier lead si fourni (UC-31)
      if (lead_id) {
        const [[lead]] = await db.query('SELECT id FROM leads WHERE id = ?', [lead_id]);
        if (!lead) {
          return res.status(404).json({
            success: false, code: 'LEAD_NOT_FOUND',
            message: 'Lead introuvable dans le CRM.',
          });
        }
      }

      // Vérifier dossier si fourni
      if (dossier_id) {
        const [[dossier]] = await db.query('SELECT id FROM dossiers WHERE id = ?', [dossier_id]);
        if (!dossier) {
          return res.status(404).json({
            success: false, code: 'DOSSIER_NOT_FOUND',
            message: 'Dossier introuvable dans le CRM.',
          });
        }
      }

      // Vérifier conflit d'horaire (UC-31)
      const conflits = await RDVModel.checkConflict(
        responsable_id, date_rdv, heure_debut, heure_fin
      );
      if (conflits.length) {
        return res.status(409).json({
          success: false,
          code:    'HORAIRE_CONFLICT',
          message: `Conflit d'horaire détecté pour ${responsable.prenom} ${responsable.nom}.`,
          conflits: conflits.map(c => ({
            id:          c.id,
            titre:       c.titre,
            heure_debut: c.heure_debut,
            heure_fin:   c.heure_fin,
          })),
        });
      }

      // Créer le RDV
      const rdvId = await RDVModel.create({
        type_rdv, titre: titre.trim(), description,
        date_rdv, heure_debut, heure_fin,
        responsable_id: parseInt(responsable_id),
        lead_id:     lead_id     ? parseInt(lead_id)     : null,
        dossier_id:  dossier_id  ? parseInt(dossier_id)  : null,
        notif_email, notif_sms, notif_rappel_24h,
        created_by: req.user.id,
      });

      // Envoyer notifications si demandé (UC-31)
      let notifs_envoyees = 0;
      if (notif_email || notif_sms) {
        notifs_envoyees = await AgendaController._envoyerNotifCreation(
          rdvId, { type_rdv, titre, date_rdv, heure_debut, heure_fin },
          lead_id, dossier_id, notif_email, notif_sms
        );
      }

      await LogModel.create({
        action:     'rdv_created',
        user_id:    req.user.id,
        details:    { rdv_id: rdvId, type_rdv, date_rdv, heure_debut },
        ip_address: req.ip,
      });

      logger.info('RDV créé', { rdvId, type_rdv, date_rdv, by: req.user.id });

      return res.status(201).json({
        success:           true,
        message:           `RDV créé pour le ${date_rdv} à ${heure_debut}.`,
        data:              { id: rdvId, notifs_envoyees },
      });

    } catch (err) {
      logger.error('Erreur création RDV', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-33 : Confirmation d'un RDV ─────────────────────────────────────────
  async confirmer(req, res) {
    const rdvId = parseInt(req.params.id);
    try {
      const rdv = await RDVModel.findById(rdvId);
      if (!rdv) return res.status(404).json({ success: false, message: 'RDV introuvable.' });

      if (rdv.statut === 'effectue') {
        return res.status(400).json({
          success: false, code: 'ALREADY_DONE',
          message: 'Ce RDV est déjà marqué comme effectué.',
        });
      }
      if (rdv.statut === 'annule') {
        return res.status(400).json({
          success: false, code: 'ALREADY_CANCELLED',
          message: 'Ce RDV est annulé et ne peut pas être confirmé.',
        });
      }

      await RDVModel.update(rdvId, { statut: 'confirme' });

      // Envoyer notification de confirmation (UC-33)
      let notif_envoyee = false;
      const contact = rdv.lead_email || rdv.dossier_email;
      const tel     = rdv.lead_tel   || rdv.dossier_tel;
      const nom     = rdv.lead_nom   || rdv.dossier_nom;

      if (contact && rdv.notif_email) {
        await NotificationService.sendEmail({
          to:        contact,
          subject:   `Confirmation de votre RDV du ${rdv.date_rdv} à ${rdv.heure_debut}`,
          body:      `Bonjour ${nom},\n\nVotre rendez-vous du ${rdv.date_rdv} à ${rdv.heure_debut} est confirmé.\n\nÀ bientôt,\nL'équipe LeadFlow`,
          dossier_id: rdv.dossier_id,
          type:      'rdv_confirme',
        });
        notif_envoyee = true;
      }

      await LogModel.create({
        action:  'rdv_confirme',
        user_id: req.user.id,
        details: { rdv_id: rdvId, notif_envoyee },
        ip_address: req.ip,
      });

      return res.status(200).json({
        success:        true,
        message:        'RDV confirmé.',
        notif_envoyee,
      });

    } catch (err) {
      logger.error('Erreur confirmation RDV', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-34 : Marquer un RDV comme effectué ─────────────────────────────────
  async marquerEffectue(req, res) {
    const rdvId = parseInt(req.params.id);
    try {
      const rdv = await RDVModel.findById(rdvId);
      if (!rdv) return res.status(404).json({ success: false, message: 'RDV introuvable.' });

      if (rdv.statut === 'effectue') {
        return res.status(400).json({
          success: false, code: 'ALREADY_DONE',
          message: 'Ce RDV est déjà marqué comme effectué.',
        });
      }
      if (rdv.statut === 'annule') {
        return res.status(400).json({
          success: false, code: 'ALREADY_CANCELLED',
          message: 'Impossible — RDV annulé.',
        });
      }

      await RDVModel.update(rdvId, { statut: 'effectue' });

      // UC-34 : si RDV commercial lié à un lead → suggérer mise à jour statut lead
      let suggestion_lead = null;
      if (rdv.type_rdv === 'commercial' && rdv.lead_id) {
        const [[lead]] = await db.query(
          'SELECT id, statut FROM leads WHERE id = ?', [rdv.lead_id]
        );
        if (lead && lead.statut === 'rdv_booke') {
          suggestion_lead = {
            lead_id:  rdv.lead_id,
            message:  'Ce lead est en statut RDV Booké. Pensez à mettre à jour son statut.',
            lien:     `/api/leads/${rdv.lead_id}/statut`,
          };
        }
      }

      await LogModel.create({
        action:  'rdv_effectue',
        user_id: req.user.id,
        details: { rdv_id: rdvId },
        ip_address: req.ip,
      });

      return res.status(200).json({
        success:         true,
        message:         'RDV marqué comme effectué.',
        suggestion_lead,
      });

    } catch (err) {
      logger.error('Erreur marquerEffectue', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-35 : Annulation d'un RDV ───────────────────────────────────────────
  async annuler(req, res) {
    const rdvId = parseInt(req.params.id);
    const { motif } = req.body;

    try {
      const rdv = await RDVModel.findById(rdvId);
      if (!rdv) return res.status(404).json({ success: false, message: 'RDV introuvable.' });

      if (rdv.statut === 'effectue') {
        return res.status(400).json({
          success: false, code: 'ALREADY_DONE',
          message: 'Annulation impossible — RDV déjà effectué.',
        });
      }
      if (rdv.statut === 'annule') {
        return res.status(400).json({
          success: false, code: 'ALREADY_CANCELLED',
          message: 'Ce RDV est déjà annulé.',
        });
      }

      await RDVModel.update(rdvId, { statut: 'annule' });

      // Notification d'annulation (UC-35)
      let notif_envoyee = false;
      const contact = rdv.lead_email || rdv.dossier_email;
      if (contact && rdv.notif_email) {
        await NotificationService.sendEmail({
          to:        contact,
          subject:   `Annulation de votre RDV du ${rdv.date_rdv}`,
          body:      `Bonjour,\n\nNous vous informons que votre rendez-vous prévu le ${rdv.date_rdv} à ${rdv.heure_debut} a été annulé.\n${motif ? `Motif : ${motif}\n` : ''}\nN'hésitez pas à nous recontacter pour fixer un nouveau rendez-vous.\n\nCordialement,\nL'équipe LeadFlow`,
          dossier_id: rdv.dossier_id,
          type:      'rdv_annule',
        });
        notif_envoyee = true;
      }

      await LogModel.create({
        action:  'rdv_annule',
        user_id: req.user.id,
        details: { rdv_id: rdvId, motif, notif_envoyee },
        ip_address: req.ip,
      });

      return res.status(200).json({ success: true, message: 'RDV annulé.', notif_envoyee });

    } catch (err) {
      logger.error('Erreur annulation RDV', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Modification d'un RDV ────────────────────────────────────────────────
  async update(req, res) {
    const rdvId = parseInt(req.params.id);
    const {
      titre, description, date_rdv, heure_debut, heure_fin,
      responsable_id, lead_id, dossier_id,
    } = req.body;

    try {
      const rdv = await RDVModel.findById(rdvId);
      if (!rdv) return res.status(404).json({ success: false, message: 'RDV introuvable.' });

      if (['effectue', 'annule'].includes(rdv.statut)) {
        return res.status(400).json({
          success: false, message: 'Impossible de modifier un RDV effectué ou annulé.',
        });
      }

      // Vérifier conflit si horaires changés
      if ((date_rdv || heure_debut || heure_fin) && (rdv.responsable_id || responsable_id)) {
        const conflits = await RDVModel.checkConflict(
          responsable_id || rdv.responsable_id,
          date_rdv    || rdv.date_rdv,
          heure_debut || rdv.heure_debut,
          heure_fin   || rdv.heure_fin,
          rdvId
        );
        if (conflits.length) {
          return res.status(409).json({
            success: false, code: 'HORAIRE_CONFLICT',
            message: 'Conflit d\'horaire détecté.',
            conflits,
          });
        }
      }

      const updates = {};
      if (titre)         updates.titre        = titre.trim();
      if (description !== undefined) updates.description = description;
      if (date_rdv)      updates.date_rdv     = date_rdv;
      if (heure_debut)   updates.heure_debut  = heure_debut;
      if (heure_fin)     updates.heure_fin    = heure_fin;
      if (responsable_id) updates.responsable_id = parseInt(responsable_id);
      if (lead_id !== undefined)    updates.lead_id    = lead_id    ? parseInt(lead_id)    : null;
      if (dossier_id !== undefined) updates.dossier_id = dossier_id ? parseInt(dossier_id) : null;

      await RDVModel.update(rdvId, updates);

      await LogModel.create({
        action:  'rdv_updated',
        user_id: req.user.id,
        details: { rdv_id: rdvId, changes: Object.keys(updates) },
        ip_address: req.ip,
      });

      return res.status(200).json({ success: true, message: 'RDV mis à jour.' });

    } catch (err) {
      logger.error('Erreur update RDV', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Envoi d'un rappel manuel (UC-33) ──────────────────────────────────────
  async envoyerRappel(req, res) {
    const rdvId = parseInt(req.params.id);
    try {
      const rdv = await RDVModel.findById(rdvId);
      if (!rdv) return res.status(404).json({ success: false, message: 'RDV introuvable.' });

      if (rdv.statut === 'annule') {
        return res.status(400).json({ success: false, message: 'RDV annulé — rappel impossible.' });
      }

      const contact = rdv.lead_email || rdv.dossier_email;
      const tel     = rdv.lead_tel   || rdv.dossier_tel;
      const nom     = rdv.lead_nom   || rdv.dossier_nom || 'Client';

      let envoyes = 0;
      if (contact) {
        await NotificationService.sendEmail({
          to:         contact,
          subject:    `Rappel — Votre RDV du ${rdv.date_rdv} à ${rdv.heure_debut}`,
          body:       `Bonjour ${nom},\n\nRappel de votre rendez-vous prévu le ${rdv.date_rdv} à ${rdv.heure_debut}.\nResponsable : ${rdv.responsable_nom}\n\nÀ bientôt,\nL'équipe LeadFlow`,
          dossier_id: rdv.dossier_id,
          type:       'rdv_rappel',
        });
        envoyes++;
      }
      if (tel) {
        await NotificationService.sendSMS({
          to:         tel,
          message:    `Rappel : RDV le ${rdv.date_rdv} à ${rdv.heure_debut} avec ${rdv.responsable_nom}. LeadFlow CRM`,
          dossier_id: rdv.dossier_id,
          type:       'rdv_rappel',
        });
        envoyes++;
      }

      if (!envoyes) {
        return res.status(400).json({
          success: false, code: 'NO_CONTACT',
          message: 'Aucun moyen de contact disponible pour ce RDV.',
        });
      }

      await LogModel.create({
        action:  'rdv_rappel_envoye',
        user_id: req.user.id,
        details: { rdv_id: rdvId, canaux: envoyes },
        ip_address: req.ip,
      });

      return res.status(200).json({
        success: true, message: `Rappel envoyé (${envoyes} canal(aux)).`, canaux: envoyes,
      });

    } catch (err) {
      logger.error('Erreur envoyerRappel', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Méthode interne : notifications création ──────────────────────────────
  async _envoyerNotifCreation(rdvId, rdv, leadId, dossierId, email, sms) {
    try {
      let contact, tel, nom, dossier_id_notif;

      if (leadId) {
        const [[lead]] = await db.query(
          'SELECT nom, prenom, email, telephone FROM leads WHERE id = ?', [leadId]
        );
        if (lead) {
          contact = lead.email; tel = lead.telephone;
          nom = `${lead.prenom} ${lead.nom}`;
        }
      } else if (dossierId) {
        const [[dossier]] = await db.query(
          'SELECT nom, prenom, email, telephone FROM dossiers WHERE id = ?', [dossierId]
        );
        if (dossier) {
          contact = dossier.email; tel = dossier.telephone;
          nom = `${dossier.prenom} ${dossier.nom}`;
          dossier_id_notif = dossierId;
        }
      }

      let envoyes = 0;
      if (email && contact) {
        await NotificationService.sendEmail({
          to:         contact,
          subject:    `Nouveau RDV planifié — ${rdv.date_rdv} à ${rdv.heure_debut}`,
          body:       `Bonjour ${nom || 'Client'},\n\nUn rendez-vous a été planifié pour le ${rdv.date_rdv} à ${rdv.heure_debut}.\nObjet : ${rdv.titre}\n\nÀ bientôt,\nL'équipe LeadFlow`,
          dossier_id: dossier_id_notif,
          type:       'rdv_cree',
        });
        envoyes++;
      }
      if (sms && tel) {
        await NotificationService.sendSMS({
          to:         tel,
          message:    `Bonjour ${nom ? nom.split(' ')[0] : 'Client'}, RDV planifié le ${rdv.date_rdv} à ${rdv.heure_debut}. ${rdv.titre}. LeadFlow CRM`,
          dossier_id: dossier_id_notif,
          type:       'rdv_cree',
        });
        envoyes++;
      }
      return envoyes;
    } catch (err) {
      logger.warn('Erreur notif création RDV', { rdvId, error: err.message });
      return 0;
    }
  },
};

module.exports = AgendaController;
