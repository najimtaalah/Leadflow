'use strict';

const FinancementModel = require('../models/Financement');
const DossierModel     = require('../models/Dossier');
const logger           = require('../utils/logger');

// Rôles qui peuvent modifier le financement après validation
const ROLES_ADMIN   = ['super_admin', 'role_admin'];
const ROLES_WRITE   = ['super_admin', 'role_admin', 'gestionnaire'];
const ROLES_READ_FIN= ['super_admin', 'role_admin', 'gestionnaire', 'commercial'];

function role(req) {
  return req.user?.role_nom || req.user?.role || '';
}

function sendError(res, err) {
  const codes = { NOT_FOUND: 404, VALIDATION_ERROR: 400, FORBIDDEN: 403,
                  ALREADY_VALIDATED: 409, NOT_VALIDATED: 409, INVALID_TRANSITION: 422 };
  const status = codes[err.code] || 500;
  if (status === 500) logger.error('[Financement]', err.message, err);
  return res.status(status).json({ success: false, code: err.code || 'ERROR', message: err.message });
}

const FinancementController = {

  // GET /api/dossiers/:dossierId/financement
  async get(req, res) {
    try {
      const dossierId = parseInt(req.params.dossierId);
      if (!ROLES_READ_FIN.includes(role(req)))
        return res.status(403).json({ success: false, message: 'Accès refusé' });

      // Commercial : propre dossier uniquement
      if (role(req) === 'commercial') {
        const dossier = await DossierModel.findById(dossierId);
        if (!dossier || dossier.vendeur_id !== req.user.id)
          return res.status(403).json({ success: false, message: 'Accès refusé' });
      }

      const financement = await FinancementModel.findByDossier(dossierId);
      return res.json({ success: true, data: financement });
    } catch (err) { return sendError(res, err); }
  },

  // POST /api/dossiers/:dossierId/financement
  async create(req, res) {
    try {
      const dossierId = parseInt(req.params.dossierId);
      if (!ROLES_WRITE.includes(role(req)))
        return res.status(403).json({ success: false, message: 'Accès refusé' });

      const existing = await FinancementModel.findByDossier(dossierId);
      if (existing)
        return res.status(409).json({ success: false, code: 'ALREADY_EXISTS', message: 'Financement déjà créé pour ce dossier' });

      const id = await FinancementModel.create({ ...req.body, dossier_id: dossierId, created_by: req.user.id });
      logger.info('[Financement] Créé', { dossierId, by: req.user.id });
      return res.status(201).json({ success: true, data: { id } });
    } catch (err) { return sendError(res, err); }
  },

  // PATCH /api/dossiers/:dossierId/financement
  async update(req, res) {
    try {
      const dossierId = parseInt(req.params.dossierId);
      const financement = await FinancementModel.findByDossier(dossierId);
      if (!financement) return res.status(404).json({ success: false, message: 'Financement introuvable' });

      // Après validation, seuls Admin/Super Admin peuvent modifier
      if (financement.validated_at && !ROLES_ADMIN.includes(role(req)))
        return res.status(403).json({ success: false, message: 'Modification après validation réservée aux Admin/Super Admin' });
      if (!financement.validated_at && !ROLES_WRITE.includes(role(req)))
        return res.status(403).json({ success: false, message: 'Accès refusé' });

      await FinancementModel.update(dossierId, req.body, req.user.id);
      logger.info('[Financement] Mis à jour', { dossierId, by: req.user.id });
      return res.json({ success: true, message: 'Financement mis à jour' });
    } catch (err) { return sendError(res, err); }
  },

  // POST /api/dossiers/:dossierId/financement/valider
  async valider(req, res) {
    try {
      const dossierId = parseInt(req.params.dossierId);
      if (!ROLES_ADMIN.includes(role(req)))
        return res.status(403).json({ success: false, message: 'Validation réservée aux Admin/Super Admin' });

      await FinancementModel.validerBloc(dossierId, req.user.id);
      logger.info('[Financement] Bloc validé', { dossierId, by: req.user.id });
      return res.json({ success: true, message: 'Bloc financier validé — statut initialisé à "À facturer"' });
    } catch (err) { return sendError(res, err); }
  },

  // POST /api/dossiers/:dossierId/financement/statut
  async changerStatut(req, res) {
    try {
      const dossierId = parseInt(req.params.dossierId);
      if (!ROLES_WRITE.includes(role(req)))
        return res.status(403).json({ success: false, message: 'Accès refusé' });

      const result = await FinancementModel.changerStatut(
        dossierId, req.body, req.user.id, role(req)
      );
      logger.info('[Financement] Statut changé', { dossierId, ...result, by: req.user.id });
      return res.json({ success: true, data: result });
    } catch (err) { return sendError(res, err); }
  },

  // GET /api/facturation
  async listFacturation(req, res) {
    try {
      if (!ROLES_WRITE.includes(role(req)))
        return res.status(403).json({ success: false, message: 'Accès refusé' });

      const {
        statuts, type_financement,
        date_facturation_debut, date_facturation_fin,
        date_paiement_debut, date_paiement_fin,
        formation_id, commercial_id,
        montant_min, montant_max,
        limit = 50, offset = 0,
      } = req.query;

      const result = await FinancementModel.listFacturation({
        statuts:                statuts ? statuts.split(',') : undefined,
        type_financement:       type_financement ? type_financement.split(',') : undefined,
        date_facturation_debut, date_facturation_fin,
        date_paiement_debut,    date_paiement_fin,
        formation_id,           commercial_id,
        montant_min:            montant_min != null ? parseFloat(montant_min) : undefined,
        montant_max:            montant_max != null ? parseFloat(montant_max) : undefined,
        limit:                  parseInt(limit),
        offset:                 parseInt(offset),
      });

      return res.json({ success: true, ...result });
    } catch (err) { return sendError(res, err); }
  },

  // GET /api/facturation/export/dossiers-facturables
  async exportDossiersFacturables(req, res) {
    try {
      if (!ROLES_ADMIN.includes(role(req)))
        return res.status(403).json({ success: false, message: 'Export réservé aux Admin/Super Admin' });

      const { statuts, type_financement, date_facturation_debut, date_facturation_fin } = req.query;
      const rows = await FinancementModel.exportDossiersFacturables({
        statuts:          statuts ? statuts.split(',') : undefined,
        type_financement: type_financement ? type_financement.split(',') : undefined,
        date_facturation_debut, date_facturation_fin,
      });

      const csv = _buildCsv([
        'identifiant_dossier','nom_apprenant','formation','type_financement','organisme',
        'identifiant_financeur','montant_total','montant_pris_en_charge','reste_a_charge',
        'statut_facturation','date_facturation','date_paiement','reference_facture','commercial',
      ], rows);

      const filename = `export_dossiers_facturables_${_today()}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send('﻿' + csv); // BOM UTF-8 pour Excel
    } catch (err) { return sendError(res, err); }
  },

  // GET /api/facturation/export/rapport-mensuel
  async exportRapportMensuel(req, res) {
    try {
      if (!ROLES_ADMIN.includes(role(req)))
        return res.status(403).json({ success: false, message: 'Export réservé aux Admin/Super Admin' });

      const mois  = parseInt(req.query.mois);
      const annee = parseInt(req.query.annee);
      if (!mois || !annee || mois < 1 || mois > 12)
        return res.status(400).json({ success: false, message: 'Paramètres mois (1-12) et annee requis' });

      const rows = await FinancementModel.exportRapportMensuel(mois, annee);

      const csv = _buildCsv([
        'type_financement','nb_dossiers','montant_total','montant_pris_en_charge',
        'reste_a_charge_total','nb_payes','nb_factures_non_payes','nb_litiges','montant_avoirs',
      ], rows);

      const filename = `rapport_mensuel_${annee}${String(mois).padStart(2,'0')}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send('﻿' + csv);
    } catch (err) { return sendError(res, err); }
  },
};

// ── Helpers CSV (RM-L7-12) ────────────────────────────────────────────────────
function _buildCsv(headers, rows) {
  const fmt = (v) => {
    if (v == null) return '';
    if (v instanceof Date) return v.toLocaleDateString('fr-FR');
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v))
      return v.split('T')[0].split('-').reverse().join('/');
    if (typeof v === 'number' || !isNaN(parseFloat(v)))
      return String(parseFloat(v)).replace('.', ',');
    // Échapper les guillemets et encadrer si virgule/point-virgule
    const s = String(v).replace(/"/g, '""');
    return s.includes(';') || s.includes('"') ? `"${s}"` : s;
  };

  const lines = [headers.join(';')];
  for (const row of rows) {
    lines.push(headers.map(h => fmt(row[h])).join(';'));
  }
  return lines.join('\r\n');
}

function _today() {
  return new Date().toISOString().split('T')[0].replace(/-/g, '');
}

module.exports = FinancementController;
