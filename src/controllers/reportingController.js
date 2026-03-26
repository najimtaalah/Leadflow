'use strict';

const ReportingModel = require('../models/Reporting');
const LogModel       = require('../models/Log');
const logger         = require('../utils/logger');

/**
 * Filtre agence selon le rôle
 */
function getAgenceFilter(user, queryAgenceId = null) {
  if (['super_admin', 'role_admin'].includes(user.role_nom)) {
    return queryAgenceId ? parseInt(queryAgenceId) : null;
  }
  return user.agence_id;
}

const ReportingController = {

  // ── UC-41 : Performance Commerciale ───────────────────────────────────────
  async getPerformance(req, res) {
    try {
      const agenceId = getAgenceFilter(req.user, req.query.agence_id);
      const mois     = req.query.mois || null;

      const [kpis, parCommercial, evolution, sources] = await Promise.all([
        ReportingModel.getKpisPerformance(agenceId, mois),
        ReportingModel.getPerformanceParCommercial(agenceId, mois),
        ReportingModel.getEvolutionMensuelle(6, agenceId),
        ReportingModel.getRepartitionSources(agenceId, mois),
      ]);

      return res.status(200).json({
        success: true,
        data: { kpis, par_commercial: parCommercial, evolution_mensuelle: evolution, sources },
      });
    } catch (err) {
      logger.error('Erreur getPerformance', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-42 : Point Financier ────────────────────────────────────────────────
  async getPointFinancier(req, res) {
    try {
      const agenceId = getAgenceFilter(req.user, req.query.agence_id);
      const mois     = req.query.mois || null;
      const data     = await ReportingModel.getPointFinancier(agenceId, mois);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      logger.error('Erreur getPointFinancier reporting', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-43 : Tableau Commissions (avec simulation optionnelle) ─────────────
  async getCommissions(req, res) {
    try {
      const agenceId = getAgenceFilter(req.user, req.query.agence_id);
      const { taux_simule, suppl_simule } = req.query;

      const data = await ReportingModel.getTableauCommissions(agenceId);

      // Simulation de taux si paramètres fournis (UC-43)
      if (taux_simule || suppl_simule) {
        const tauxCom   = parseFloat(taux_simule)  || data.taux.commercial?.taux_base   || 6.5;
        const tauxSuppl = parseFloat(suppl_simule) || data.taux.manager?.taux_supplement_equipe || 1.5;

        data.commissions = data.commissions.map(c => {
          const commBase = Math.round(c.base_calcul * tauxCom / 100 * 100) / 100;
          if (c.role_nom === 'manager') {
            const totalEquipe = data.commissions
              .filter(x => x.role_nom === 'commercial' && x.agence_id === c.agence_id)
              .reduce((s, x) => s + Math.round(x.base_calcul * tauxCom / 100 * 100) / 100, 0);
            const suppl = Math.round(totalEquipe * tauxSuppl / 100 * 100) / 100;
            return { ...c, commission_simulee: commBase + suppl, taux_simule: tauxCom };
          }
          return { ...c, commission_simulee: commBase, taux_simule: tauxCom };
        });
        data.simulation = true;
        data.note       = 'Simulation uniquement — les taux réels ne sont pas modifiés.';
      }

      return res.status(200).json({ success: true, data });
    } catch (err) {
      logger.error('Erreur getCommissions reporting', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-44 : Export PDF/Excel d'un rapport ─────────────────────────────────
  async exportRapport(req, res) {
    const { type } = req.params;
    const TYPES_VALIDES = ['performance', 'financier', 'commissions'];

    if (!TYPES_VALIDES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Type de rapport invalide. Valeurs : ${TYPES_VALIDES.join(', ')}`,
      });
    }

    try {
      const agenceId = getAgenceFilter(req.user, req.query.agence_id);
      const mois     = req.query.mois || null;
      const format   = req.query.format || 'json'; // json | pdf | excel

      let exportData;
      switch (type) {
        case 'performance':
          exportData = await ReportingModel.buildExportPerformance(agenceId, mois);
          break;
        case 'financier':
          exportData = await ReportingModel.buildExportFinancier(agenceId, mois);
          break;
        case 'commissions':
          exportData = await ReportingModel.buildExportCommissions(agenceId, mois);
          break;
      }

      // Sauvegarder la demande d'export dans rapports_config
      await ReportingModel.saveRapportConfig({
        type,
        params: { agence_id: agenceId, mois, format },
        user_id: req.user.id,
      });

      await LogModel.create({
        action:     `export_rapport_${type}`,
        user_id:    req.user.id,
        details:    { type, mois, agence_id: agenceId, format },
        ip_address: req.ip,
      });

      // En production : générer PDF avec pdfkit / Excel avec exceljs
      // Ici on retourne JSON (le frontend génère le fichier côté client)
      if (format === 'pdf' || format === 'excel') {
        // TODO: intégrer pdfkit ou exceljs
        // return res.download(filePath);
        logger.info(`Export ${format} demandé`, { type, agenceId, mois });
      }

      return res.status(200).json({
        success:     true,
        format,
        message:     `Rapport "${type}" prêt à l'export.`,
        data:        exportData,
      });

    } catch (err) {
      logger.error('Erreur exportRapport', { error: err.message, type });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── KPIs Gestion Dossiers (Dashboard sous-menu) ──────────────────────────
  async getKpisGestion(req, res) {
    try {
      const agenceId = getAgenceFilter(req.user, req.query.agence_id);
      const data     = await ReportingModel.getKpisGestion(agenceId);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      logger.error('Erreur getKpisGestion', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Tableau de bord Reporting (vue agrégée) ───────────────────────────────
  async getDashboardReporting(req, res) {
    try {
      const agenceId = getAgenceFilter(req.user, req.query.agence_id);

      const [kpisPerf, kpisComm, pointFin] = await Promise.all([
        ReportingModel.getKpisPerformance(agenceId),
        require('../models/Commission').getKpis(agenceId),
        ReportingModel.getPointFinancier(agenceId),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          performance:    kpisPerf,
          commissions:    kpisComm,
          point_financier: pointFin.situation,
        },
      });
    } catch (err) {
      logger.error('Erreur getDashboardReporting', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },
};

module.exports = ReportingController;
