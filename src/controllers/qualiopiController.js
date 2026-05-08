'use strict';

const db                    = require('../config/database');
const EmargementModel       = require('../models/Emargement');
const EvaluationQualiopiModel = require('../models/EvaluationQualiopi');
const SatisfactionQualiopiModel = require('../models/SatisfactionQualiopi');
const DocumentQualiopiModel = require('../models/DocumentQualiopi');
const LogModel              = require('../models/Log');
const pdfService            = require('../services/pdfService');
const logger                = require('../utils/logger');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSession(sessionId) {
  const [[s]] = await db.query(
    `SELECT sf.*, f.nom AS formation_nom, f.duree_heures, f.config_pedagogique
     FROM sessions_formation sf
     JOIN formations f ON f.id = sf.formation_id
     WHERE sf.id = ?`,
    [sessionId]
  );
  return s || null;
}

async function getDossier(dossierId) {
  const [[d]] = await db.query(
    'SELECT id, nom, prenom, email, telephone, cout_total_formation FROM dossiers WHERE id = ?',
    [dossierId]
  );
  return d || null;
}

// ── Indicateur 3 — Émargement ─────────────────────────────────────────────────

const QualiopiController = {

  // GET /api/qualiopi/sessions/:sessionId/emargements
  async getEmargements(req, res) {
    const sessionId = parseInt(req.params.sessionId);
    try {
      const session = await getSession(sessionId);
      if (!session) return res.status(404).json({ success: false, message: 'Session introuvable.' });

      const rows = await EmargementModel.findBySession(sessionId);
      const stats = await EmargementModel.statsSession(sessionId);
      return res.json({ success: true, data: { session, emargements: rows, stats } });
    } catch (err) {
      logger.error('[Qualiopi] getEmargements', err.message);
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // POST /api/qualiopi/sessions/:sessionId/emargements
  // body: { dossier_id, date_seance, present, heure_debut?, heure_fin?, motif_absence? }
  async upsertEmargement(req, res) {
    const sessionId = parseInt(req.params.sessionId);
    const { dossier_id, date_seance, present, heure_debut, heure_fin, motif_absence } = req.body;

    if (!dossier_id || !date_seance) {
      return res.status(400).json({ success: false, message: 'dossier_id et date_seance requis.' });
    }

    try {
      await EmargementModel.upsert({
        dossier_id,
        session_id: sessionId,
        date_seance,
        heure_debut,
        heure_fin,
        present: !!present,
        motif_absence,
        signe_par_user: req.user.id,
      });

      await LogModel.create({
        action:  'emargement_saisi',
        user_id: req.user.id,
        details: { dossier_id, session_id: sessionId, date_seance, present },
        ip_address: req.ip,
      });

      return res.json({ success: true, message: 'Émargement enregistré.' });
    } catch (err) {
      logger.error('[Qualiopi] upsertEmargement', err.message);
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // POST /api/qualiopi/sessions/:sessionId/emargements/bulk
  // body: { date_seance, apprenants: [{ dossier_id, present, motif_absence? }] }
  async upsertEmargementBulk(req, res) {
    const sessionId = parseInt(req.params.sessionId);
    const { date_seance, apprenants } = req.body;

    if (!date_seance || !Array.isArray(apprenants) || apprenants.length === 0) {
      return res.status(400).json({ success: false, message: 'date_seance et apprenants[] requis.' });
    }

    try {
      for (const a of apprenants) {
        await EmargementModel.upsert({
          dossier_id:    a.dossier_id,
          session_id:    sessionId,
          date_seance,
          present:       !!a.present,
          motif_absence: a.motif_absence || null,
          signe_par_user: req.user.id,
        });
      }

      await LogModel.create({
        action:  'emargement_bulk',
        user_id: req.user.id,
        details: { session_id: sessionId, date_seance, nb: apprenants.length },
        ip_address: req.ip,
      });

      return res.json({ success: true, message: `${apprenants.length} émargement(s) enregistré(s).` });
    } catch (err) {
      logger.error('[Qualiopi] upsertEmargementBulk', err.message);
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // GET /api/qualiopi/sessions/:sessionId/emargements/pdf
  async getFeuilleEmargementPDF(req, res) {
    const sessionId = parseInt(req.params.sessionId);
    try {
      const session = await getSession(sessionId);
      if (!session) return res.status(404).json({ success: false, message: 'Session introuvable.' });

      const rows = await EmargementModel.findBySession(sessionId);

      // Construire la liste des apprenants avec leurs émargements
      const appMap = {};
      for (const r of rows) {
        if (!appMap[r.dossier_id]) {
          appMap[r.dossier_id] = {
            dossier_id: r.dossier_id,
            nom: r.apprenant_nom,
            prenom: r.apprenant_prenom,
            emargements: [],
          };
        }
        const dateStr = r.date_seance instanceof Date
          ? r.date_seance.toISOString().slice(0, 10)
          : String(r.date_seance).slice(0, 10);
        appMap[r.dossier_id].emargements.push({ date_seance: dateStr, present: r.present, motif_absence: r.motif_absence });
      }
      const apprenants = Object.values(appMap);

      // Dates distinctes (toujours des strings YYYY-MM-DD)
      const datesSet = new Set(rows.map(r =>
        r.date_seance instanceof Date
          ? r.date_seance.toISOString().slice(0, 10)
          : String(r.date_seance).slice(0, 10)
      ));
      const dates = Array.from(datesSet).sort();

      const pdfBuffer = await pdfService.generateFeuilleEmargement({ session, apprenants, dates });

      const filename = `emargement_${session.code_session}_${new Date().toISOString().slice(0, 10)}.pdf`;
      res.set({
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      pdfBuffer.length,
      });
      return res.send(pdfBuffer);
    } catch (err) {
      logger.error('[Qualiopi] getFeuilleEmargementPDF', err.message);
      return res.status(500).json({ success: false, message: 'Erreur génération PDF.' });
    }
  },

  // ── Indicateur 5 — Évaluations ──────────────────────────────────────────────

  // GET /api/qualiopi/dossiers/:dossierId/evaluations?sessionId=X
  async getEvaluations(req, res) {
    const dossierId = parseInt(req.params.dossierId);
    const sessionId = req.query.sessionId ? parseInt(req.query.sessionId) : null;
    try {
      if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId requis.' });
      const rows = await EvaluationQualiopiModel.findByDossierAndSession(dossierId, sessionId);
      return res.json({ success: true, data: rows });
    } catch (err) {
      logger.error('[Qualiopi] getEvaluations', err.message);
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // POST /api/qualiopi/dossiers/:dossierId/evaluations
  // body: { session_id, type_eval, reponses, score_total?, commentaire? }
  async upsertEvaluation(req, res) {
    const dossierId = parseInt(req.params.dossierId);
    const { session_id, type_eval, reponses, score_total, commentaire } = req.body;

    if (!session_id || !type_eval || !reponses) {
      return res.status(400).json({ success: false, message: 'session_id, type_eval et reponses requis.' });
    }
    if (!['positionnement', 'post_formation'].includes(type_eval)) {
      return res.status(400).json({ success: false, message: 'type_eval invalide.' });
    }

    try {
      await EvaluationQualiopiModel.upsert({
        dossier_id:  dossierId,
        session_id,
        type_eval,
        reponses,
        score_total: score_total ?? null,
        commentaire,
        created_by:  req.user.id,
      });

      await LogModel.create({
        action:  'evaluation_saisie',
        user_id: req.user.id,
        details: { dossier_id: dossierId, session_id, type_eval, score_total },
        ip_address: req.ip,
      });

      return res.json({ success: true, message: 'Évaluation enregistrée.' });
    } catch (err) {
      logger.error('[Qualiopi] upsertEvaluation', err.message);
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // GET /api/qualiopi/sessions/:sessionId/evaluations/stats
  async getEvaluationsStats(req, res) {
    const sessionId = parseInt(req.params.sessionId);
    try {
      const stats = await EvaluationQualiopiModel.statsSession(sessionId);
      return res.json({ success: true, data: stats });
    } catch (err) {
      logger.error('[Qualiopi] getEvaluationsStats', err.message);
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Indicateur 6 — Satisfaction ─────────────────────────────────────────────

  // GET /api/qualiopi/dossiers/:dossierId/satisfaction?sessionId=X
  async getSatisfaction(req, res) {
    const dossierId = parseInt(req.params.dossierId);
    const sessionId = req.query.sessionId ? parseInt(req.query.sessionId) : null;
    try {
      if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId requis.' });
      const row = await SatisfactionQualiopiModel.findByDossierAndSession(dossierId, sessionId);
      return res.json({ success: true, data: row });
    } catch (err) {
      logger.error('[Qualiopi] getSatisfaction', err.message);
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // POST /api/qualiopi/dossiers/:dossierId/satisfaction
  async upsertSatisfaction(req, res) {
    const dossierId = parseInt(req.params.dossierId);
    const { session_id, note_contenu, note_formateur, note_organisation, note_locaux, note_globale, commentaire_libre, recommande } = req.body;

    if (!session_id) {
      return res.status(400).json({ success: false, message: 'session_id requis.' });
    }

    const notes = [note_contenu, note_formateur, note_organisation, note_locaux, note_globale].filter(n => n != null);
    if (notes.some(n => n < 1 || n > 5)) {
      return res.status(400).json({ success: false, message: 'Les notes doivent être entre 1 et 5.' });
    }

    try {
      await SatisfactionQualiopiModel.upsert({
        dossier_id: dossierId,
        session_id,
        note_contenu, note_formateur, note_organisation, note_locaux, note_globale,
        commentaire_libre,
        recommande,
      });

      await LogModel.create({
        action:  'satisfaction_saisie',
        user_id: req.user.id,
        details: { dossier_id: dossierId, session_id },
        ip_address: req.ip,
      });

      return res.json({ success: true, message: 'Satisfaction enregistrée.' });
    } catch (err) {
      logger.error('[Qualiopi] upsertSatisfaction', err.message);
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // GET /api/qualiopi/sessions/:sessionId/satisfaction/stats
  async getSatisfactionStats(req, res) {
    const sessionId = parseInt(req.params.sessionId);
    try {
      const stats = await SatisfactionQualiopiModel.statsSession(sessionId);
      return res.json({ success: true, data: stats });
    } catch (err) {
      logger.error('[Qualiopi] getSatisfactionStats', err.message);
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // GET /api/qualiopi/formations/:formationId/satisfaction/stats
  async getSatisfactionStatsByFormation(req, res) {
    const formationId = parseInt(req.params.formationId);
    try {
      const stats = await SatisfactionQualiopiModel.statsByFormation(formationId);
      return res.json({ success: true, data: stats });
    } catch (err) {
      logger.error('[Qualiopi] getSatisfactionStatsByFormation', err.message);
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Documents réglementaires ──────────────────────────────────────────────────

  // GET /api/qualiopi/dossiers/:dossierId/documents
  async getDocuments(req, res) {
    const dossierId = parseInt(req.params.dossierId);
    try {
      const docs = await DocumentQualiopiModel.findByDossier(dossierId);
      return res.json({ success: true, data: docs });
    } catch (err) {
      logger.error('[Qualiopi] getDocuments', err.message);
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // POST /api/qualiopi/dossiers/:dossierId/documents/attestation
  async generateAttestation(req, res) {
    const dossierId = parseInt(req.params.dossierId);
    const { session_id } = req.body;

    if (!session_id) return res.status(400).json({ success: false, message: 'session_id requis.' });

    try {
      const [dossier, session] = await Promise.all([getDossier(dossierId), getSession(session_id)]);
      if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });
      if (!session) return res.status(404).json({ success: false, message: 'Session introuvable.' });

      const pdfBuffer = await pdfService.generateAttestation({
        dossier,
        session,
        formation: { nom: session.formation_nom, duree_heures: session.duree_heures },
      });

      await DocumentQualiopiModel.create({
        dossier_id:    dossierId,
        session_id,
        type_document: 'attestation',
        titre:         `Attestation — ${dossier.nom} ${dossier.prenom} — ${session.code_session}`,
        genere_par:    req.user.id,
      });

      await LogModel.create({
        action:  'document_genere',
        user_id: req.user.id,
        details: { type: 'attestation', dossier_id: dossierId, session_id },
        ip_address: req.ip,
      });

      const filename = `attestation_${dossier.nom}_${session.code_session}.pdf`;
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` });
      return res.send(pdfBuffer);
    } catch (err) {
      logger.error('[Qualiopi] generateAttestation', err.message);
      return res.status(500).json({ success: false, message: 'Erreur génération PDF.' });
    }
  },

  // POST /api/qualiopi/dossiers/:dossierId/documents/convention
  async generateConvention(req, res) {
    const dossierId = parseInt(req.params.dossierId);
    const { session_id } = req.body;

    if (!session_id) return res.status(400).json({ success: false, message: 'session_id requis.' });

    try {
      const [dossier, session] = await Promise.all([getDossier(dossierId), getSession(session_id)]);
      if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });
      if (!session) return res.status(404).json({ success: false, message: 'Session introuvable.' });

      const pdfBuffer = await pdfService.generateConvention({
        dossier,
        session,
        formation: { nom: session.formation_nom, duree_heures: session.duree_heures },
      });

      await DocumentQualiopiModel.create({
        dossier_id:    dossierId,
        session_id,
        type_document: 'convention',
        titre:         `Convention — ${dossier.nom} ${dossier.prenom} — ${session.code_session}`,
        genere_par:    req.user.id,
      });

      await LogModel.create({
        action:  'document_genere',
        user_id: req.user.id,
        details: { type: 'convention', dossier_id: dossierId, session_id },
        ip_address: req.ip,
      });

      const filename = `convention_${dossier.nom}_${session.code_session}.pdf`;
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` });
      return res.send(pdfBuffer);
    } catch (err) {
      logger.error('[Qualiopi] generateConvention', err.message);
      return res.status(500).json({ success: false, message: 'Erreur génération PDF.' });
    }
  },

  // POST /api/qualiopi/dossiers/:dossierId/documents/convocation
  async generateConvocation(req, res) {
    const dossierId = parseInt(req.params.dossierId);
    const { session_id } = req.body;

    if (!session_id) return res.status(400).json({ success: false, message: 'session_id requis.' });

    try {
      const [dossier, session] = await Promise.all([getDossier(dossierId), getSession(session_id)]);
      if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });
      if (!session) return res.status(404).json({ success: false, message: 'Session introuvable.' });

      const pdfBuffer = await pdfService.generateConvocation({
        dossier,
        session,
        formation: { nom: session.formation_nom, duree_heures: session.duree_heures },
      });

      await DocumentQualiopiModel.create({
        dossier_id:    dossierId,
        session_id,
        type_document: 'convocation',
        titre:         `Convocation — ${dossier.nom} ${dossier.prenom} — ${session.code_session}`,
        genere_par:    req.user.id,
      });

      const filename = `convocation_${dossier.nom}_${session.code_session}.pdf`;
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` });
      return res.send(pdfBuffer);
    } catch (err) {
      logger.error('[Qualiopi] generateConvocation', err.message);
      return res.status(500).json({ success: false, message: 'Erreur génération PDF.' });
    }
  },

  // ── Tableau de bord Qualiopi ─────────────────────────────────────────────────

  // GET /api/qualiopi/dashboard
  async getDashboard(req, res) {
    try {
      const [satisf, eval_, presence] = await Promise.all([
        db.query(`
          SELECT
            COUNT(*)                            AS total_repondants,
            ROUND(AVG(note_globale),2)          AS avg_note_globale,
            ROUND(
              (AVG(note_contenu)+AVG(note_formateur)+AVG(note_organisation)+
               AVG(note_locaux)+AVG(note_globale)) / 5 * 20, 1
            )                                   AS taux_satisfaction_pct
          FROM satisfactions_qualiopi
          WHERE completed_at IS NOT NULL`),
        db.query(`
          SELECT type_eval, COUNT(*) AS nb, ROUND(AVG(score_total),1) AS score_moyen
          FROM evaluations_qualiopi
          WHERE completed_at IS NOT NULL
          GROUP BY type_eval`),
        db.query(`
          SELECT
            ROUND(SUM(present) / COUNT(*) * 100, 1) AS taux_presence_global
          FROM emargements`),
      ]);

      return res.json({
        success: true,
        data: {
          satisfaction: satisf[0][0] || {},
          evaluations:  eval_[0],
          presence:     presence[0][0] || {},
        },
      });
    } catch (err) {
      logger.error('[Qualiopi] getDashboard', err.message);
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },
};

module.exports = QualiopiController;
