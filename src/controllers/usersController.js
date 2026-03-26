'use strict';

const bcrypt    = require('bcryptjs');
const UserModel = require('../models/User');
const LogModel  = require('../models/Log');
const db        = require('../config/database');
const logger    = require('../utils/logger');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

// Validation
function validateUserFields({ prenom, nom, email, role_nom }) {
  const errors = [];
  if (!prenom?.trim())  errors.push('Prénom requis.');
  if (!nom?.trim())     errors.push('Nom requis.');
  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push('Email valide requis.');
  if (!role_nom?.trim()) errors.push('Rôle requis.');
  return errors;
}

const VALID_ROLES = [
  'super_admin', 'role_admin', 'manager',
  'commercial', 'role_administratif', 'agent_accueil',
];

const UsersController = {

  // ── UC-02 : Liste des utilisateurs ────────────────────────────────────────
  async list(req, res) {
    try {
      const { role_nom, actif, agence_id } = req.query;
      const users = await UserModel.findAll({
        role_nom,
        actif: actif !== undefined ? actif === '1' || actif === 'true' : undefined,
        agence_id: agence_id ? parseInt(agence_id) : undefined,
      });
      return res.status(200).json({ success: true, data: users, total: users.length });
    } catch (err) {
      logger.error('Erreur liste utilisateurs', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-02 : Détail d'un utilisateur ───────────────────────────────────────
  async getOne(req, res) {
    try {
      const user = await UserModel.findById(parseInt(req.params.id));
      if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
      return res.status(200).json({ success: true, data: user });
    } catch (err) {
      logger.error('Erreur getOne utilisateur', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-02 : Création d'un utilisateur ─────────────────────────────────────
  async create(req, res) {
    const { prenom, nom, email, password, role_nom, agence_id } = req.body;

    // Validation
    const errors = validateUserFields({ prenom, nom, email, role_nom });
    if (!password || password.length < 8) errors.push('Mot de passe requis (min 8 caractères).');
    if (errors.length) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', errors });
    }

    if (!VALID_ROLES.includes(role_nom)) {
      return res.status(400).json({ success: false, message: `Rôle invalide. Valeurs : ${VALID_ROLES.join(', ')}` });
    }

    try {
      // Vérifier doublon email (UC-02)
      const emailTaken = await UserModel.emailExists(email);
      if (emailTaken) {
        return res.status(409).json({
          success: false,
          code:    'EMAIL_EXISTS',
          message: 'Cet email est déjà utilisé.',
        });
      }

      // Récupérer le role_id
      const [[role]] = await db.query('SELECT id FROM roles WHERE nom = ?', [role_nom]);
      if (!role) return res.status(400).json({ success: false, message: 'Rôle introuvable.' });

      const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      const newId = await UserModel.create({
        prenom: prenom.trim(),
        nom:    nom.trim(),
        email:  email.toLowerCase().trim(),
        password_hash,
        role_id:   role.id,
        agence_id: agence_id ? parseInt(agence_id) : null,
      });

      await LogModel.create({
        action:     'user_created',
        user_id:    req.user.id,
        details:    { new_user_id: newId, email, role_nom },
        ip_address: req.ip,
      });

      logger.info('Utilisateur créé', { created_by: req.user.id, new_user_id: newId, role: role_nom });

      return res.status(201).json({
        success: true,
        message: 'Utilisateur créé avec succès.',
        data:    { id: newId },
      });

    } catch (err) {
      logger.error('Erreur création utilisateur', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-02 : Mise à jour d'un utilisateur ──────────────────────────────────
  async update(req, res) {
    const targetId = parseInt(req.params.id);
    const { prenom, nom, email, role_nom, agence_id, actif } = req.body;

    try {
      const existing = await UserModel.findById(targetId);
      if (!existing) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

      // Vérifier doublon email si changé
      if (email && email !== existing.email) {
        const taken = await UserModel.emailExists(email, targetId);
        if (taken) {
          return res.status(409).json({ success: false, code: 'EMAIL_EXISTS', message: 'Cet email est déjà utilisé.' });
        }
      }

      const updates = {};
      if (prenom)    updates.prenom    = prenom.trim();
      if (nom)       updates.nom       = nom.trim();
      if (email)     updates.email     = email.toLowerCase().trim();
      if (agence_id !== undefined) updates.agence_id = agence_id ? parseInt(agence_id) : null;
      if (actif     !== undefined) updates.actif     = actif ? 1 : 0;

      if (role_nom) {
        if (!VALID_ROLES.includes(role_nom)) {
          return res.status(400).json({ success: false, message: 'Rôle invalide.' });
        }
        const [[role]] = await db.query('SELECT id FROM roles WHERE nom = ?', [role_nom]);
        if (!role) return res.status(400).json({ success: false, message: 'Rôle introuvable.' });
        updates.role_id = role.id;
      }

      await UserModel.update(targetId, updates);

      await LogModel.create({
        action:     'user_updated',
        user_id:    req.user.id,
        details:    { target_user_id: targetId, changes: Object.keys(updates) },
        ip_address: req.ip,
      });

      logger.info('Utilisateur mis à jour', { updated_by: req.user.id, target: targetId });

      return res.status(200).json({ success: true, message: 'Utilisateur mis à jour.' });

    } catch (err) {
      logger.error('Erreur update utilisateur', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-02 : Réinitialisation de mot de passe ──────────────────────────────
  async resetPassword(req, res) {
    const targetId    = parseInt(req.params.id);
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe requis (minimum 8 caractères).',
      });
    }

    try {
      const existing = await UserModel.findById(targetId);
      if (!existing) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

      const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await UserModel.update(targetId, { password_hash });

      await LogModel.create({
        action:     'password_reset',
        user_id:    req.user.id,
        details:    { target_user_id: targetId },
        ip_address: req.ip,
      });

      logger.info('Mot de passe réinitialisé', { by: req.user.id, target: targetId });

      return res.status(200).json({
        success: true,
        message: 'Mot de passe réinitialisé avec succès.',
      });

    } catch (err) {
      logger.error('Erreur reset password', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── UC-02 : Suppression définitive d'un utilisateur ──────────────────────
  async remove(req, res) {
    const targetId = parseInt(req.params.id);

    // Impossible de se supprimer soi-même
    if (targetId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas supprimer votre propre compte.',
      });
    }

    try {
      const existing = await UserModel.findById(targetId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
      }

      // Mise à NULL des clés étrangères pour préserver les données
      await db.query('UPDATE leads          SET vendeur_id      = NULL WHERE vendeur_id      = ?', [targetId]);
      await db.query('UPDATE dossiers       SET vendeur_id      = NULL WHERE vendeur_id      = ?', [targetId]);
      await db.query('UPDATE agenda_rdv     SET responsable_id  = NULL WHERE responsable_id  = ?', [targetId]);
      await db.query('UPDATE agenda_rdv     SET created_by      = NULL WHERE created_by      = ?', [targetId]);
      await db.query('UPDATE encaissements  SET user_id         = NULL WHERE user_id         = ?', [targetId]);
      await db.query('UPDATE pipeline_historique SET user_id   = NULL WHERE user_id          = ?', [targetId]);
      await db.query('UPDATE rapports_config SET created_by    = NULL WHERE created_by       = ?', [targetId]);
      await db.query('DELETE FROM agent_limites WHERE user_id = ?', [targetId]);

      // Suppression de l'utilisateur
      await db.query('DELETE FROM users WHERE id = ?', [targetId]);

      await LogModel.create({
        action:     'user_deleted',
        user_id:    req.user.id,
        details:    { deleted_user_id: targetId, email: existing.email, nom: `${existing.prenom} ${existing.nom}` },
        ip_address: req.ip,
      });

      logger.info('Utilisateur supprimé', { deleted_by: req.user.id, target: targetId, email: existing.email });

      return res.status(200).json({ success: true, message: 'Utilisateur supprimé définitivement.' });

    } catch (err) {
      logger.error('Erreur suppression utilisateur', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Logs d'un utilisateur (SUPER_ADMIN) ───────────────────────────────────
  async getLogs(req, res) {
    try {
      const logs = await LogModel.findByUser(parseInt(req.params.id));
      return res.status(200).json({ success: true, data: logs });
    } catch (err) {
      logger.error('Erreur getLogs utilisateur', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Mon profil : lecture ───────────────────────────────────────────────────
  async getMe(req, res) {
    try {
      const [[user]] = await db.query(
        `SELECT u.id, u.prenom, u.nom, u.email, u.actif, u.last_login,
                r.nom AS role_nom, a.nom AS agence_nom
         FROM users u
         JOIN roles r   ON r.id = u.role_id
         LEFT JOIN agences a ON a.id = u.agence_id
         WHERE u.id = ?`,
        [req.user.id]
      );
      if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
      return res.status(200).json({ success: true, data: user });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ── Mon profil : mise à jour ───────────────────────────────────────────────
  async updateMe(req, res) {
    const { prenom, nom, email, password } = req.body;
    const erreurs = [];
    if (prenom !== undefined && !prenom?.trim()) erreurs.push('Prénom ne peut pas être vide.');
    if (nom    !== undefined && !nom?.trim())    erreurs.push('Nom ne peut pas être vide.');
    if (email  !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      erreurs.push('Email invalide.');
    if (password !== undefined && password.length < 8)
      erreurs.push('Le mot de passe doit contenir au moins 8 caractères.');
    if (erreurs.length)
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', errors: erreurs });

    try {
      const updates = [];
      const params  = [];
      if (prenom) { updates.push('prenom = ?'); params.push(prenom.trim()); }
      if (nom)    { updates.push('nom = ?');    params.push(nom.trim()); }
      if (email)  { updates.push('email = ?');  params.push(email.toLowerCase().trim()); }
      if (password) {
        const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        updates.push('password_hash = ?');
        params.push(hash);
      }
      if (!updates.length)
        return res.status(400).json({ success: false, message: 'Aucune modification fournie.' });

      params.push(req.user.id);
      await db.query(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );

      await LogModel.create({
        action:  'profil_updated',
        user_id: req.user.id,
        details: { champs: updates.map(u => u.split(' ')[0]) },
        ip_address: req.ip,
      });

      return res.status(200).json({ success: true, message: 'Profil mis à jour.' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY')
        return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé.' });
      logger.error('Erreur updateMe', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },
};

module.exports = UsersController;
