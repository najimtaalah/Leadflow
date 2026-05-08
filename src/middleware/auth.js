'use strict';

const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const db     = require('../config/database');
const logger = require('../utils/logger');
const { ROLE_HIERARCHY } = require('../constants');

/**
 * Middleware d'authentification — vérifie le JWT et charge l'utilisateur
 * UC-01 : token JWT valide requis sur toutes les routes protégées
 */
async function authenticate(req, res, next) {
  const token = extractTokenFromHeader(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      code:    'UNAUTHORIZED',
      message: 'Token d\'authentification manquant.',
    });
  }

  try {
    const payload = verifyToken(token);

    // Vérifier que l'utilisateur existe toujours et est actif en base
    const [rows] = await db.query(
      `SELECT u.id, u.prenom, u.nom, u.email, u.actif,
              r.nom AS role_nom, u.agence_id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [payload.user_id]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        code:    'USER_NOT_FOUND',
        message: 'Utilisateur introuvable.',
      });
    }

    const user = rows[0];

    // UC-02 : compte inactif → accès refusé
    if (!user.actif) {
      return res.status(403).json({
        success: false,
        code:    'ACCOUNT_DISABLED',
        message: 'Compte désactivé. Contactez l\'administrateur.',
      });
    }

    // Attacher l'utilisateur à la requête pour les middlewares suivants
    req.user  = user;
    req.token = token;
    next();

  } catch (err) {
    if (err.message === 'TOKEN_EXPIRED') {
      return res.status(401).json({
        success: false,
        code:    'TOKEN_EXPIRED',
        message: 'Session expirée. Veuillez vous reconnecter.',
      });
    }
    if (err.message === 'TOKEN_REVOKED' || err.message === 'TOKEN_INVALID') {
      return res.status(401).json({
        success: false,
        code:    'TOKEN_INVALID',
        message: 'Token invalide.',
      });
    }
    logger.error('Erreur middleware authenticate', { error: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

/**
 * Middleware d'autorisation par rôle(s)
 * UC-04 : accès refusé si rôle insuffisant
 *
 * Usage : authorize('super_admin', 'role_admin')
 * → autorise super_admin ET role_admin (liste blanche explicite)
 *
 * Usage : authorize.minRole('manager')
 * → autorise manager et tous les rôles au-dessus dans la hiérarchie
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code:    'UNAUTHORIZED',
        message: 'Authentification requise.',
      });
    }

    const userRole = req.user.role_nom;

    if (!allowedRoles.includes(userRole)) {
      // Logger la tentative d'accès non autorisée (UC-04)
      logger.warn('Accès refusé — droits insuffisants', {
        user_id:       req.user.id,
        role:          userRole,
        allowedRoles,
        path:          req.path,
        method:        req.method,
        ip:            req.ip,
      });

      return res.status(403).json({
        success: false,
        code:    'FORBIDDEN',
        message: 'Vous n\'avez pas les droits nécessaires pour accéder à cette ressource.',
      });
    }

    next();
  };
}

/**
 * Autorisation par niveau minimum dans la hiérarchie
 * authorize.minRole('manager') → autorise super_admin, role_admin, manager
 */
authorize.minRole = function (minRole) {
  const minIndex = ROLE_HIERARCHY.indexOf(minRole);
  if (minIndex === -1) throw new Error(`Rôle inconnu : ${minRole}`);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Authentification requise.' });
    }
    const userIndex = ROLE_HIERARCHY.indexOf(req.user.role_nom);
    if (userIndex === -1 || userIndex > minIndex) {
      logger.warn('Accès refusé — niveau insuffisant', {
        user_id: req.user.id, role: req.user.role_nom, minRole, path: req.path,
      });
      return res.status(403).json({
        success: false, code: 'FORBIDDEN',
        message: 'Vous n\'avez pas les droits nécessaires.',
      });
    }
    next();
  };
};

module.exports = { authenticate, authorize, ROLE_HIERARCHY };
