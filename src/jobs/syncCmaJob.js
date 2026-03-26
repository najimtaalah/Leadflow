'use strict';

/**
 * Planificateur de synchronisation automatique CMA
 * UC-24 — Sync automatique selon la fréquence configurée dans config_sync_cma
 *
 * À appeler dans server.js : require('./jobs/syncCmaJob').start();
 *
 * En production : utiliser node-cron ou agenda pour plus de robustesse
 * npm install node-cron
 */

const AgentCMAService = require('../services/agentCMAService');
const logger          = require('../utils/logger');

// Intervalle de vérification : toutes les 30 minutes
// L'AgentCMAService vérifie lui-même si la fréquence configurée est écoulée
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

let intervalId = null;
let isRunning  = false;

const SyncCMAJob = {

  start() {
    if (intervalId) {
      logger.warn('[SyncCMAJob] Déjà démarré');
      return;
    }

    logger.info('[SyncCMAJob] Démarrage — vérification toutes les 30 min');

    // Vérification immédiate au démarrage
    SyncCMAJob._run();

    // Puis toutes les 30 minutes
    intervalId = setInterval(SyncCMAJob._run, CHECK_INTERVAL_MS);
  },

  stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      logger.info('[SyncCMAJob] Arrêté');
    }
  },

  async _run() {
    if (isRunning) {
      logger.info('[SyncCMAJob] Sync déjà en cours — ignoré');
      return;
    }

    isRunning = true;
    try {
      const rapport = await AgentCMAService.checkAndRunAutoSync();
      if (rapport) {
        logger.info('[SyncCMAJob] Sync auto exécutée', {
          trouves:  rapport.resultats_trouves,
          actions:  rapport.actions.length,
          erreurs:  rapport.erreurs.length,
        });
      }
    } catch (err) {
      logger.error('[SyncCMAJob] Erreur exécution', { error: err.message });
    } finally {
      isRunning = false;
    }
  },
};

module.exports = SyncCMAJob;
