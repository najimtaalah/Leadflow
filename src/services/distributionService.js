'use strict';

const LeadModel  = require('../models/Lead');
const LogModel   = require('../models/Log');
const logger     = require('../utils/logger');

/**
 * Service de distribution automatique des leads
 * UC-05 / UC-06 : distribution selon config_distribution + limites agent
 */
const DistributionService = {

  /**
   * Assigne automatiquement un commercial à un lead entrant
   * Algorithme : round-robin pondéré par leads actifs (le moins chargé en premier)
   * @returns {number|null} vendeur_id assigné ou null si aucun disponible
   */
  async assignLead(leadId, agenceId = null) {
    try {
      const commercial = await LeadModel.findAvailableCommercial(agenceId);

      if (!commercial) {
        logger.warn('Distribution : aucun commercial disponible', { leadId, agenceId });
        await LogModel.create({
          action:  'lead_distribution_failed',
          details: { leadId, reason: 'no_commercial_available', agenceId },
        });
        return null;
      }

      // Assigner le lead au commercial trouvé
      await LeadModel.update(leadId, { vendeur_id: commercial.id });

      logger.info('Lead assigné automatiquement', {
        leadId,
        vendeur_id:  commercial.id,
        vendeur_nom: `${commercial.prenom} ${commercial.nom}`,
        leads_actifs: commercial.leads_actifs,
      });

      await LogModel.create({
        action:  'lead_assigned',
        details: {
          leadId,
          vendeur_id:  commercial.id,
          leads_actifs: commercial.leads_actifs,
          methode:     'auto_round_robin',
        },
      });

      return commercial.id;

    } catch (err) {
      logger.error('Erreur distribution lead', { leadId, error: err.message });
      return null;
    }
  },

  /**
   * Réaffectation automatique au commercial initial — UC-09
   * Déclenché quand statut passe à 'perdu' ou 'annule'
   */
  async reassignToOriginal(leadId, currentVendeurId, systemUserId) {
    try {
      const originalVendeurId = await LeadModel.getOriginalVendeur(leadId);

      // Vérifier que le commercial original est actif
      const db = require('../config/database');
      const [[vendeur]] = await db.query(
        'SELECT id, prenom, nom, actif FROM users WHERE id = ?',
        [originalVendeurId]
      );

      if (!vendeur || !vendeur.actif) {
        // Commercial inactif → pas de réaffectation auto, alerte ROLE_ADMIN
        logger.warn('Réaffectation impossible — commercial initial inactif', {
          leadId, originalVendeurId,
        });
        await LogModel.create({
          action:  'lead_reassign_failed',
          details: { leadId, reason: 'original_commercial_inactive', originalVendeurId },
        });
        return null;
      }

      // Réaffecter
      await LeadModel.update(leadId, { vendeur_id: originalVendeurId });
      await LeadModel.createReassignation({
        lead_id:           leadId,
        ancien_vendeur_id: currentVendeurId,
        nouveau_vendeur_id: originalVendeurId,
        motif:             'auto_reassign_perdu',
        fait_par:          systemUserId,
      });

      logger.info('Lead réaffecté automatiquement', {
        leadId,
        de:  currentVendeurId,
        vers: originalVendeurId,
      });

      return originalVendeurId;

    } catch (err) {
      logger.error('Erreur réaffectation lead', { leadId, error: err.message });
      return null;
    }
  },
};

module.exports = DistributionService;
