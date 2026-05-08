'use strict';

const FinanceModel = require('../models/Finance');
const DossierModel = require('../models/Dossier');
const LogModel     = require('../models/Log');
const logger       = require('../utils/logger');
const db           = require('../config/database');

const MODES_PAIEMENT = ['virement', 'cb', 'cheque', 'especes', 'prelevement'];
const MODES_PLAN     = ['mensualites', 'dates_libres'];
const NB_MOIS_MAX    = 60; // jusqu'à 60 mensualités acceptées

/**
 * Filtre finance selon le rôle (UC-28)
 */
function buildAgenceFilter(user) {
  if (['super_admin', 'role_admin'].includes(user.role_nom)) return null;
  return user.agence_id;
}

const FinanceController = {

  // ── UC-25 : Saisie d'un encaissement ──────────────────────────────────────
  async addEncaissement(req, res) {
    const dossierId = parseInt(req.params.dossierId);
    const { montant, date_encaissement, mode_paiement, notes } = req.body;

    // Validation
    const erreurs = [];
    if (!montant || isNaN(parseFloat(montant)) || parseFloat(montant) <= 0)
      erreurs.push('Montant valide requis (> 0).');
    if (!date_encaissement)
      erreurs.push('Date d\'encaissement requise.');
    if (mode_paiement && !MODES_PAIEMENT.includes(mode_paiement))
      erreurs.push(`Mode de paiement invalide. Valeurs : ${MODES_PAIEMENT.join(', ')}`);
    if (erreurs.length) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', errors: erreurs });
    }

    try {
      const dossier = await DossierModel.findById(dossierId);
      if (!dossier) {
        return res.status(404).json({ success: false, message: 'Dossier introuvable.' });
      }

      const montantNum   = parseFloat(montant);
      const nouveauTotal = dossier.total_encaisse + montantNum;
      const tropPercu    = nouveauTotal > dossier.financement_personnel
                        && dossier.financement_personnel > 0;

      // Enregistrer l'encaissement
      const encId = await DossierModel.addEncaissement({
        dossier_id:        dossierId,
        montant:           montantNum,
        date_encaissement,
        mode_paiement:     mode_paiement || 'virement',
        user_id:           req.user.id,
        notes,
      });

      // Recalculer le statut de paiement
      const resume = await FinanceModel.getResumeDossier(dossierId);

      // Marquer les échéances couvertes comme payées
      await FinanceController._marquerEcheancesCouvertes(dossierId, resume.total_encaisse);

      await LogModel.create({
        action:     'encaissement_added',
        user_id:    req.user.id,
        details:    { dossier_id: dossierId, montant: montantNum, mode_paiement },
        ip_address: req.ip,
      });

      logger.info('Encaissement saisi', { encId, dossierId, montant: montantNum, by: req.user.id });

      return res.status(201).json({
        success: true,
        message: tropPercu
          ? '⚠️ Encaissement enregistré — trop-perçu détecté.'
          : 'Encaissement enregistré.',
        data: {
          id:             encId,
          statut_paiement: resume.statut_paiement,
          total_encaisse:  resume.total_encaisse,
          reste_a_payer:   resume.reste_a_payer,
          trop_percu:      resume.trop_percu,
        },
        warning: tropPercu ? 'TROP_PERCU' : null,
      });

    } catch (err) {
      logger.error('Erreur addEncaissement', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-26 : Création d'un plan financier ─────────────────────────────────
  async createPlan(req, res) {
    const dossierId = parseInt(req.params.dossierId);
    const { mode, nb_mensualites, date_debut, echeances, prelevement_auto } = req.body;

    if (!mode || !MODES_PLAN.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: `Mode invalide. Valeurs : ${MODES_PLAN.join(', ')}`,
      });
    }

    try {
      // Ajouter colonne prelevement_auto si elle n'existe pas encore
      try {
        await require('../config/database').query(
          `ALTER TABLE echeances ADD COLUMN IF NOT EXISTS prelevement_auto TINYINT(1) NOT NULL DEFAULT 0`
        );
      } catch (_) { /* colonne déjà présente ou DB ne supporte pas IF NOT EXISTS */ }

      const resume = await FinanceModel.getResumeDossier(dossierId);
      if (!resume) {
        return res.status(404).json({ success: false, message: 'Dossier introuvable.' });
      }

      const fp         = parseFloat(resume.financement_personnel) || 0;
      const encaisse   = parseFloat(resume.total_encaisse)        || 0;
      // Le plan porte sur le RESTE DÛ (pas le montant total si déjà partiellement payé)
      const montantTotal = Math.max(0, fp - encaisse);

      if (fp <= 0) {
        return res.status(400).json({
          success: false,
          code:    'NO_FINANCEMENT',
          message: 'Ce dossier n\'a pas de financement personnel à échelonner.',
        });
      }
      if (montantTotal <= 0.01) {
        return res.status(400).json({
          success: false,
          code:    'ALREADY_PAID',
          message: 'Ce dossier est déjà intégralement réglé.',
        });
      }

      const isPrelevement = !!prelevement_auto;
      let nbEcheances;

      if (mode === 'mensualites') {
        const nb = parseInt(nb_mensualites);
        if (!nb || nb < 1 || nb > NB_MOIS_MAX) {
          return res.status(400).json({
            success: false,
            message: `Nombre de mensualités invalide (1–${NB_MOIS_MAX}).`,
          });
        }
        if (!date_debut) {
          return res.status(400).json({
            success: false,
            message: 'date_debut requise pour le mode mensualités.',
          });
        }

        nbEcheances = await FinanceModel.createPlanMensualites(
          dossierId, montantTotal, nb,
          date_debut, isPrelevement
        );

      } else {
        // Validation dates libres
        if (!echeances || !Array.isArray(echeances) || echeances.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'echeances (tableau) requis pour le mode dates_libres.',
          });
        }

        // Tolérance 5% sur le total (le reste dû peut avoir des centimes d'arrondi)
        const totalEcheances = echeances.reduce((s, e) => s + parseFloat(e.montant), 0);
        const diff = Math.abs(totalEcheances - montantTotal);
        if (diff > montantTotal * 0.05 + 0.02) {
          return res.status(400).json({
            success: false,
            code:    'MONTANTS_INCOHERENTS',
            message: `La somme des échéances (${totalEcheances.toFixed(2)}€) ne correspond pas au reste dû (${montantTotal.toFixed(2)}€).`,
            diff,
          });
        }

        nbEcheances = await FinanceModel.createPlanDatesLibres(dossierId, echeances, isPrelevement);
      }

      await LogModel.create({
        action:     'plan_financier_created',
        user_id:    req.user.id,
        details:    { dossier_id: dossierId, mode, nb_echeances: nbEcheances, montant_total: montantTotal },
        ip_address: req.ip,
      });

      logger.info('Plan financier créé', { dossierId, mode, nbEcheances, by: req.user.id });

      const mensualiteStr = mode === 'mensualites'
        ? `${(montantTotal / parseInt(nb_mensualites)).toFixed(2)} €/mois`
        : 'montants libres';
      return res.status(201).json({
        success: true,
        message: `Plan financier créé — ${nbEcheances} échéance(s) · ${mensualiteStr}${isPrelevement ? ' · Prélèvement SEPA activé' : ''}.`,
        data: {
          mode,
          nb_echeances:      nbEcheances,
          montant_plan:      montantTotal,
          prelevement_auto:  isPrelevement,
        },
      });

    } catch (err) {
      logger.error('Erreur createPlan', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-26 : Récupération du plan financier d'un dossier ──────────────────
  async getPlan(req, res) {
    try {
      const dossierId = parseInt(req.params.dossierId);
      const [plan, resume] = await Promise.all([
        FinanceModel.getPlanFinancier(dossierId),
        FinanceModel.getResumeDossier(dossierId),
      ]);
      return res.status(200).json({ success: true, data: { plan, resume } });
    } catch (err) {
      logger.error('Erreur getPlan', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-27 : Dossiers en retard de paiement >24h ───────────────────────────
  async getRetards(req, res) {
    try {
      const heures   = parseInt(req.query.heures) || 24;
      const agenceId = buildAgenceFilter(req.user) || req.query.agence_id || null;

      const retards = await FinanceModel.getDossiersEnRetard(heures, agenceId);

      return res.status(200).json({
        success: true,
        data:    retards,
        total:   retards.length,
        seuil_heures: heures,
      });
    } catch (err) {
      logger.error('Erreur getRetards', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-28 : Suivi des paiements ───────────────────────────────────────────
  async getSuiviPaiements(req, res) {
    try {
      const agenceId = buildAgenceFilter(req.user) || req.query.agence_id || null;
      const { dossier_id, date_debut, date_fin, limit, offset } = req.query;

      const encaissements = await FinanceModel.findEncaissements({
        dossier_id: dossier_id ? parseInt(dossier_id) : undefined,
        agence_id:  agenceId,
        date_debut,
        date_fin,
        limit:  parseInt(limit,  10) || 50,
        offset: parseInt(offset, 10) || 0,
      });

      const kpis = await FinanceModel.getKpisFinanciers(agenceId);

      return res.status(200).json({
        success: true,
        data:    encaissements,
        kpis,
        total:   encaissements.length,
      });
    } catch (err) {
      logger.error('Erreur getSuiviPaiements', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-29 : Relance d'un apprenant en retard ──────────────────────────────
  async relancer(req, res) {
    const dossierId = parseInt(req.params.dossierId);

    try {
      const dossier = await DossierModel.findById(dossierId);
      if (!dossier) {
        return res.status(404).json({ success: false, message: 'Dossier introuvable.' });
      }

      if (!dossier.email && !dossier.telephone) {
        return res.status(400).json({
          success: false,
          code:    'NO_CONTACT',
          message: 'Aucun moyen de contact disponible pour cet apprenant (email et téléphone manquants).',
        });
      }

      // Enregistrer la relance dans les interactions
      const NotificationService = require('../services/notificationService');
      let envoyes = 0;

      if (dossier.email) {
        await NotificationService.sendEmail({
          to:        dossier.email,
          subject:   'Rappel de paiement — LeadFlow CRM',
          body:      `Bonjour ${dossier.prenom} ${dossier.nom},\n\nNous vous rappelons qu'un paiement est en attente concernant votre formation ${dossier.formation_souhaitee}.\n\nMerci de vous mettre en contact avec notre équipe.\n\nCordialement,\nL'équipe LeadFlow`,
          dossier_id: dossierId,
          type:       'relance_paiement',
        });
        envoyes++;
      }

      if (dossier.telephone) {
        await NotificationService.sendSMS({
          to:        dossier.telephone,
          message:   `Bonjour ${dossier.prenom}, un paiement est en attente pour votre formation. Merci de nous contacter.`,
          dossier_id: dossierId,
          type:       'relance_paiement',
        });
        envoyes++;
      }

      await LogModel.create({
        action:     'relance_paiement_envoyee',
        user_id:    req.user.id,
        details:    { dossier_id: dossierId, canaux: envoyes },
        ip_address: req.ip,
      });

      return res.status(200).json({
        success:        true,
        message:        `Relance envoyée (${envoyes} canal(aux)).`,
        canaux_envoyes: envoyes,
      });

    } catch (err) {
      logger.error('Erreur relancer', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-28 : Point Financier global ────────────────────────────────────────
  async getPointFinancier(req, res) {
    try {
      const agenceId = buildAgenceFilter(req.user) || req.query.agence_id || null;
      const mois     = req.query.mois || null; // format YYYY-MM

      const [situation, historique] = await Promise.all([
        FinanceModel.getSituationGlobale(agenceId, mois),
        FinanceModel.getHistoriqueMensuel(6, agenceId),
      ]);

      return res.status(200).json({
        success: true,
        data:    { situation, historique },
      });
    } catch (err) {
      logger.error('Erreur getPointFinancier', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-30 : Export situation financière ──────────────────────────────────
  async exportSituation(req, res) {
    try {
      const agenceId = buildAgenceFilter(req.user);
      const mois     = req.query.mois || null;

      const situation  = await FinanceModel.getSituationGlobale(agenceId, mois);
      const historique = await FinanceModel.getHistoriqueMensuel(6, agenceId);

      // En production : générer un vrai PDF avec pdfkit ou puppeteer
      // Ici on retourne les données JSON pour le frontend qui génère le PDF
      const exportData = {
        generated_at:   new Date().toISOString(),
        periode:        mois || 'Toutes périodes',
        agence_id:      agenceId,
        situation,
        historique,
      };

      await LogModel.create({
        action:  'export_situation_financiere',
        user_id: req.user.id,
        details: { mois, agence_id: agenceId },
        ip_address: req.ip,
      });

      return res.status(200).json({
        success: true,
        message: 'Données exportées.',
        data:    exportData,
      });

    } catch (err) {
      logger.error('Erreur exportSituation', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Liste des dossiers avec résumé financier ─────────────────────────────
  async getDossiersSuivi(req, res) {
    try {
      const agenceId = buildAgenceFilter(req.user) || req.query.agence_id || null;
      const dossiers = await FinanceModel.getDossiersSuivi(agenceId);
      return res.status(200).json({ success: true, data: dossiers, total: dossiers.length });
    } catch (err) {
      logger.error('Erreur getDossiersSuivi', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Résumé financier d'un dossier ────────────────────────────────────────
  async getResumeDossier(req, res) {
    try {
      const resume = await FinanceModel.getResumeDossier(parseInt(req.params.dossierId));
      if (!resume) {
        return res.status(404).json({ success: false, message: 'Dossier introuvable.' });
      }
      return res.status(200).json({ success: true, data: resume });
    } catch (err) {
      logger.error('Erreur getResumeDossier', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Export comptable CSV encaissements ───────────────────────────────────
  async exportEncaissementsCSV(req, res) {
    try {
      const agenceId  = buildAgenceFilter(req.user);
      const { date_debut, date_fin, dossier_id } = req.query;

      let sql = `
        SELECT e.date_encaissement, d.reference, d.nom, d.prenom,
               d.formation_souhaitee, e.montant, e.mode_paiement,
               CONCAT(COALESCE(u.prenom,''), ' ', COALESCE(u.nom,'')) AS saisi_par,
               e.notes
        FROM encaissements e
        JOIN dossiers d ON d.id = e.dossier_id
        LEFT JOIN users u ON u.id = e.user_id
        WHERE 1=1
      `;
      const params = [];

      if (agenceId)   { sql += ' AND d.agence_id = ?'; params.push(agenceId); }
      if (dossier_id) { sql += ' AND e.dossier_id = ?'; params.push(parseInt(dossier_id)); }
      if (date_debut) { sql += ' AND e.date_encaissement >= ?'; params.push(date_debut); }
      if (date_fin)   { sql += ' AND e.date_encaissement <= ?'; params.push(date_fin); }

      sql += ' ORDER BY e.date_encaissement DESC';

      const [rows] = await db.query(sql, params);

      const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const header = ['Date', 'Référence', 'Nom', 'Prénom', 'Formation', 'Montant (€)', 'Mode paiement', 'Saisi par', 'Notes'];
      const lines  = [
        header.map(escape).join(','),
        ...rows.map(r => [
          r.date_encaissement ? new Date(r.date_encaissement).toLocaleDateString('fr-FR') : '',
          r.reference || '',
          r.nom || '',
          r.prenom || '',
          r.formation_souhaitee || '',
          parseFloat(r.montant || 0).toFixed(2).replace('.', ','),
          r.mode_paiement || '',
          (r.saisi_par || '').trim(),
          r.notes || '',
        ].map(escape).join(',')),
      ];

      const csv      = '﻿' + lines.join('\r\n'); // BOM pour compatibilité Excel
      const filename = `encaissements_${new Date().toISOString().split('T')[0]}.csv`;

      await LogModel.create({
        action: 'export_encaissements_csv', user_id: req.user.id,
        details: { lignes: rows.length, date_debut, date_fin },
        ip_address: req.ip,
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);

    } catch (err) {
      logger.error('Erreur exportEncaissementsCSV', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Méthode interne : marquer échéances couvertes ─────────────────────────
  async _marquerEcheancesCouvertes(dossierId, totalEncaisse) {
    try {
      // Récupérer les échéances triées par date
      const echeances = await FinanceModel.getPlanFinancier(dossierId);
      let cumul = 0;

      for (const e of echeances) {
        if (e.statut === 'payee') {
          cumul += parseFloat(e.montant);
          continue;
        }
        cumul += parseFloat(e.montant);
        if (cumul <= totalEncaisse) {
          await FinanceModel.updateEcheanceStatut(e.id, 'payee');
        }
      }
    } catch (err) {
      logger.warn('Erreur marquage échéances', { error: err.message });
    }
  },
};

module.exports = FinanceController;
