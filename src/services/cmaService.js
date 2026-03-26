'use strict';

const DossierModel = require('../models/Dossier');
const LogModel     = require('../models/Log');
const logger       = require('../utils/logger');

/**
 * Service CMA — gestion des frais et validation de dossier
 * UC-14 : saisie des frais CMA (Admin / Administratif uniquement)
 * UC-15 : validation bloquée si frais_cma_paye = 0
 */
const CMAService = {

  /**
   * Vérifie si un dossier peut être validé
   * Règle : frais_cma_paye doit être 1 si frais_cma a été saisi
   * @returns {{ ok: boolean, reason?: string }}
   */
  async checkValidation(dossierId) {
    const dossier = await DossierModel.findById(dossierId);
    if (!dossier) return { ok: false, reason: 'DOSSIER_NOT_FOUND' };

    // Si des frais CMA ont été saisis mais pas payés → blocage
    if (dossier.frais_cma !== null && dossier.frais_cma_paye === 0) {
      return {
        ok:     false,
        reason: 'CMA_NOT_PAID',
        message: `Frais CMA non réglés (${dossier.frais_cma}€). Validation impossible.`,
      };
    }

    return { ok: true };
  },

  /**
   * Saisie des frais CMA (UC-14)
   * Seuls Admin et Administratif peuvent saisir — vérifié dans le controller
   */
  async saveFraisCMA(dossierId, { montant, pieces_ok, espace_cma_ouvert, paye, userId }) {
    const updates = {};

    if (montant      !== undefined) updates.frais_cma          = parseFloat(montant);
    if (paye         !== undefined) updates.frais_cma_paye     = paye ? 1 : 0;

    await DossierModel.update(dossierId, updates);

    // Stocker les infos CMA complémentaires dans un champ JSON si besoin
    // (ou dans une table dédiée si le schema l'exige)
    await LogModel.create({
      action:  'cma_updated',
      user_id: userId,
      details: { dossierId, montant, pieces_ok, espace_cma_ouvert, paye },
    });

    logger.info('Frais CMA mis à jour', { dossierId, montant, paye, by: userId });

    // Si frais payés, vérifier si l'alerte Dashboard doit être retirée
    if (paye) {
      logger.info('Dossier débloqué — CMA réglée', { dossierId });
    }

    return updates;
  },

  /**
   * Liste des dossiers avec CMA en attente (pour le Dashboard et l'onglet CMA)
   */
  async getDossiersCMAEnAttente(agenceId = null) {
    const result = await DossierModel.findAll({
      cma_non_reglee: true,
      archived:       0,
      agence_id:      agenceId,
    });
    return result.dossiers;
  },

  /**
   * Statistiques CMA pour le Dashboard
   */
  async getStatsCMA(agenceId = null) {
    const kpis = await DossierModel.getKpis(agenceId);
    return {
      total_non_reglees: kpis.cma_non_reglees,
      total_dossiers:    kpis.actifs,
    };
  },
};

module.exports = CMAService;
