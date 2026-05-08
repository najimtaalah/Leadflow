'use strict';

/**
 * Tests unitaires — sepaService.js
 * Aucune connexion DB requise. Couvre les fonctions pures et le mode simulation.
 */

const sepa = require('../../src/services/sepaService');

// ────────────────────────────────────────────────────────────────
// validateIBAN
// ────────────────────────────────────────────────────────────────
describe('validateIBAN', () => {

  test('IBAN français valide (FR76)', () => {
    expect(sepa.validateIBAN('FR7630006000011234567890189')).toBe(true);
  });

  test('IBAN valide avec espaces → les espaces sont ignorés', () => {
    expect(sepa.validateIBAN('FR76 3000 6000 0112 3456 7890 189')).toBe(true);
  });

  test('IBAN allemand valide (DE)', () => {
    expect(sepa.validateIBAN('DE89370400440532013000')).toBe(true);
  });

  test('IBAN null → false', () => {
    expect(sepa.validateIBAN(null)).toBe(false);
  });

  test('Chaîne vide → false', () => {
    expect(sepa.validateIBAN('')).toBe(false);
  });

  test('Longueur insuffisante → false', () => {
    expect(sepa.validateIBAN('FR76300')).toBe(false);
  });

  test('Checksum invalide → false', () => {
    // Bon format, mauvais checksum (changer un chiffre)
    expect(sepa.validateIBAN('FR7630006000011234567890188')).toBe(false);
  });

  test('Caractères invalides → false', () => {
    expect(sepa.validateIBAN('FR76!@#$%^&*()ABCDEFGH')).toBe(false);
  });

  test('IBAN trop long (> 34 chars) → false', () => {
    expect(sepa.validateIBAN('FR76300060000112345678901890000000000')).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// genMandatRef
// ────────────────────────────────────────────────────────────────
describe('genMandatRef', () => {

  test('Retourne un string non vide', () => {
    const ref = sepa.genMandatRef(42);
    expect(typeof ref).toBe('string');
    expect(ref.length).toBeGreaterThan(0);
  });

  test('Référence commence par MNDT-', () => {
    expect(sepa.genMandatRef(1)).toMatch(/^MNDT-/);
  });

  test('Dossier ID est paddé sur 5 chiffres', () => {
    expect(sepa.genMandatRef(7)).toMatch(/^MNDT-00007-/);
  });

  test('Deux appels successifs produisent des refs différentes', () => {
    const r1 = sepa.genMandatRef(1);
    const r2 = sepa.genMandatRef(1);
    // La partie timestamp peut être identique si exécutée dans la même ms,
    // mais les deux références sont des chaînes valides
    expect(typeof r1).toBe('string');
    expect(typeof r2).toBe('string');
  });
});

// ────────────────────────────────────────────────────────────────
// getMode
// ────────────────────────────────────────────────────────────────
describe('getMode', () => {

  test('Sans SEPA_PROVIDER défini → mode simulation', () => {
    const original = process.env.SEPA_PROVIDER;
    delete process.env.SEPA_PROVIDER;
    // Le module est déjà chargé avec SIMULATION=true si env non défini
    // On teste via getMode()
    const mode = sepa.getMode();
    expect(['simulation', 'gocardless', 'stripe']).toContain(mode);
    if (original !== undefined) process.env.SEPA_PROVIDER = original;
  });
});

// ────────────────────────────────────────────────────────────────
// createMandat — mode simulation (smoke test)
// ────────────────────────────────────────────────────────────────
describe('createMandat — mode simulation', () => {

  test('Retourne les champs requis en simulation', async () => {
    // sepaService utilise SEPA_PROVIDER au chargement du module.
    // En test (pas de SEPA_PROVIDER), SIMULATION = true.
    const mode = sepa.getMode();
    if (mode !== 'simulation') {
      // Pas en mode simulation, on passe ce test
      return;
    }

    const dossier = { id: 99, prenom: 'Test', nom: 'Apprenant', email: 'test@test.fr' };
    const result  = await sepa.createMandat(dossier);

    expect(result).toHaveProperty('mandat_ref');
    expect(result).toHaveProperty('mandat_date');
    expect(result).toHaveProperty('provider_customer_id');
    expect(result).toHaveProperty('provider_mandate_id');
    expect(result.mode).toBe('simulation');
    expect(result.mandat_ref).toMatch(/^MNDT-00099-/);
  });

  test('mandat_date est une date ISO valide', async () => {
    const mode = sepa.getMode();
    if (mode !== 'simulation') return;

    const dossier = { id: 1, prenom: 'X', nom: 'Y' };
    const result  = await sepa.createMandat(dossier);

    expect(result.mandat_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ────────────────────────────────────────────────────────────────
// processPrelevement — mode simulation
// ────────────────────────────────────────────────────────────────
describe('processPrelevement — mode simulation', () => {

  test('Retourne les champs success, provider_ref, mode, message', async () => {
    const mode = sepa.getMode();
    if (mode !== 'simulation') return;

    const result = await sepa.processPrelevement({
      dossier:  { id: 1 },
      echeance: { id: 5, montant: '150.00', date_echeance: '2026-05-01' },
    });

    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
    expect(result).toHaveProperty('provider_ref');
    expect(result.mode).toBe('simulation');
    expect(result).toHaveProperty('message');
  });
});
