'use strict';

const mysql  = require('mysql2/promise');
const logger = require('../utils/logger');

// ── Pool de connexions MySQL ────────────────────────────────────────────────
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
  charset:            'utf8mb4',
});

// Test de connexion au démarrage
pool.getConnection()
  .then(conn => {
    logger.info('✅ Connexion MySQL établie');
    conn.release();
  })
  .catch(err => {
    logger.error('❌ Erreur connexion MySQL :', err.message);
    process.exit(1);
  });

module.exports = pool;
