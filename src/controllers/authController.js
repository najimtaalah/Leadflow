'use strict';

const bcrypt    = require('bcryptjs');
const UserModel = require('../models/User');
const LogModel  = require('../models/Log');
const {
  generateToken,
  revokeToken,
} = require('../utils/jwt');
const {
  checkAccountLockout,
  recordFailedLogin,
  clearFailedLogins,
} = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

// ── Validation simple ────────────────────────────────────────────────────────
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const AuthController = {

  // ── UC-01 : Connexion ──────────────────────────────────────────────────────
  async login(req, res) {
    const { email, password } = req.body;
    const ip = req.ip;

    // Validation des champs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        code:    'VALIDATION_ERROR',
        message: 'Email et mot de passe requis.',
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        code:    'VALIDATION_ERROR',
        message: 'Format d\'email invalide.',
      });
    }

    try {
      // Vérifier le verrouillage du compte (5 tentatives max)
      const isLocked = await checkAccountLockout(email);
      if (isLocked) {
        const lockoutMins = parseInt(process.env.LOCKOUT_DURATION_MINUTES) || 15;
        return res.status(429).json({
          success: false,
          code:    'ACCOUNT_LOCKED',
          message: `Compte temporairement verrouillé après trop de tentatives. Réessayez dans ${lockoutMins} minutes.`,
        });
      }

      // Chercher l'utilisateur
      const user = await UserModel.findByEmail(email);

      // Compte inexistant
      if (!user) {
        await recordFailedLogin(email, ip);
        return res.status(401).json({
          success: false,
          code:    'INVALID_CREDENTIALS',
          message: 'Email ou mot de passe incorrect.',
        });
      }

      // Compte inactif
      if (!user.actif) {
        await LogModel.create({
          action:     'login_failed_inactive',
          user_id:    user.id,
          details:    { email },
          ip_address: ip,
        });
        return res.status(403).json({
          success: false,
          code:    'ACCOUNT_DISABLED',
          message: 'Compte désactivé. Contactez l\'administrateur.',
        });
      }

      // Vérifier le mot de passe
      const passwordOk = await bcrypt.compare(password, user.password_hash);
      if (!passwordOk) {
        await recordFailedLogin(email, ip);
        await LogModel.create({
          action:     'login_failed',
          user_id:    user.id,
          details:    { email, reason: 'wrong_password' },
          ip_address: ip,
        });
        return res.status(401).json({
          success: false,
          code:    'INVALID_CREDENTIALS',
          message: 'Email ou mot de passe incorrect.',
        });
      }

      // ✅ Connexion réussie
      await clearFailedLogins(email);
      await UserModel.updateLastLogin(user.id);

      const token = generateToken({
        user_id:   user.id,
        role_nom:  user.role_nom,
        agence_id: user.agence_id,
        prenom:    user.prenom,
        nom:       user.nom,
      });

      await LogModel.create({
        action:     'login',
        user_id:    user.id,
        details:    { role: user.role_nom },
        ip_address: ip,
      });

      logger.info('Connexion réussie', { user_id: user.id, role: user.role_nom });

      return res.status(200).json({
        success: true,
        message: 'Connexion réussie.',
        token,
        user: {
          id:        user.id,
          prenom:    user.prenom,
          nom:       user.nom,
          email:     user.email,
          role:      user.role_nom,
          role_nom:  user.role_nom,
          agence_id: user.agence_id,
          agence:    user.agence_nom,
        },
      });

    } catch (err) {
      logger.error('Erreur login', { error: err.message, email });
      return res.status(500).json({
        success: false,
        code:    'SERVER_ERROR',
        message: 'Erreur serveur. Réessayez plus tard.',
      });
    }
  },

  // ── UC-03 : Déconnexion ────────────────────────────────────────────────────
  async logout(req, res) {
    try {
      revokeToken(req.token);

      await LogModel.create({
        action:     'logout',
        user_id:    req.user.id,
        details:    { role: req.user.role_nom },
        ip_address: req.ip,
      });

      logger.info('Déconnexion', { user_id: req.user.id });

      return res.status(200).json({
        success: true,
        message: 'Déconnexion réussie.',
      });
    } catch (err) {
      logger.error('Erreur logout', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Route /auth/me — infos utilisateur connecté ───────────────────────────
  async me(req, res) {
    return res.status(200).json({
      success: true,
      user: {
        id:        req.user.id,
        prenom:    req.user.prenom,
        nom:       req.user.nom,
        email:     req.user.email,
        role:      req.user.role_nom,
        agence_id: req.user.agence_id,
      },
    });
  },
};

module.exports = AuthController;
