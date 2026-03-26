'use strict';

const jwt    = require('jsonwebtoken');
const logger = require('./logger');

// Store en mémoire des tokens révoqués (en prod : Redis recommandé)
const revokedTokens = new Set();

/**
 * Génère un token JWT contenant user_id, role_nom, agence_id
 */
function generateToken(payload) {
  return jwt.sign(
    {
      user_id:   payload.user_id,
      role_nom:  payload.role_nom,
      agence_id: payload.agence_id || null,
      prenom:    payload.prenom,
      nom:       payload.nom,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

/**
 * Vérifie et décode un token JWT
 * @returns {object} payload décodé
 * @throws {Error} si token invalide, expiré ou révoqué
 */
function verifyToken(token) {
  if (revokedTokens.has(token)) {
    throw new Error('TOKEN_REVOKED');
  }
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new Error('TOKEN_EXPIRED');
    if (err.name === 'JsonWebTokenError')  throw new Error('TOKEN_INVALID');
    throw err;
  }
}

/**
 * Révoque un token (déconnexion)
 * En production, prévoir un TTL via Redis pour purger automatiquement
 */
function revokeToken(token) {
  revokedTokens.add(token);
  logger.info('Token révoqué', { tokenPrefix: token.substring(0, 20) + '...' });
}

/**
 * Extrait le token depuis l'en-tête Authorization: Bearer <token>
 */
function extractTokenFromHeader(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

module.exports = { generateToken, verifyToken, revokeToken, extractTokenFromHeader };
