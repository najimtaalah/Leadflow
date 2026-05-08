'use strict';

const AgentCMAService  = require('../services/agentCMAService');
const ResultatCMAModel = require('../models/ResultatCMA');
const db               = require('../config/database');
const logger           = require('../utils/logger');

/* ──────────────────────────────────────────────────────────
   GET /api/agent/status
   Retourne : mode CMA, config sync, stats
   ────────────────────────────────────────────────────────── */
async function getStatus(req, res) {
  try {
    const [config, stats] = await Promise.all([
      ResultatCMAModel.getSyncConfig(),
      ResultatCMAModel.getLastSyncStats(),
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

module.exports = {
  getStatus,
  lancerSync,
  getResultats,
  getSessions,
  updateConfig,
};
