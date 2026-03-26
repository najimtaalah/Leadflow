'use strict';

const AgentCMAService  = require('../services/agentCMAService');
const ResultatCMAModel = require('../models/ResultatCMA');
const ollamaService    = require('../services/ollamaService');
const db               = require('../config/database');
const logger           = require('../utils/logger');

/* ──────────────────────────────────────────────────────────
   GET /api/agent/status
   Retourne : mode CMA, config sync, état Ollama, stats
   ────────────────────────────────────────────────────────── */
async function getStatus(req, res) {
  try {
    const [config, stats, ollamaOk, ollamaModels] = await Promise.all([
      ResultatCMAModel.getSyncConfig(),
      ResultatCMAModel.getLastSyncStats(),
      ollamaService.isAvailable(),
      ollamaService.listModels(),
    ]);

    const cmaMode = process.env.CMA_BASE_URL ? 'reel' : 'simulation';

    return res.json({
      success: true,
      data: {
        cma: {
          mode:        cmaMode,
          is_simulation: cmaMode === 'simulation',
          mode_label:  cmaMode === 'simulation' ? '🔶 Mode simulation' : '🌐 Connecté au portail CMA',
        },
        sync: {
          actif:          config?.actif       ?? false,
          frequence:      config?.frequence   ?? '24h',
          derniere_sync:  config?.derniere_sync ?? null,
          nb_trouves:     config?.nb_trouves  ?? 0,
          nb_en_attente:  config?.nb_en_attente ?? 0,
          nb_messages_envoyes: config?.nb_messages_envoyes ?? 0,
        },
        stats: {
          total:             stats?.total              ?? 0,
          admis:             stats?.admis              ?? 0,
          echecs:            stats?.echecs             ?? 0,
          en_attente:        stats?.en_attente         ?? 0,
          actions_declenchees: stats?.actions_declenchees ?? 0,
          derniere_sync:     stats?.derniere_sync      ?? null,
        },
        ollama: {
          disponible:  ollamaOk,
          model:       ollamaService.MODEL,
          base_url:    ollamaService.OLLAMA_BASE,
          models:      ollamaModels,
        },
      },
    });
  } catch (err) {
    logger.error('agentController.getStatus', { err: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

/* ──────────────────────────────────────────────────────────
   POST /api/agent/sync
   Déclenche une synchronisation manuelle
   ────────────────────────────────────────────────────────── */
async function lancerSync(req, res) {
  try {
    logger.info('[agentController] Sync manuelle déclenchée', { by: req.user?.id });

    const rapport = await AgentCMAService.synchroniser('manuel', {
      sessionCode: req.body.session_code || null,
      agenceId:    req.body.agence_id    || null,
    });

    return res.json({
      success: true,
      message: `Synchronisation terminée — ${rapport.resultats_trouves} résultat(s) trouvé(s), ${rapport.messages_envoyes} message(s) envoyé(s)`,
      data:    rapport,
    });
  } catch (err) {
    logger.error('agentController.lancerSync', { err: err.message });
    return res.status(500).json({ success: false, message: err.message || 'Erreur lors de la synchronisation.' });
  }
}

/* ──────────────────────────────────────────────────────────
   GET /api/agent/resultats
   Liste les résultats CMA (filtres : session, type, resultat, dossier_id)
   ────────────────────────────────────────────────────────── */
async function getResultats(req, res) {
  try {
    const { session, type_epreuve, resultat, dossier_id, limit = 100 } = req.query;

    let sql = `
      SELECT
        r.id, r.dossier_id, r.session_code, r.type_epreuve,
        r.note, r.resultat, r.action_auto, r.sync_source, r.synced_at,
        d.nom, d.prenom, d.email, d.telephone, d.reference,
        d.formation_souhaitee, d.agence_id,
        a.nom AS agence_nom
      FROM resultats_cma r
      JOIN dossiers d ON d.id = r.dossier_id
      LEFT JOIN agences a ON a.id = d.agence_id
      WHERE 1=1`;
    const params = [];

    if (session)      { sql += ' AND r.session_code = ?';  params.push(session); }
    if (type_epreuve) { sql += ' AND r.type_epreuve = ?';  params.push(type_epreuve); }
    if (resultat)     { sql += ' AND r.resultat = ?';      params.push(resultat); }
    if (dossier_id)   { sql += ' AND r.dossier_id = ?';    params.push(parseInt(dossier_id)); }

    sql += ' ORDER BY r.synced_at DESC LIMIT ?';
    params.push(Math.min(parseInt(limit) || 100, 500));

    const [rows] = await db.query(sql, params);

    // Stats rapides
    const admis    = rows.filter((r) => r.resultat === 'admis').length;
    const echecs   = rows.filter((r) => r.resultat === 'echec').length;
    const attente  = rows.filter((r) => r.resultat === 'en_attente').length;

    return res.json({
      success: true,
      data:    rows,
      total:   rows.length,
      stats:   { admis, echecs, en_attente: attente },
    });
  } catch (err) {
    logger.error('agentController.getResultats', { err: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

/* ──────────────────────────────────────────────────────────
   GET /api/agent/sessions
   Liste les sessions CMA disponibles (pour le filtre)
   ────────────────────────────────────────────────────────── */
async function getSessions(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT session_code, COUNT(*) AS nb_resultats, MAX(synced_at) AS derniere_sync
       FROM resultats_cma
       GROUP BY session_code
       ORDER BY session_code DESC
       LIMIT 20`
    ).catch(() => [[]]);

    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

/* ──────────────────────────────────────────────────────────
   PATCH /api/agent/config
   Met à jour la configuration de synchronisation automatique
   Body : { actif, frequence }
   ────────────────────────────────────────────────────────── */
async function updateConfig(req, res) {
  try {
    const { actif, frequence } = req.body;

    const FREQUENCES_VALIDES = ['6h', '12h', '24h'];
    if (frequence && !FREQUENCES_VALIDES.includes(frequence)) {
      return res.status(400).json({
        success: false,
        message: `Fréquence invalide. Valeurs : ${FREQUENCES_VALIDES.join(', ')}`,
      });
    }

    // Ensure config row exists
    await db.query(`
      INSERT IGNORE INTO config_sync_cma (id, actif, frequence)
      VALUES (1, 0, '24h')
    `).catch(() => {});

    const updates = [];
    const params  = [];

    if (actif !== undefined) { updates.push('actif = ?');     params.push(actif ? 1 : 0); }
    if (frequence)           { updates.push('frequence = ?'); params.push(frequence); }

    if (updates.length) {
      params.push(1); // WHERE id = 1
      await db.query(
        `UPDATE config_sync_cma SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );
    }

    const [[config]] = await db.query('SELECT * FROM config_sync_cma WHERE id = 1');

    return res.json({
      success: true,
      message: 'Configuration mise à jour.',
      data:    config,
    });
  } catch (err) {
    logger.error('agentController.updateConfig', { err: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

/* ──────────────────────────────────────────────────────────
   POST /api/agent/generer-email
   Génère un email personnalisé via Ollama pour un apprenant
   Body : { type, dossier_id }
   Types : admis_theorie | echec_theorie | admis_pratique | echec_pratique
   ────────────────────────────────────────────────────────── */
async function genererEmail(req, res) {
  try {
    const { type, dossier_id } = req.body;

    const TYPES_VALIDES = ['admis_theorie', 'echec_theorie', 'admis_pratique', 'echec_pratique'];
    if (!type || !TYPES_VALIDES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Type invalide. Valeurs : ${TYPES_VALIDES.join(', ')}`,
      });
    }

    // Récupérer le dossier si fourni
    let apprenant = { prenom: 'Apprenant', nom: '' };
    let formation = 'la formation';

    if (dossier_id) {
      const [[d]] = await db.query(
        'SELECT prenom, nom, formation_souhaitee FROM dossiers WHERE id = ?',
        [parseInt(dossier_id)]
      ).catch(() => [[]]);
      if (d) {
        apprenant = d;
        formation = d.formation_souhaitee || formation;
      }
    }

    const result = await ollamaService.generateEmailContent({ type, apprenant, formation });

    return res.json({
      success: true,
      data: {
        content: result.content,
        source:  result.source, // 'ollama' | 'default'
        type,
        ollama_disponible: result.source === 'ollama',
      },
    });
  } catch (err) {
    logger.error('agentController.genererEmail', { err: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

/* ──────────────────────────────────────────────────────────
   POST /api/agent/score-lead
   Score un lead via Ollama
   Body : { lead_id } ou lead object directement
   ────────────────────────────────────────────────────────── */
async function scorerLead(req, res) {
  try {
    let lead = req.body.lead;

    if (!lead && req.body.lead_id) {
      const [[row]] = await db.query(
        `SELECT l.*, DATEDIFF(NOW(), l.created_at) AS jours_depuis_creation
         FROM leads l WHERE l.id = ?`,
        [parseInt(req.body.lead_id)]
      ).catch(() => [[]]);
      lead = row;
    }

    if (!lead) {
      return res.status(400).json({ success: false, message: 'lead ou lead_id requis.' });
    }

    const ollamaOk = await ollamaService.isAvailable();
    if (!ollamaOk) {
      return res.status(503).json({
        success: false,
        message: 'Ollama non disponible. Démarrez Ollama : ollama serve',
        ollama_url: ollamaService.OLLAMA_BASE,
      });
    }

    const score = await ollamaService.scoreLead(lead);
    if (!score) {
      return res.status(500).json({ success: false, message: 'Impossible de générer le score.' });
    }

    return res.json({ success: true, data: score });
  } catch (err) {
    logger.error('agentController.scorerLead', { err: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

/* ──────────────────────────────────────────────────────────
   GET /api/agent/ollama/status
   Vérifie la disponibilité d'Ollama
   ────────────────────────────────────────────────────────── */
async function getOllamaStatus(req, res) {
  try {
    const [disponible, models] = await Promise.all([
      ollamaService.isAvailable(),
      ollamaService.listModels(),
    ]);

    return res.json({
      success: true,
      data: {
        disponible,
        model_actif: ollamaService.MODEL,
        base_url:    ollamaService.OLLAMA_BASE,
        models,
        install_hint: disponible ? null : `Ollama non démarré. Lancez : ollama serve\nTéléchargez le modèle : ollama pull ${ollamaService.MODEL}`,
      },
    });
  } catch (err) {
    return res.json({ success: true, data: { disponible: false, models: [] } });
  }
}

module.exports = {
  getStatus,
  lancerSync,
  getResultats,
  getSessions,
  updateConfig,
  genererEmail,
  scorerLead,
  getOllamaStatus,
};
