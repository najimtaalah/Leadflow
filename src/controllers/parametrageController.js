'use strict';

const ParametrageModel = require('../models/Parametrage');
const LogModel         = require('../models/Log');
const logger           = require('../utils/logger');
const db               = require('../config/database');

const CONFIG_PEDA_VALIDES = ['theorie_seule', 'pratique_seule', 'theorie_et_pratique'];

const ParametrageController = {

  // ════════════════════════════════════════════════════════════
  // UC-45 — FORMATIONS
  // ════════════════════════════════════════════════════════════

  async listFormations(req, res) {
    try {
      const formations = await ParametrageModel.findAllFormations();
      return res.status(200).json({ success: true, data: formations });
    } catch (err) {
      logger.error('Erreur listFormations', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async getFormation(req, res) {
    try {
      const f = await ParametrageModel.findFormationById(parseInt(req.params.id));
      if (!f) return res.status(404).json({ success: false, message: 'Formation introuvable.' });
      return res.status(200).json({ success: true, data: f });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async createFormation(req, res) {
    const { nom, description, duree_heures, cout_defaut, frais_cma_defaut,
            config_pedagogique, date_debut, type, format, lieu_code } = req.body;

    const TYPES_FORMATION  = ['TXF','TXP','VTF','VTP','VMF','VMP'];
    const FORMATS_VALIDES  = ['P', 'D'];

    const erreurs = [];
    if (!nom?.trim()) erreurs.push('Nom requis.');
    if (!config_pedagogique || !CONFIG_PEDA_VALIDES.includes(config_pedagogique))
      erreurs.push(`config_pedagogique invalide. Valeurs : ${CONFIG_PEDA_VALIDES.join(', ')}`);
    if (cout_defaut && isNaN(parseFloat(cout_defaut)))
      erreurs.push('cout_defaut doit être un nombre.');
    if (type && !TYPES_FORMATION.includes(type))
      erreurs.push(`type invalide. Valeurs : ${TYPES_FORMATION.join(', ')}`);
    if (format && !FORMATS_VALIDES.includes(format))
      erreurs.push('format invalide. Valeurs : P (présentiel), D (distanciel)');
    if (erreurs.length) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', errors: erreurs });
    }

    try {
      const id = await ParametrageModel.createFormation({
        nom: nom.trim(), description, duree_heures, cout_defaut, frais_cma_defaut,
        config_pedagogique, date_debut: date_debut || null,
        type: type || null, format: format || null, lieu_code: lieu_code || null,
      });

      const created = await ParametrageModel.findFormationById(id);

      await LogModel.create({
        action:  'formation_created', user_id: req.user.id,
        details: { formation_id: id, nom, code_formation: created?.code_formation }, ip_address: req.ip,
      });

      logger.info('Formation créée', { id, nom, code_formation: created?.code_formation, by: req.user.id });
      return res.status(201).json({
        success: true, message: 'Formation créée.',
        data: { id, code_formation: created?.code_formation },
      });
    } catch (err) {
      logger.error('Erreur createFormation', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async updateFormation(req, res) {
    const id = parseInt(req.params.id);
    try {
      const exist = await ParametrageModel.findFormationById(id);
      if (!exist) return res.status(404).json({ success: false, message: 'Formation introuvable.' });

      // Vérification : si on change la config_peda et qu'il y a des apprenants actifs → alerte
      if (req.body.config_pedagogique && req.body.config_pedagogique !== exist.config_pedagogique) {
        if (exist.nb_inscrits_actifs > 0) {
          // On accepte mais on avertit (UC-45)
          req.body._warning = `${exist.nb_inscrits_actifs} apprenant(s) actif(s) — la nouvelle config s'applique aux nouvelles inscriptions uniquement.`;
        }
      }

      await ParametrageModel.updateFormation(id, req.body);

      await LogModel.create({
        action:  'formation_updated', user_id: req.user.id,
        details: { formation_id: id, changes: Object.keys(req.body) }, ip_address: req.ip,
      });

      return res.status(200).json({
        success: true,
        message: 'Formation mise à jour.',
        warning: req.body._warning || null,
      });
    } catch (err) {
      logger.error('Erreur updateFormation', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async deleteFormation(req, res) {
    const id = parseInt(req.params.id);
    try {
      const exist = await ParametrageModel.findFormationById(id);
      if (!exist) return res.status(404).json({ success: false, message: 'Formation introuvable.' });

      // Vérifier qu'aucune session n'est liée à cette formation
      const [[{ nb }]] = await db.query(
        'SELECT COUNT(*) AS nb FROM sessions_formation WHERE formation_id = ?', [id]
      );
      if (nb > 0) {
        return res.status(409).json({
          success: false,
          message: `Impossible de supprimer : ${nb} session(s) liée(s) à cette formation. Supprimez d'abord les sessions.`,
        });
      }

      await db.query('DELETE FROM formations WHERE id = ?', [id]);

      await LogModel.create({
        action:  'formation_deleted', user_id: req.user.id,
        details: { formation_id: id, nom: exist.nom }, ip_address: req.ip,
      });

      logger.info('Formation supprimée', { id, nom: exist.nom, by: req.user.id });
      return res.status(200).json({ success: true, message: 'Formation supprimée.' });
    } catch (err) {
      logger.error('Erreur deleteFormation', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ════════════════════════════════════════════════════════════
  // UC-48 — SESSIONS DE FORMATION
  // ════════════════════════════════════════════════════════════

  async listSessions(req, res) {
    try {
      const { formation_id, actif, type_session } = req.query;
      const sessions = await ParametrageModel.findAllSessions({
        formation_id: formation_id ? parseInt(formation_id) : undefined,
        actif:        actif !== undefined ? actif === '1' : undefined,
        type_session: type_session || undefined,
      });
      return res.status(200).json({ success: true, data: sessions });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async createSession(req, res) {
    const { formation_id, type_session, date_debut, date_fin, capacite_max, lieu, moment } = req.body;

    const TYPES_VALIDES = ['cours', 'edof', 'examen'];
    const erreurs = [];
    if (!formation_id)    erreurs.push('formation_id requis.');
    if (!type_session || !TYPES_VALIDES.includes(type_session))
      erreurs.push(`type_session requis. Valeurs : ${TYPES_VALIDES.join(', ')}.`);
    if (!date_debut)      erreurs.push('date_debut requise.');
    if (!date_fin)        erreurs.push('date_fin requise.');
    if (date_debut && date_fin && date_debut >= date_fin)
      erreurs.push('date_fin doit être postérieure à date_debut.');
    if (erreurs.length) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', errors: erreurs });
    }

    try {
      const { id, code_session, numero_session } = await ParametrageModel.createSession({
        formation_id, type_session, date_debut, date_fin, capacite_max, lieu, moment,
      });

      await LogModel.create({
        action:  'session_created', user_id: req.user.id,
        details: { session_id: id, code_session, numero_session, type_session, formation_id },
        ip_address: req.ip,
      });

      logger.info('Session créée', { id, code_session, numero_session, by: req.user.id });
      return res.status(201).json({
        success: true, message: 'Session créée.',
        data: { id, code_session, numero_session },
      });
    } catch (err) {
      if (err.message.startsWith('CODE_SESSION_EXISTS')) {
        return res.status(409).json({
          success: false, code: 'CODE_SESSION_EXISTS',
          message: `Code session déjà utilisé. Veuillez réessayer.`,
        });
      }
      if (err.message === 'Formation introuvable.') {
        return res.status(404).json({ success: false, message: err.message });
      }
      logger.error('Erreur createSession', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async updateSession(req, res) {
    const id = parseInt(req.params.id);
    try {
      await ParametrageModel.updateSession(id, req.body);
      return res.status(200).json({ success: true, message: 'Session mise à jour.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async deleteSession(req, res) {
    const id = parseInt(req.params.id);
    try {
      const [[session]] = await db.query(
        `SELECT s.id, s.code_session,
           (SELECT COUNT(*) FROM dossiers d
            WHERE d.session_cours_id = s.id
               OR d.session_edof_id  = s.id
               OR d.examen_id        = s.id) AS nb_dossiers
         FROM sessions_formation s WHERE s.id = ?`,
        [id]
      );
      if (!session) return res.status(404).json({ success: false, message: 'Session introuvable.' });

      if (session.nb_dossiers > 0) {
        return res.status(409).json({
          success: false,
          message: `Impossible de supprimer : ${session.nb_dossiers} dossier(s) sont affectés à cette session. Clôturez-la plutôt.`,
        });
      }

      await db.query('DELETE FROM sessions_formation WHERE id = ?', [id]);

      await LogModel.create({
        action:  'session_deleted', user_id: req.user.id,
        details: { session_id: id, code_session: session.code_session }, ip_address: req.ip,
      });

      logger.info('Session supprimée', { id, code_session: session.code_session, by: req.user.id });
      return res.status(200).json({ success: true, message: 'Session supprimée.' });
    } catch (err) {
      logger.error('Erreur deleteSession', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async cloturerSession(req, res) {
    const id = parseInt(req.params.id);
    try {
      // Compter les dossiers affectés à cette session (cours, edof ou examen)
      const [[session]] = await db.query(
        `SELECT s.id, s.code_session, s.type_session,
           (SELECT COUNT(*) FROM dossiers d
            WHERE d.session_cours_id = s.id
               OR d.session_edof_id  = s.id
               OR d.examen_id        = s.id) AS nb_dossiers
         FROM sessions_formation s WHERE s.id = ?`,
        [id]
      );
      if (!session) return res.status(404).json({ success: false, message: 'Session introuvable.' });

      await ParametrageModel.cloturerSession(id);

      await LogModel.create({
        action:  'session_cloturee', user_id: req.user.id,
        details: { session_id: id, code_session: session.code_session, nb_dossiers: session.nb_dossiers },
        ip_address: req.ip,
      });

      return res.status(200).json({
        success:     true,
        message:     'Session clôturée.',
        nb_dossiers: session.nb_dossiers,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ════════════════════════════════════════════════════════════
  // UC-47 — AGENCES
  // ════════════════════════════════════════════════════════════

  async listAgences(req, res) {
    try {
      const { actif } = req.query;
      const agences = await ParametrageModel.findAllAgences({
        actif: actif !== undefined ? actif === '1' : undefined,
      });
      return res.status(200).json({ success: true, data: agences });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async createAgence(req, res) {
    const { nom, ville, region, code } = req.body;
    if (!nom?.trim()) {
      return res.status(400).json({ success: false, message: 'Nom requis.' });
    }
    try {
      const id = await ParametrageModel.createAgence({ nom: nom.trim(), ville, region, code });

      await LogModel.create({
        action:  'agence_created', user_id: req.user.id,
        details: { agence_id: id, nom }, ip_address: req.ip,
      });

      return res.status(201).json({ success: true, message: 'Agence créée.', data: { id } });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async deleteAgence(req, res) {
    const id = parseInt(req.params.id);
    try {
      const exist = await ParametrageModel.findAgenceById(id);
      if (!exist) return res.status(404).json({ success: false, message: 'Agence introuvable.' });

      // Bloquer si des utilisateurs sont affectés
      const stats = await ParametrageModel.getAgenceStats(id);
      if (stats.nb_users > 0) {
        return res.status(409).json({
          success: false,
          message: `Impossible de supprimer : ${stats.nb_users} utilisateur(s) actif(s) dans cette agence. Réassignez-les d'abord.`,
        });
      }

      // Nullifier les FK dans dossiers et leads
      await db.query('UPDATE dossiers SET agence_id = NULL WHERE agence_id = ?', [id]);
      await db.query('UPDATE leads   SET agence_id = NULL WHERE agence_id = ?', [id]);
      await db.query('DELETE FROM agences WHERE id = ?', [id]);

      await LogModel.create({
        action:  'agence_deleted', user_id: req.user.id,
        details: { agence_id: id, nom: exist.nom }, ip_address: req.ip,
      });

      logger.info('Agence supprimée', { id, nom: exist.nom, by: req.user.id });
      return res.status(200).json({ success: true, message: 'Agence supprimée.' });
    } catch (err) {
      logger.error('Erreur deleteAgence', { error: err.message });
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async updateAgence(req, res) {
    const id = parseInt(req.params.id);
    const { actif } = req.body;

    // UC-47 : désactivation avec utilisateurs actifs → avertissement
    let warning = null;
    if (actif === false || actif === 0) {
      const stats = await ParametrageModel.getAgenceStats(id);
      if (stats.nb_users > 0) {
        warning = `${stats.nb_users} utilisateur(s) actif(s) dans cette agence doivent être réassignés.`;
      }
    }

    try {
      await ParametrageModel.updateAgence(id, req.body);

      await LogModel.create({
        action:  'agence_updated', user_id: req.user.id,
        details: { agence_id: id, changes: Object.keys(req.body) }, ip_address: req.ip,
      });

      return res.status(200).json({ success: true, message: 'Agence mise à jour.', warning });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ════════════════════════════════════════════════════════════
  // UC-46 — DISTRIBUTION LEADS
  // ════════════════════════════════════════════════════════════

  async getDistribution(req, res) {
    try {
      const [config, limites] = await Promise.all([
        ParametrageModel.getDistributionConfig(),
        ParametrageModel.getAgentLimites(
          ['super_admin','role_admin'].includes(req.user.role_nom)
            ? req.query.agence_id || null
            : req.user.agence_id
        ),
      ]);
      return res.status(200).json({ success: true, data: { config, limites } });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async updateDistribution(req, res) {
    const id = parseInt(req.params.id);
    try {
      await ParametrageModel.updateDistributionConfig(id, req.body);
      return res.status(200).json({ success: true, message: 'Distribution mise à jour.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async updateAgentLimite(req, res) {
    const userId   = parseInt(req.params.userId);
    const { max_leads } = req.body;

    if (!max_leads || isNaN(parseInt(max_leads)) || parseInt(max_leads) < 0) {
      return res.status(400).json({
        success: false, message: 'max_leads requis (entier >= 0).',
      });
    }
    try {
      await ParametrageModel.upsertAgentLimite(userId, parseInt(max_leads));
      return res.status(200).json({
        success: true, message: `Limite mise à jour : ${max_leads} leads max.`,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ════════════════════════════════════════════════════════════
  // UC-49 — CONFIGURATION IMPORTS
  // ════════════════════════════════════════════════════════════

  async getConfigImports(req, res) {
    try {
      const config   = await ParametrageModel.getConfigImports();
      const historique = await ParametrageModel.getHistoriqueImports(20);
      return res.status(200).json({ success: true, data: { config, historique } });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async saveConfigImports(req, res) {
    const { gestion, edof } = req.body;

    // Validation colonnes
    if (gestion?.colonne_cout && !/^[A-Z]{1,3}$/.test(gestion.colonne_cout.toUpperCase())) {
      return res.status(400).json({
        success: false, message: 'colonne_cout invalide (ex: AU, B, AK).',
      });
    }

    try {
      const config = {
        gestion: {
          colonne_cout:      (gestion?.colonne_cout     || 'AU').toUpperCase(),
          colonne_financeur: (gestion?.colonne_financeur || 'AK').toUpperCase(),
          mode_defaut:       gestion?.mode_defaut        || 'mettre_a_jour',
        },
        edof: {
          separateur_csv: edof?.separateur_csv || ';',
          cle_upsert:     'NUMERO_DOSSIER',      // toujours fixe
          mode_defaut:    edof?.mode_defaut || 'upsert',
        },
      };

      await ParametrageModel.saveConfigImports(config, req.user.id);

      await LogModel.create({
        action:  'config_imports_updated', user_id: req.user.id,
        details: config, ip_address: req.ip,
      });

      return res.status(200).json({ success: true, message: 'Configuration imports enregistrée.', data: config });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // ════════════════════════════════════════════════════════════
  // UC-50 — MODÈLES SMS/EMAIL
  // ════════════════════════════════════════════════════════════

  async listModeles(req, res) {
    try {
      const modeles = await ParametrageModel.findAllModeles();
      return res.status(200).json({ success: true, data: modeles });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async createModele(req, res) {
    const { type, nom, sujet_email, contenu_email, contenu_sms } = req.body;

    if (!type?.trim() || !nom?.trim()) {
      return res.status(400).json({ success: false, message: 'type et nom requis.' });
    }

    // Valider les variables (UC-50)
    const validEmail = ParametrageModel.validateVariables(contenu_email);
    const validSms   = ParametrageModel.validateVariables(contenu_sms);

    if (!validEmail.ok || !validSms.ok) {
      return res.status(400).json({
        success:   false,
        code:      'VARIABLES_INCONNUES',
        message:   'Variables inconnues dans le modèle.',
        inconnues: [...validEmail.inconnues, ...validSms.inconnues],
      });
    }

    try {
      const id = await ParametrageModel.createModele({
        type, nom, sujet_email, contenu_email, contenu_sms,
      });

      await LogModel.create({
        action:  'modele_created', user_id: req.user.id,
        details: { modele_id: id, type, nom }, ip_address: req.ip,
      });

      return res.status(201).json({ success: true, message: 'Modèle créé.', data: { id } });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  async updateModele(req, res) {
    const id = parseInt(req.params.id);
    const { contenu_email, contenu_sms } = req.body;

    // Valider variables si contenu fourni
    if (contenu_email || contenu_sms) {
      const ve = ParametrageModel.validateVariables(contenu_email || '');
      const vs = ParametrageModel.validateVariables(contenu_sms  || '');
      if (!ve.ok || !vs.ok) {
        return res.status(400).json({
          success: false, code: 'VARIABLES_INCONNUES',
          message: 'Variables inconnues.',
          inconnues: [...ve.inconnues, ...vs.inconnues],
        });
      }
    }

    try {
      const exist = await ParametrageModel.findModeleById(id);
      if (!exist) return res.status(404).json({ success: false, message: 'Modèle introuvable.' });

      await ParametrageModel.updateModele(id, req.body);
      return res.status(200).json({ success: true, message: 'Modèle mis à jour.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },

  // Prévisualisation d'un modèle avec données exemple
  async previewModele(req, res) {
    const id = parseInt(req.params.id);
    try {
      const modele = await ParametrageModel.findModeleById(id);
      if (!modele) return res.status(404).json({ success: false, message: 'Modèle introuvable.' });

      const variables = {
        NOM: 'Dupont', PRENOM: 'Marie', FORMATION: 'Développement Web',
        DATE: new Date().toLocaleDateString('fr-FR'),
        EPREUVE: 'théorique', NOTE: '14.5/20', AGENCE: 'Paris',
      };

      const render = (str) => str
        ? str.replace(/\{(\w+)\}/g, (_, k) => variables[k] || `{${k}}`)
        : '';

      return res.status(200).json({
        success: true,
        data: {
          sujet_email:   render(modele.sujet_email),
          contenu_email: render(modele.contenu_email),
          contenu_sms:   render(modele.contenu_sms),
          variables_utilisees: ParametrageModel.validateVariables(
            (modele.contenu_email || '') + (modele.contenu_sms || '')
          ).variables,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
  },
};

module.exports = ParametrageController;
