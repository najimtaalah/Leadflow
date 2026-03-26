'use strict';

/**
 * Job de rappels automatiques RDV
 * UC-33 — Envoi des rappels 24h avant le RDV si notif_rappel_24h = 1
 *
 * S'exécute une fois par heure et envoie les rappels pour les RDV du lendemain
 * À appeler dans server.js : require('./jobs/rappelsRdvJob').start();
 */

const RDVModel            = require('../models/RDV');
const LogModel            = require('../models/Log');
const NotificationService = require('../services/notificationService');
const logger              = require('../utils/logger');

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // toutes les heures

let intervalId = null;

const RappelsRdvJob = {

  start() {
    if (intervalId) return;
    logger.info('[RappelsRdv] Démarrage — vérification toutes les heures');
    RappelsRdvJob._run();
    intervalId = setInterval(RappelsRdvJob._run, CHECK_INTERVAL_MS);
  },

  stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      logger.info('[RappelsRdv] Arrêté');
    }
  },

  async _run() {
    try {
      const rdvs = await RDVModel.findRappels24h();
      if (!rdvs.length) return;

      logger.info(`[RappelsRdv] ${rdvs.length} rappel(s) à envoyer`);

      for (const rdv of rdvs) {
        try {
          let envoyes = 0;

          // Email à la personne concernée
          if (rdv.personne_email) {
            await NotificationService.sendEmail({
              to:         rdv.personne_email,
              subject:    `Rappel — Votre RDV demain ${rdv.date_rdv} à ${rdv.heure_debut}`,
              body:       `Bonjour ${rdv.personne_nom || 'Client'},\n\nRappel de votre rendez-vous prévu demain le ${rdv.date_rdv} à ${rdv.heure_debut}.\nResponsable : ${rdv.responsable_nom}\nObjet : ${rdv.titre}\n\nÀ bientôt,\nL'équipe LeadFlow`,
              dossier_id: rdv.dossier_id,
              type:       'rdv_rappel_24h',
            });
            envoyes++;
          }

          // SMS
          if (rdv.personne_tel) {
            await NotificationService.sendSMS({
              to:         rdv.personne_tel,
              message:    `Rappel : RDV demain ${rdv.date_rdv} à ${rdv.heure_debut} avec ${rdv.responsable_nom}. LeadFlow`,
              dossier_id: rdv.dossier_id,
              type:       'rdv_rappel_24h',
            });
            envoyes++;
          }

          await LogModel.create({
            action:  'rdv_rappel_24h_envoye',
            details: { rdv_id: rdv.id, date: rdv.date_rdv, canaux: envoyes },
          });

          logger.info('[RappelsRdv] Rappel envoyé', {
            rdv_id:  rdv.id,
            date:    rdv.date_rdv,
            canaux:  envoyes,
          });

        } catch (err) {
          logger.error('[RappelsRdv] Erreur envoi rappel', {
            rdv_id: rdv.id, error: err.message,
          });
        }
      }

    } catch (err) {
      logger.error('[RappelsRdv] Erreur critique', { error: err.message });
    }
  },
};

module.exports = RappelsRdvJob;
