'use strict';

require('dotenv').config();
const app    = require('./app');
const logger = require('./utils/logger');

const PORT     = parseInt(process.env.PORT) || 3000;
const SyncCMAJob    = require('./jobs/syncCmaJob');
const RappelsRdvJob = require('./jobs/rappelsRdvJob');

const server = app.listen(PORT, () => {
  logger.info(`🚀 LeadFlow CRM API démarrée sur le port ${PORT}`);
  // Démarrer la synchronisation automatique CMA (UC-24)
  if (process.env.NODE_ENV !== 'test') {
    SyncCMAJob.start();
    RappelsRdvJob.start();
  }
  logger.info(`   Environnement : ${process.env.NODE_ENV || 'development'}`);
  logger.info(`   Health check  : http://localhost:${PORT}/health`);
});

// Arrêt propre
process.on('SIGTERM', () => {
  logger.info('SIGTERM reçu. Arrêt du serveur...');
  server.close(() => {
    logger.info('Serveur arrêté proprement.');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Promesse rejetée non gérée :', reason);
});

module.exports = server;
