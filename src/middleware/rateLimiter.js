'use strict';

const rateLimit = require('express-rate-limit');
const db        = require('../config/database');
const logger    = require('../utils/logger');

const MAX_ATTEMPTS       = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCKOUT_MINUTES    = parseInt(process.env.LOCKOUT_DURATION_MINUTES) || 15;
const LOCKOUT_MS         = LOCKOUT_MINUTES * 60 * 1000;

/**
 * Rate limiter Express global (toutes les routes API)
 * 100 requêtes / 15 min par IP
 */
const globalLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              100,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    success: false,
    code:    'TOO_MANY_REQUESTS',
    message: 'Trop de requêtes. Réessayez dans 15 minutes.',
  },
});

/**
 * Rate limiter strict pour la route POST /auth/login
 * 10 tentatives / 15 min par IP
 */
const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    code:    'TOO_MANY_REQUESTS',
    message: `Trop de tentatives de connexion. Réessayez dans ${LOCKOUT_MINUTES} minutes.`,
  },
});

/**
 * Vérifie si un compte est verrouillé (UC-01 : 5 tentatives → verrouillage 15 min)
 * Stocké dans logs_systeme avec action = 'login_failed'
 */
async function checkAccountLockout(email) {
  const since = new Date(Date.now() - LOCKOUT_MS);
  const [rows] = await db.query(
    `SELECT COUNT(*) AS attempts
     FROM logs_systeme
     WHERE action = 'login_failed'
       AND details LIKE ?
       AND created_at >= ?`,
    [`%${email}%`, since]
  );
  return rows[0].attempts >= MAX_ATTEMPTS;
}

/**
 * Enregistre une tentative de connexion échouée
 */
async function recordFailedLogin(email, ip) {
  try {
    await db.query(
      `INSERT INTO logs_systeme (action, details, ip_address, created_at)
       VALUES ('login_failed', ?, ?, NOW())`,
      [JSON.stringify({ email }), ip]
    );
    const [rows] = await db.query(
      `SELECT COUNT(*) AS attempts
       FROM logs_systeme
       WHERE action = 'login_failed'
         AND details LIKE ?
         AND created_at >= ?`,
      [`%${email}%`, new Date(Date.now() - LOCKOUT_MS)]
    );
    if (rows[0].attempts >= MAX_ATTEMPTS) {
      logger.warn(`Compte verrouillé : ${email} (${rows[0].attempts} tentatives)`);
    }
  } catch (err) {
    logger.error('Erreur enregistrement tentative échouée', { error: err.message });
  }
}

/**
 * Efface les tentatives échouées après connexion réussie
 */
async function clearFailedLogins(email) {
  try {
    await db.query(
      `DELETE FROM logs_systeme
       WHERE action = 'login_failed' AND details LIKE ?`,
      [`%${email}%`]
    );
  } catch (err) {
    logger.error('Erreur nettoyage tentatives échouées', { error: err.message });
  }
}

module.exports = {
  globalLimiter,
  loginLimiter,
  checkAccountLockout,
  recordFailedLogin,
  clearFailedLogins,
};
