'use strict';

/**
 * Tests unitaires — distributionService.js
 * Le module DB est mocké : aucune connexion MySQL requise.
 * Couvre : assignLead (round-robin, no-commercial), reassignToOriginal (actif / inactif).
 */

// ── Mock des dépendances DB avant tout require ────────────────────────────────
jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../src/models/Lead', () => ({
  findAvailableCommercial: jest.fn(),
  update:                  jest.fn(),
  getOriginalVendeur:      jest.fn(),
  createReassignation:     jest.fn(),
}));

jest.mock('../../src/models/Log', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../src/utils/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
}));

const DistributionService = require('../../src/services/distributionService');
const LeadModel           = require('../../src/models/Lead');
const db                  = require('../../src/config/database');

beforeEach(() => {
  jest.clearAllMocks();
});

// ────────────────────────────────────────────────────────────────
// assignLead
// ────────────────────────────────────────────────────────────────
describe('assignLead — round-robin', () => {

  test('Assigne le commercial avec le moins de leads actifs', async () => {
    LeadModel.findAvailableCommercial.mockResolvedValue({
      id: 7, prenom: 'Alice', nom: 'Dupont', leads_actifs: 2,
    });
    LeadModel.update.mockResolvedValue(true);

    const result = await DistributionService.assignLead(42);

    expect(result).toBe(7);
    expect(LeadModel.update).toHaveBeenCalledWith(42, { vendeur_id: 7 });
  });

  test('Retourne null si aucun commercial disponible', async () => {
    LeadModel.findAvailableCommercial.mockResolvedValue(null);

    const result = await DistributionService.assignLead(99);

    expect(result).toBeNull();
    expect(LeadModel.update).not.toHaveBeenCalled();
  });

  test('Filtre par agenceId si fourni', async () => {
    LeadModel.findAvailableCommercial.mockResolvedValue({
      id: 3, prenom: 'Bob', nom: 'Martin', leads_actifs: 0,
    });
    LeadModel.update.mockResolvedValue(true);

    await DistributionService.assignLead(10, 5);

    expect(LeadModel.findAvailableCommercial).toHaveBeenCalledWith(5);
  });

  test('Retourne null et logue si une erreur DB survient', async () => {
    LeadModel.findAvailableCommercial.mockRejectedValue(new Error('DB down'));

    const result = await DistributionService.assignLead(1);

    expect(result).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────
// reassignToOriginal
// ────────────────────────────────────────────────────────────────
describe('reassignToOriginal', () => {

  test('Réaffecte au commercial original actif', async () => {
    LeadModel.getOriginalVendeur.mockResolvedValue(11);
    db.query.mockResolvedValue([[{ id: 11, prenom: 'Claire', nom: 'Martin', actif: 1 }]]);
    LeadModel.update.mockResolvedValue(true);
    LeadModel.createReassignation.mockResolvedValue({});

    const result = await DistributionService.reassignToOriginal(55, 22, 1);

    expect(result).toBe(11);
    expect(LeadModel.update).toHaveBeenCalledWith(55, { vendeur_id: 11 });
    expect(LeadModel.createReassignation).toHaveBeenCalled();
  });

  test('Retourne null si le commercial original est inactif', async () => {
    LeadModel.getOriginalVendeur.mockResolvedValue(11);
    db.query.mockResolvedValue([[{ id: 11, prenom: 'Claire', nom: 'Martin', actif: 0 }]]);

    const result = await DistributionService.reassignToOriginal(55, 22, 1);

    expect(result).toBeNull();
    expect(LeadModel.update).not.toHaveBeenCalled();
  });

  test('Retourne null si le commercial original est introuvable', async () => {
    LeadModel.getOriginalVendeur.mockResolvedValue(999);
    db.query.mockResolvedValue([[]]); // aucun résultat

    const result = await DistributionService.reassignToOriginal(55, 22, 1);

    expect(result).toBeNull();
  });

  test('Retourne null en cas d\'erreur DB', async () => {
    LeadModel.getOriginalVendeur.mockRejectedValue(new Error('connection refused'));

    const result = await DistributionService.reassignToOriginal(1, 2, 3);

    expect(result).toBeNull();
  });

  test('Le motif de réassignation est auto_reassign_perdu', async () => {
    LeadModel.getOriginalVendeur.mockResolvedValue(11);
    db.query.mockResolvedValue([[{ id: 11, prenom: 'D', nom: 'E', actif: 1 }]]);
    LeadModel.update.mockResolvedValue(true);
    LeadModel.createReassignation.mockResolvedValue({});

    await DistributionService.reassignToOriginal(55, 22, 1);

    const callArgs = LeadModel.createReassignation.mock.calls[0][0];
    expect(callArgs.motif).toBe('auto_reassign_perdu');
    expect(callArgs.ancien_vendeur_id).toBe(22);
    expect(callArgs.nouveau_vendeur_id).toBe(11);
  });
});
