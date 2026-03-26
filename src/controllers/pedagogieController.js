'use strict';

const ResultatCMAModel  = require('../models/ResultatCMA');
const InscriptionModel  = require('../models/Inscription');
const AgentCMAService   = require('../services/agentCMAService');
const LogModel          = require('../models/Log');
const logger            = require('../utils/logger');
const db                = require('../config/database');

// Map type_session → colonne FK sur dossiers
const FK_COLUMN = {
  cours:  'session_cours_id',
  edof:   'session_edof_id',
  examen: 'examen_id',
};

const PedagogieController = {

  // ── Assigner une session à un dossier (remplace UC-19) ─────────────────
  // PATCH /api/pedagogie/dossiers/:dossierId/sessions
  // body: { session_id }
  // La colonne FK est déterminée par le type_session de la session choisie
  async inscrire(req, res) {
    const dossierId = parseInt(req.params.dossierId);
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        code:    'VALIDATION_ERROR',
        message: 'session_id est requis.',
      });
    }

    try {
      // Vérifier le dossier
      const [[dossier]] = await db.query(
        'SELECT id FROM dossiers WHERE id = ?', [dossierId]
      );
      if (!dossier) {
        return res.status(404).json({ success: false, message: 'Dossier introuvable.' });
      }

      // Vérifier la session et sa capacité
      const [[session]] = await db.query(
        `SELECT s.id, s.code_session, s.type_session, s.capacite_max,
                f.config_pedagogique,
                (SELECT COUNT(*) FROM dossiers d
                 WHERE d.session_cours_id = s.id
                    OR d.session_edof_id  = s.id
                    OR d.examen_id        = s.id) AS inscrits
         FROM sessions_formation s
         JOIN formations f ON f.id = s.formation_id
         WHERE s.id = ?`,
        [session_id]
      );
      if (!session) {
        return res.status(404).json({ success: false, message: 'Session introuvable.' });
      }

      // Vérifier capacité
      if (session.capacite_max && session.inscrits >= session.capacite_max) {
        return res.status(409).json({
          success: false,
          code:    'SESSION_FULL',
          message: `Session complète (${session.inscrits}/${session.capacite_max}).`,
        });
      }

      // Déterminer la colonne FK selon le type de session
      const fkCol = FK_COLUMN[session.type_session];
      if (!fkCol) {
        return res.status(400).json({
          success: false,
          message: `Type de session inconnu : ${session.type_session}`,
        });
      }

      // Mettre à jour le dossier
      await db.query(
        `UPDATE dossiers SET ${fkCol} = ?, updated_at = NOW() WHERE id = ?`,
        [session_id, dossierId]
      );

      await LogModel.create({
        action:     'session_assigned',
        user_id:    req.user.id,
        details:    { dossier_id: dossierId, session_id, type_session: session.type_session },
        ip_address: req.ip,
      });

      return res.status(200).json({
        success: true,
        message: `Dossier assigné à la session ${session.code_session} (${session.type_session}).`,
        data:    { session_code: session.code_session, type_session: session.type_session },
      });

    } catch (err) {
      logger.error('Erreur assignation session', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Consulter les sessions d'un dossier ────────────────────────────────
  async getInscriptions(req, res) {
    try {
      const dossierId = parseInt(req.params.dossierId);
      const [[row]] = await db.query(
        `SELECT
           d.id,
           sc.id AS session_cours_id,   sc.code_session AS session_cours_code,
           sc.date_debut AS cours_debut, sc.date_fin AS cours_fin,
           se.id AS session_edof_id,    se.code_session AS session_edof_code,
           se.date_debut AS edof_debut,  se.date_fin AS edof_fin,
           ex.id AS examen_id,           ex.code_session AS examen_code,
           ex.date_debut AS examen_debut, ex.date_fin AS examen_fin
         FROM dossiers d
         LEFT JOIN sessions_formation sc ON sc.id = d.session_cours_id
         LEFT JOIN sessions_formation se ON se.id = d.session_edof_id
         LEFT JOIN sessions_formation ex ON ex.id = d.examen_id
         WHERE d.id = ?`,
        [dossierId]
      );
      if (!row) {
        return res.status(404).json({ success: false, message: 'Dossier introuvable.' });
      }
      return res.status(200).json({ success: true, data: row });
    } catch (err) {
      logger.error('Erreur getInscriptions', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Retirer une session d'un dossier ───────────────────────────────────
  async updateStatutInscription(req, res) {
    // Endpoint conservé pour compatibilité — redirige vers désassignation
    return res.status(410).json({
      success: false,
      message: 'Endpoint obsolète. Utilisez PATCH /api/dossiers/:id pour modifier les sessions.',
    });
  },

  // ── UC-20 : Synchronisation manuelle résultats CMA ─────────────────────
  async syncManuelle(req, res) {
    const { session_code, agence_id } = req.body;

    try {
      logger.info('Sync CMA manuelle déclenchée', {
        by: req.user.id, session_code, agence_id,
      });

      const rapport = await AgentCMAService.synchroniser('manuel', {
        sessionCode: session_code,
        agenceId:    agence_id || req.user.agence_id,
      });

      await LogModel.create({
        action:     'cma_sync_manuelle',
        user_id:    req.user.id,
        details:    { rapport_summary: {
          presentes:        rapport.apprenants_presentes,
          trouves:          rapport.resultats_trouves,
          en_attente:       rapport.en_attente,
          messages_envoyes: rapport.messages_envoyes,
          actions:          rapport.actions.length,
        }},
        ip_address: req.ip,
      });

      return res.status(200).json({
        success: true,
        message: `Synchronisation terminée — ${rapport.resultats_trouves} résultats trouvés.`,
        rapport,
      });

    } catch (err) {
      logger.error('Erreur sync CMA manuelle', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur synchronisation CMA.' });
    }
  },

  // ── Résultats CMA d'un dossier ─────────────────────────────────────────
  async getResultatsCMA(req, res) {
    try {
      const resultats = await ResultatCMAModel.findByDossier(
        parseInt(req.params.dossierId)
      );
      return res.status(200).json({ success: true, data: resultats });
    } catch (err) {
      logger.error('Erreur getResultatsCMA', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Résultats CMA d'une session complète ──────────────────────────────
  async getResultatsSession(req, res) {
    const { sessionCode } = req.params;
    try {
      const resultats = await ResultatCMAModel.findBySession(sessionCode);
      return res.status(200).json({
        success: true,
        data:    resultats,
        total:   resultats.length,
      });
    } catch (err) {
      logger.error('Erreur getResultatsSession', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Config et statistiques de synchronisation ─────────────────────────
  async getSyncConfig(req, res) {
    try {
      const config = await ResultatCMAModel.getSyncConfig();
      const stats  = await ResultatCMAModel.getLastSyncStats();
      return res.status(200).json({
        success: true,
        data:    { config, stats },
      });
    } catch (err) {
      logger.error('Erreur getSyncConfig', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-24 : Mise à jour config sync auto ──────────────────────────────
  async updateSyncConfig(req, res) {
    const { actif, frequence } = req.body;
    const FREQUENCES = ['nuit_06h', 'toutes_12h', 'toutes_6h'];

    if (frequence && !FREQUENCES.includes(frequence)) {
      return res.status(400).json({
        success: false,
        message: `Fréquence invalide. Valeurs : ${FREQUENCES.join(', ')}`,
      });
    }

    try {
      await db.query(
        `UPDATE config_sync_cma
         SET actif     = COALESCE(?, actif),
             frequence = COALESCE(?, frequence)
         WHERE id = 1`,
        [actif !== undefined ? (actif ? 1 : 0) : null, frequence || null]
      );

      await LogModel.create({
        action:  'cma_sync_config_updated',
        user_id: req.user.id,
        details: { actif, frequence },
        ip_address: req.ip,
      });

      return res.status(200).json({
        success: true,
        message: 'Configuration de synchronisation mise à jour.',
      });
    } catch (err) {
      logger.error('Erreur updateSyncConfig', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Liste des dossiers assignés à un examen ───────────────────────────
  async getPresentes(req, res) {
    const { session_code, agence_id } = req.query;
    try {
      const presentes = await InscriptionModel.findPresentes({
        sessionCode: session_code,
        agenceId:    agence_id || (
          ['super_admin','role_admin'].includes(req.user.role_nom)
            ? null
            : req.user.agence_id
        ),
      });
      return res.status(200).json({
        success: true,
        data:    presentes,
        total:   presentes.length,
      });
    } catch (err) {
      logger.error('Erreur getPresentes', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },
};

module.exports = PedagogieController;
