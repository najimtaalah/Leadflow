'use strict';

const CommissionModel = require('../models/Commission');
const LogModel        = require('../models/Log');
const logger          = require('../utils/logger');

const CommissionsController = {

  // ── UC-37 : Commissions d'un commercial ───────────────────────────────────
  async getMesCommissions(req, res) {
    try {
      const vendeurId = req.user.id;
      const mois      = req.query.mois || null; // format YYYY-MM

      const isManager = await CommissionModel.isManager(vendeurId);

      let data;
      if (isManager) {
        // UC-38 : manager voit ses commissions propres + supplément équipe
        data = await CommissionModel.getCommissionsManager(vendeurId, mois);
        return res.status(200).json({ success: true, type: 'manager', data });
      }

      // UC-37 : commercial voit uniquement ses commissions
      data = await CommissionModel.getCommissionsPeriode(vendeurId, mois);
      return res.status(200).json({ success: true, type: 'commercial', data });

    } catch (err) {
      logger.error('Erreur getMesCommissions', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-38 : Tableau commissions équipe (ROLE_ADMIN / MANAGER) ────────────
  async getCommissionsEquipe(req, res) {
    try {
      const { agence_id, mois } = req.query;

      // Manager : limité à son agence
      const effectiveAgenceId =
        req.user.role_nom === 'manager'
          ? req.user.agence_id
          : agence_id || null;

      const [commissions, kpis] = await Promise.all([
        CommissionModel.getCommissions({ agence_id: effectiveAgenceId }),
        CommissionModel.getKpis(effectiveAgenceId),
      ]);

      // Pour chaque manager dans la liste, enrichir avec le détail équipe
      const enriched = await Promise.all(
        commissions.map(async c => {
          if (c.role_nom === 'manager') {
            const detail = await CommissionModel.getCommissionsManager(c.vendeur_id, mois);
            return { ...c, detail_manager: detail?.equipe };
          }
          return c;
        })
      );

      return res.status(200).json({
        success: true,
        data:    enriched,
        kpis,
        taux: await CommissionModel.getTaux(),
      });

    } catch (err) {
      logger.error('Erreur getCommissionsEquipe', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-38 : Détail manager (supplément équipe) ────────────────────────────
  async getDetailManager(req, res) {
    try {
      const managerId = parseInt(req.params.managerId);
      const mois      = req.query.mois || null;

      // Vérifier que c'est bien un manager
      const isManager = await CommissionModel.isManager(managerId);
      if (!isManager) {
        return res.status(400).json({
          success: false,
          message: 'Cet utilisateur n\'est pas un manager.',
        });
      }

      // MANAGER ne peut voir que son propre détail
      if (req.user.role_nom === 'manager' && req.user.id !== managerId) {
        return res.status(403).json({
          success: false, code: 'FORBIDDEN',
          message: 'Accès refusé — vous ne pouvez consulter que vos propres commissions.',
        });
      }

      const detail = await CommissionModel.getCommissionsManager(managerId, mois);
      if (!detail) {
        return res.status(404).json({ success: false, message: 'Manager introuvable.' });
      }

      return res.status(200).json({ success: true, data: detail });

    } catch (err) {
      logger.error('Erreur getDetailManager', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-39 : Modification des taux (SUPER_ADMIN) ──────────────────────────
  async updateTaux(req, res) {
    const { role_nom, taux_base, taux_supplement_equipe } = req.body;

    const ROLES_VALIDES = ['commercial', 'manager'];
    if (!role_nom || !ROLES_VALIDES.includes(role_nom)) {
      return res.status(400).json({
        success: false,
        message: `role_nom invalide. Valeurs : ${ROLES_VALIDES.join(', ')}`,
      });
    }

    // Validation des taux
    const erreurs = [];
    if (taux_base !== undefined) {
      const t = parseFloat(taux_base);
      if (isNaN(t) || t < 0) erreurs.push('taux_base doit être >= 0.');
      if (t > 100) erreurs.push('taux_base ne peut pas dépasser 100%.');
    }
    if (taux_supplement_equipe !== undefined) {
      const t = parseFloat(taux_supplement_equipe);
      if (isNaN(t) || t < 0) erreurs.push('taux_supplement_equipe doit être >= 0.');
      if (role_nom !== 'manager' && t > 0) {
        erreurs.push('taux_supplement_equipe ne s\'applique qu\'au rôle manager.');
      }
    }
    if (erreurs.length) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', errors: erreurs });
    }

    try {
      const anciensTaux = await CommissionModel.getTaux();

      await CommissionModel.updateTaux(role_nom, {
        taux_base:              taux_base !== undefined ? parseFloat(taux_base) : undefined,
        taux_supplement_equipe: taux_supplement_equipe !== undefined
          ? parseFloat(taux_supplement_equipe) : undefined,
      });

      await require('../models/Log').create({
        action:     'commission_taux_updated',
        user_id:    req.user.id,
        details:    {
          role_nom,
          avant: {
            taux_base:              anciensTaux[role_nom]?.taux_base,
            taux_supplement_equipe: anciensTaux[role_nom]?.taux_supplement_equipe,
          },
          apres: { taux_base, taux_supplement_equipe },
        },
        ip_address: req.ip,
      });

      logger.info('Taux commission mis à jour', { role_nom, taux_base, taux_supplement_equipe, by: req.user.id });

      const nouveauxTaux = await CommissionModel.getTaux();
      return res.status(200).json({
        success: true,
        message: `Taux mis à jour pour le rôle ${role_nom}.`,
        data:    nouveauxTaux[role_nom],
      });

    } catch (err) {
      logger.error('Erreur updateTaux', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Consultation des taux actuels ─────────────────────────────────────────
  async getTaux(req, res) {
    try {
      const taux = await CommissionModel.getTaux();
      return res.status(200).json({ success: true, data: taux });
    } catch (err) {
      logger.error('Erreur getTaux', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-40 : Export historique commissions ────────────────────────────────
  async exportHistorique(req, res) {
    try {
      // Un commercial exporte ses propres commissions
      // Un admin/manager peut exporter celles de n'importe qui
      const targetId = req.params.vendeurId
        ? parseInt(req.params.vendeurId)
        : req.user.id;

      // COMMERCIAL ne peut exporter que ses propres données
      if (req.user.role_nom === 'commercial' && targetId !== req.user.id) {
        return res.status(403).json({
          success: false, code: 'FORBIDDEN',
          message: 'Vous ne pouvez exporter que vos propres commissions.',
        });
      }

      const nbMois    = parseInt(req.query.mois) || 12;
      const historique = await CommissionModel.getHistoriqueMensuel(targetId, nbMois);
      const total_comm = historique.reduce((s, m) => s + parseFloat(m.commission || 0), 0);
      const total_base = historique.reduce((s, m) => s + parseFloat(m.base_calcul || 0), 0);

      await require('../models/Log').create({
        action:  'commissions_export',
        user_id: req.user.id,
        details: { target_vendeur_id: targetId, nb_mois: nbMois },
        ip_address: req.ip,
      });

      return res.status(200).json({
        success:      true,
        message:      `Historique des ${nbMois} derniers mois exporté.`,
        data: {
          vendeur_id:      targetId,
          nb_mois:         nbMois,
          generated_at:    new Date().toISOString(),
          historique,
          totaux: {
            base_calcul:        Math.round(total_base * 100) / 100,
            total_commissions:  Math.round(total_comm * 100) / 100,
          },
        },
      });

    } catch (err) {
      logger.error('Erreur exportHistorique', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Simulation taux (sans enregistrer) — UC-43 ───────────────────────────
  async simulerTaux(req, res) {
    try {
      const { taux_commercial, taux_supplement_manager, agence_id } = req.query;

      const commissions = await CommissionModel.getCommissions({ agence_id: agence_id || null });

      const tauxCom   = parseFloat(taux_commercial)        || 6.5;
      const tauxSuppl = parseFloat(taux_supplement_manager) || 1.5;

      // Recalculer avec les taux simulés
      const simules = commissions.map(c => {
        const commBase = Math.round(c.base_calcul * tauxCom / 100 * 100) / 100;

        if (c.role_nom === 'manager') {
          const totalEquipe = commissions
            .filter(x => x.role_nom === 'commercial' && x.agence_id === c.agence_id)
            .reduce((s, x) => s + Math.round(x.base_calcul * tauxCom / 100 * 100) / 100, 0);
          const suppl = Math.round(totalEquipe * tauxSuppl / 100 * 100) / 100;
          return {
            ...c,
            simule: {
              commission_base: commBase,
              supplement:      suppl,
              total:           commBase + suppl,
              taux_com:        tauxCom,
              taux_suppl:      tauxSuppl,
            },
          };
        }
        return {
          ...c,
          simule: { commission_base: commBase, supplement: 0, total: commBase, taux_com: tauxCom },
        };
      });

      return res.status(200).json({
        success:    true,
        simulation: true,
        note:       'Ces données sont une simulation — aucun taux n\'a été modifié.',
        data:       simules,
      });

    } catch (err) {
      logger.error('Erreur simulerTaux', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },
};

module.exports = CommissionsController;
