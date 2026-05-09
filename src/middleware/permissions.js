'use strict';

const { ROLE_PERMISSIONS, DB_ROLE_TO_FUNCTIONAL } = require('../config/roles');
const logger = require('../utils/logger');

/**
 * Résout le rôle fonctionnel depuis un rôle DB ou fonctionnel.
 * Retourne null si le rôle est inconnu.
 */
function resolveFunctionalRole(role) {
  return DB_ROLE_TO_FUNCTIONAL[role] || null;
}

/**
 * Vérifie si un rôle (DB ou fonctionnel) possède une permission donnée.
 *
 * @param {string} role       - rôle DB (ex: 'role_admin') ou fonctionnel (ex: 'admin')
 * @param {string} permission - constante PERMISSIONS.* (ex: 'pre_dossier:validate_financial')
 * @returns {boolean}
 */
function can(role, permission) {
  const functional = DB_ROLE_TO_FUNCTIONAL[role] || role;
  const permSet = ROLE_PERMISSIONS[functional];
  return permSet ? permSet.has(permission) : false;
}

/**
 * Middleware Express — bloque l'accès si la permission est manquante.
 * Doit être utilisé après le middleware `authenticate`.
 *
 * Usage :
 *   router.post('/pre-dossier', authenticate, requirePermission(PERMISSIONS.PRE_DOSSIER_OPEN), handler)
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code:    'UNAUTHORIZED',
        message: 'Authentification requise.',
      });
    }

    if (!can(req.user.role_nom, permission)) {
      logger.warn('Accès refusé — permission manquante', {
        user_id:    req.user.id,
        role:       req.user.role_nom,
        permission,
        path:       req.path,
        method:     req.method,
        ip:         req.ip,
      });

      return res.status(403).json({
        success:             false,
        code:                'FORBIDDEN',
        message:             'Permission insuffisante pour cette action.',
        required_permission: permission,
      });
    }

    next();
  };
}

/**
 * Middleware Express — passe si au moins une des permissions est accordée.
 *
 * Usage :
 *   requireAnyPermission(PERMISSIONS.PRE_DOSSIER_FILL_ADMIN, PERMISSIONS.PRE_DOSSIER_VALIDATE_ADMIN)
 */
function requireAnyPermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code:    'UNAUTHORIZED',
        message: 'Authentification requise.',
      });
    }

    const hasAny = permissions.some(p => can(req.user.role_nom, p));

    if (!hasAny) {
      logger.warn('Accès refusé — aucune permission accordée', {
        user_id:     req.user.id,
        role:        req.user.role_nom,
        permissions,
        path:        req.path,
        method:      req.method,
        ip:          req.ip,
      });

      return res.status(403).json({
        success: false,
        code:    'FORBIDDEN',
        message: 'Permission insuffisante pour cette action.',
      });
    }

    next();
  };
}

module.exports = { can, requirePermission, requireAnyPermission, resolveFunctionalRole };
