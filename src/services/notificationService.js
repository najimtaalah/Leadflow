'use strict';

const nodemailer = require('nodemailer');
const db     = require('../config/database');
const logger = require('../utils/logger');

/**
 * Service de notifications — Email et SMS
 * Utilisé par l'agent IA CMA (UC-21, UC-22, UC-23)
 * Configuration .env :
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=votre@email.com
 *   SMTP_PASS=votre_mot_de_passe_app
 *   SMTP_FROM="LeadFlow CRM <votre@email.com>"
 */

// ── Transporter Nodemailer ─────────────────────────────────────────────────
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    logger.warn('[NotificationService] SMTP non configuré — les emails seront simulés');
    return null;
  }

  _transporter = nodemailer.createTransport({
    host,
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth:   { user, pass },
  });

  return _transporter;
}

const SIMULATION_MODE = () => !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS;

const NotificationService = {

  /**
   * Charge un modèle de message depuis sms_modeles
   * et remplace les variables {NOM}, {PRENOM}, {FORMATION}, {DATE}
   */
  async renderTemplate(typeModele, variables = {}) {
    const [[modele]] = await db.query(
      `SELECT contenu_email, contenu_sms, sujet_email
       FROM sms_modeles WHERE type = ? AND actif = 1 LIMIT 1`,
      [typeModele]
    );

    if (!modele) {
      logger.warn(`Modèle de message introuvable : ${typeModele}`);
      return null;
    }

    const replace = (str) =>
      str.replace(/\{(\w+)\}/g, (_, key) => variables[key] || `{${key}}`);

    return {
      sujet_email:   replace(modele.sujet_email  || ''),
      contenu_email: replace(modele.contenu_email || ''),
      contenu_sms:   replace(modele.contenu_sms  || ''),
    };
  },

  /**
   * Envoie un email via Nodemailer (ou simule si SMTP non configuré)
   */
  async sendEmail({ to, subject, body, dossier_id, type }) {
    if (!to) {
      logger.warn('sendEmail : destinataire manquant', { dossier_id, type });
      return false;
    }

    const simulation = SIMULATION_MODE();

    if (!simulation) {
      try {
        const transporter = getTransporter();
        const from = process.env.SMTP_FROM || process.env.SMTP_USER;

        await transporter.sendMail({
          from,
          to,
          subject,
          html: body.replace(/\n/g, '<br>'),
          text: body,
        });

        logger.info('EMAIL envoyé (réel)', { to, subject, dossier_id, type });
      } catch (err) {
        logger.error('EMAIL échec envoi', { to, error: err.message, dossier_id, type });
        return false;
      }
    } else {
      logger.info('EMAIL envoyé (simulation — SMTP non configuré)', { to, subject, dossier_id, type });
    }

    // Log en base dans les deux cas
    await db.query(
      `INSERT INTO interactions (dossier_id, type, contenu, created_at)
       VALUES (?, 'email', ?, NOW())`,
      [dossier_id, `[${type}] ${subject}`]
    ).catch(err => logger.warn('[NotificationService] Erreur log interaction email', { error: err.message, dossier_id }));

    return true;
  },

  /**
   * Envoie un SMS (stub — à brancher avec Twilio/OVH en prod)
   */
  async sendSMS({ to, message, dossier_id, type }) {
    if (!to) {
      logger.warn('sendSMS : numéro manquant', { dossier_id, type });
      return false;
    }
    // TODO: intégrer Twilio
    // const client = twilio(accountSid, authToken);
    // await client.messages.create({ body: message, from: '+33XXXXXXXXX', to });

    logger.info('SMS envoyé (simulation)', { to, dossier_id, type });

    await db.query(
      `INSERT INTO interactions (dossier_id, type, contenu, created_at)
       VALUES (?, 'sms', ?, NOW())`,
      [dossier_id, `[${type}] ${message?.substring(0, 160)}`]
    ).catch(err => logger.warn('[NotificationService] Erreur log interaction sms', { error: err.message, dossier_id }));

    return true;
  },

  /**
   * UC-21 : Envoi félicitations admis théorie + info inscription auto pratique
   */
  async sendAdmisTheorie({ dossier, note }) {
    const variables = {
      NOM:       dossier.nom,
      PRENOM:    dossier.prenom,
      FORMATION: dossier.formation_souhaitee || 'la formation',
      NOTE:      note ? `${note}/20` : '',
      DATE:      new Date().toLocaleDateString('fr-FR'),
    };

    const modele = await NotificationService.renderTemplate(
      'admis_theorie', variables
    ) || {
      sujet_email:   `Félicitations ${variables.PRENOM} — Théorie réussie ! Vous passez en Pratique 🎉`,
      contenu_email: `Bonjour ${variables.PRENOM} ${variables.NOM},\n\nBravo ! Vous avez réussi la partie théorique de votre formation "${variables.FORMATION}"${variables.NOTE ? ` avec la note de ${variables.NOTE}` : ''} !\n\nVous êtes automatiquement inscrit(e) à la session pratique. Notre équipe vous contactera prochainement pour vous communiquer les détails.\n\nContinuez sur cette belle lancée !\n\nCordialement,\nL'équipe LeadFlow`,
      contenu_sms:   `Félicitations ${variables.PRENOM} ! Théorie réussie${variables.NOTE ? ` (${variables.NOTE})` : ''}. Vous êtes inscrit(e) en pratique. Notre équipe vous contacte bientôt.`,
    };

    let envoyes = 0;
    if (dossier.email) {
      await NotificationService.sendEmail({
        to:         dossier.email,
        subject:    modele.sujet_email,
        body:       modele.contenu_email,
        dossier_id: dossier.dossier_id || dossier.id,
        type:       'admis_theorie',
      });
      envoyes++;
    }
    if (dossier.telephone) {
      await NotificationService.sendSMS({
        to:         dossier.telephone,
        message:    modele.contenu_sms,
        dossier_id: dossier.dossier_id || dossier.id,
        type:       'admis_theorie',
      });
      envoyes++;
    }
    return envoyes;
  },

  /**
   * UC-22 : Envoi proposition réinscription (échec théorie ou pratique)
   */
  async sendEchecReinscription({ dossier, typeEpreuve, note }) {
    const variables = {
      NOM:        dossier.nom,
      PRENOM:     dossier.prenom,
      FORMATION:  dossier.formation_souhaitee || 'la formation',
      EPREUVE:    typeEpreuve === 'theorie' ? 'théorique' : 'pratique',
      NOTE:       note ? `${note}/20` : 'non communiquée',
      DATE:       new Date().toLocaleDateString('fr-FR'),
    };

    const modele = await NotificationService.renderTemplate(
      `echec_${typeEpreuve}`, variables
    ) || {
      sujet_email:   `Suite à votre examen ${variables.EPREUVE} — ${variables.FORMATION}`,
      contenu_email: `Bonjour ${variables.PRENOM} ${variables.NOM},\n\nNous avons bien pris connaissance de votre résultat à l'examen ${variables.EPREUVE} de ${variables.FORMATION} (note : ${variables.NOTE}).\n\nNe vous découragez pas, un résultat ne définit pas votre potentiel ! Nous vous proposons de vous réinscrire à la prochaine session disponible. Notre équipe prendra contact avec vous prochainement.\n\nCordialement,\nL'équipe LeadFlow`,
      contenu_sms:   `Bonjour ${variables.PRENOM}, résultat examen ${variables.EPREUVE} de ${variables.FORMATION} : ${variables.NOTE}. Nous vous proposons une réinscription. Contactez-nous.`,
    };

    let envoyes = 0;
    if (dossier.email) {
      await NotificationService.sendEmail({
        to:        dossier.email,
        subject:   modele.sujet_email,
        body:      modele.contenu_email,
        dossier_id: dossier.dossier_id || dossier.id,
        type:      'echec_reinscription',
      });
      envoyes++;
    }
    if (dossier.telephone) {
      await NotificationService.sendSMS({
        to:        dossier.telephone,
        message:   modele.contenu_sms,
        dossier_id: dossier.dossier_id || dossier.id,
        type:      'echec_reinscription',
      });
      envoyes++;
    }
    return envoyes;
  },

  /**
   * UC-23 : Envoi félicitations + proposition de services (diplômé)
   */
  async sendFelicitations({ dossier, note }) {
    const variables = {
      NOM:       dossier.nom,
      PRENOM:    dossier.prenom,
      FORMATION: dossier.formation_souhaitee || 'la formation',
      NOTE:      note ? `${note}/20` : '',
      DATE:      new Date().toLocaleDateString('fr-FR'),
    };

    const modele = await NotificationService.renderTemplate(
      'felicitations_diplome', variables
    ) || {
      sujet_email:   `Félicitations ${variables.PRENOM} — Vous êtes diplômé(e) ! 🎓`,
      contenu_email: `Bonjour ${variables.PRENOM} ${variables.NOM},\n\nToute l'équipe vous félicite chaleureusement pour l'obtention de votre diplôme "${variables.FORMATION}"${variables.NOTE ? ` avec la note de ${variables.NOTE}` : ''} !\n\nPour aller encore plus loin dans votre parcours, nous vous proposons :\n• Assistance à la création de votre société\n• Hébergement et domiciliation de société\n• Accompagnement dans vos démarches administratives\n\nN'hésitez pas à nous contacter pour en savoir plus.\n\nEncore bravo et bonne continuation !\nL'équipe LeadFlow`,
      contenu_sms:   `Félicitations ${variables.PRENOM} ! Vous êtes diplômé(e) en "${variables.FORMATION}" ! Nous pouvons vous aider pour la création de société ou l'hébergement. Contactez-nous !`,
    };

    let envoyes = 0;
    if (dossier.email) {
      await NotificationService.sendEmail({
        to:        dossier.email,
        subject:   modele.sujet_email,
        body:      modele.contenu_email,
        dossier_id: dossier.dossier_id || dossier.id,
        type:      'felicitations',
      });
      envoyes++;
    }
    if (dossier.telephone) {
      await NotificationService.sendSMS({
        to:        dossier.telephone,
        message:   modele.contenu_sms,
        dossier_id: dossier.dossier_id || dossier.id,
        type:      'felicitations',
      });
      envoyes++;
    }
    return envoyes;
  },
};

module.exports = NotificationService;
