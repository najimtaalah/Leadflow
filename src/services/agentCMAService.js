'use strict';

const ResultatCMAModel   = require('../models/ResultatCMA');
const InscriptionModel   = require('../models/Inscription');
const LogModel           = require('../models/Log');
const NotificationService = require('./notificationService');
const logger             = require('../utils/logger');

/**
 * Service Agent IA CMA
 * UC-20 : synchronisation manuelle
 * UC-21 : admis théorie → inscription auto pratique
 * UC-22 : échec → mail + SMS réinscription
 * UC-23 : diplômé → félicitations + services
 * UC-24 : synchronisation automatique planifiée
 */
const AgentCMAService = {

  /**
   * Point d'entrée principal de la synchronisation
   * Appelé par : bouton manuel (UC-20) et cron planifié (UC-24)
   *
   * @param {string} source  'manuel' | 'auto'
   * @param {object} options { sessionCode, agenceId }
   * @returns {object} rapport de synchronisation
   */
  async synchroniser(source = 'auto', options = {}) {
    const rapport = {
      source,
      date:               new Date().toISOString(),
      apprenants_presentes: 0,
      resultats_trouves:   0,
      en_attente:          0,
      messages_envoyes:    0,
      actions:             [],
      erreurs:             [],
    };

    try {
      logger.info(`[Agent CMA] Début synchronisation — source: ${source}`);

      // 1. Récupérer la liste des apprenants présentés à l'examen
      const presentes = await InscriptionModel.findPresentes({
        sessionCode: options.sessionCode,
        agenceId:    options.agenceId,
      });
      rapport.apprenants_presentes = presentes.length;

      if (!presentes.length) {
        logger.info('[Agent CMA] Aucun apprenant présenté trouvé');
        return rapport;
      }

      // 2. Scraper les résultats du site CMA
      //    En production : remplacer par un vrai scraper (Puppeteer / Playwright)
      const resultatsScrapés = await AgentCMAService._scraperResultatsCMA(presentes);

      // 3. Traiter chaque résultat
      for (const item of resultatsScrapés) {
        try {
          await AgentCMAService._traiterResultat(item, rapport, source);
        } catch (err) {
          rapport.erreurs.push({
            dossier_id: item.dossier_id,
            nom:        `${item.prenom} ${item.nom}`,
            erreur:     err.message,
          });
          logger.error('[Agent CMA] Erreur traitement résultat', {
            dossier_id: item.dossier_id, error: err.message,
          });
        }
      }

      // 4. Mettre à jour les stats de config_sync_cma
      await ResultatCMAModel.updateSyncStats({
        nb_trouves:          rapport.resultats_trouves,
        nb_en_attente:       rapport.en_attente,
        nb_messages_envoyes: rapport.messages_envoyes,
      });

      logger.info('[Agent CMA] Synchronisation terminée', rapport);
      return rapport;

    } catch (err) {
      logger.error('[Agent CMA] Erreur critique synchronisation', { error: err.message });
      rapport.erreurs.push({ type: 'critique', erreur: err.message });
      return rapport;
    }
  },

  /**
   * Traite un résultat individuel et déclenche les actions auto
   * UC-21, UC-22, UC-23
   */
  async _traiterResultat(item, rapport, source) {
    const { dossier_id, session_code, type_epreuve, note, resultat } = item;

    // Upsert le résultat en base
    await ResultatCMAModel.upsert({
      dossier_id,
      session_code,
      type_epreuve,
      note,
      resultat,
      sync_source: source,
    });

    if (resultat === 'en_attente') {
      rapport.en_attente++;
      return;
    }

    rapport.resultats_trouves++;

    // ── UC-21 : Admis Théorie → Mail félicitations + Inscription auto Pratique ──
    if (resultat === 'admis' && type_epreuve === 'theorie') {
      // Envoyer email + SMS de félicitations pour la théorie réussie
      const nbEnvoyes = await NotificationService.sendAdmisTheorie({ dossier: item, note });
      rapport.messages_envoyes += nbEnvoyes;

      const action = await AgentCMAService._inscrireAutoPratique(item);
      const actionLabel = action.succes
        ? '↺ Inscrit automatiquement en Pratique + 📩 Mail félicitations'
        : '📩 Mail félicitations théorie envoyé';

      await ResultatCMAModel.upsert({
        dossier_id, session_code, type_epreuve, note, resultat,
        action_auto: actionLabel,
        sync_source: source,
      });

      rapport.actions.push({
        dossier_id,
        apprenant:        `${item.prenom} ${item.nom}`,
        type:             'admis_theorie',
        detail:           action.message,
        messages_envoyes: nbEnvoyes,
      });
    }

    // ── UC-22 : Échec → Mail + SMS réinscription ──────────────────────────
    if (resultat === 'echec') {
      const nbEnvoyes = await NotificationService.sendEchecReinscription({
        dossier:     item,
        typeEpreuve: type_epreuve,
        note,
      });
      rapport.messages_envoyes += nbEnvoyes;

      const actionLabel = type_epreuve === 'theorie'
        ? '📩 Mail + SMS proposition réinscription théorie'
        : '📩 SMS proposition réinscription pratique';

      await ResultatCMAModel.upsert({
        dossier_id, session_code, type_epreuve, note, resultat,
        action_auto: actionLabel,
        sync_source: source,
      });

      rapport.actions.push({
        dossier_id,
        apprenant:      `${item.prenom} ${item.nom}`,
        type:           'echec_reinscription',
        messages_envoyes: nbEnvoyes,
      });
    }

    // ── UC-23 : Admis Pratique → Diplômé → Félicitations ─────────────────
    if (resultat === 'admis' && type_epreuve === 'pratique') {
      const nbEnvoyes = await NotificationService.sendFelicitations({
        dossier: item,
        note,
      });
      rapport.messages_envoyes += nbEnvoyes;

      await ResultatCMAModel.upsert({
        dossier_id, session_code, type_epreuve, note, resultat,
        action_auto: '🎉 Mail félicitations + services proposés',
        sync_source: source,
      });

      rapport.actions.push({
        dossier_id,
        apprenant:       `${item.prenom} ${item.nom}`,
        type:            'felicitations_diplome',
        messages_envoyes: nbEnvoyes,
      });

      // Statut géré directement sur le dossier via examen_id (inscriptions supprimées)
    }

    await LogModel.create({
      action:  'cma_resultat_traite',
      details: { dossier_id, session_code, type_epreuve, resultat, note },
    });
  },

  /**
   * UC-21 : Proposition manuelle d'examen après admis cours/EDOF
   * Avec le nouveau schéma (examen_id sur dossiers), l'assignation d'examen
   * se fait manuellement depuis la fiche dossier.
   */
  async _inscrireAutoPratique(item) {
    return {
      succes:  false,
      message: 'Assignation examen manuelle requise depuis la fiche dossier',
    };
  },

  /**
   * Scraper résultats CMA (stub de simulation)
   * UC-20 : en production, remplacer par Puppeteer/Playwright
   *
   * Simule des résultats pour les apprenants présentés :
   * - 70% admis, 20% échec, 10% en attente
   */
  async _scraperResultatsCMA(presentes) {
    logger.info('[Agent CMA] Scraping site CMA...', { count: presentes.length });

    // TODO: En production :
    // const browser = await puppeteer.launch({ headless: true });
    // const page = await browser.newPage();
    // await page.goto('https://site-cma.fr/resultats');
    // ... scraping ...
    // await browser.close();

    // Simulation : retourne des résultats mockés
    return presentes.map((p, idx) => {
      let resultat, note;

      // Simulation déterministe basée sur l'index pour les tests
      const modulo = idx % 10;
      if (modulo < 7) {
        resultat = 'admis';
        note     = (12 + (modulo * 1.2)).toFixed(1);
      } else if (modulo < 9) {
        resultat = 'echec';
        note     = (5 + modulo * 0.5).toFixed(1);
      } else {
        resultat = 'en_attente';
        note     = null;
      }

      return {
        dossier_id:     p.dossier_id,
        inscription_id: p.inscription_id,
        nom:            p.nom,
        prenom:         p.prenom,
        email:          p.email,
        telephone:      p.telephone,
        formation_souhaitee: p.formation_nom,
        session_code:   p.code_session || `S${new Date().getFullYear()}-01`,
        type_epreuve:   p.type_partie,
        note:           note ? parseFloat(note) : null,
        resultat,
      };
    });
  },

  /**
   * UC-24 : Vérification et déclenchement de la sync automatique
   * À appeler depuis un cron job (node-cron ou agenda)
   */
  async checkAndRunAutoSync() {
    try {
      const config = await ResultatCMAModel.getSyncConfig();
      if (!config || !config.actif) {
        logger.info('[Agent CMA] Sync auto désactivée');
        return null;
      }

      const now          = new Date();
      const lastSync     = config.derniere_sync ? new Date(config.derniere_sync) : null;
      const frequenceMap = {
        nuit_06h:    24 * 60,   // toutes les 24h
        toutes_12h:  12 * 60,   // toutes les 12h
        toutes_6h:    6 * 60,   // toutes les 6h
      };
      const intervalleMin = frequenceMap[config.frequence] || 1440;

      // Vérifier si l'intervalle est écoulé
      if (lastSync) {
        const diffMin = (now - lastSync) / 60000;
        if (diffMin < intervalleMin) {
          logger.info('[Agent CMA] Sync auto : intervalle non écoulé', {
            diffMin: Math.round(diffMin),
            intervalleMin,
          });
          return null;
        }
      }

      logger.info('[Agent CMA] Démarrage sync automatique planifiée');
      return await AgentCMAService.synchroniser('auto');

    } catch (err) {
      logger.error('[Agent CMA] Erreur sync auto', { error: err.message });
      return null;
    }
  },
};

module.exports = AgentCMAService;
