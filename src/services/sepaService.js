'use strict';

/**
 * ────────────────────────────────────────────────────────────────────────────
 * sepaService.js — Prélèvement automatique SEPA
 * ────────────────────────────────────────────────────────────────────────────
 * Modes supportés (variable d'environnement SEPA_PROVIDER) :
 *   - 'gocardless' → GoCardless REST API (recommandé pour la France)
 *   - 'stripe'     → Stripe SEPA Debit
 *   - non défini   → Mode simulation (pour tests / démo locale)
 *
 * Configuration .env requise selon le provider :
 *   GOCARDLESS_ACCESS_TOKEN=live_xxxx    (ou sandbox_xxxx)
 *   GOCARDLESS_SANDBOX=true              (optionnel — force sandbox)
 *   STRIPE_SECRET_KEY=sk_live_xxxx
 * ────────────────────────────────────────────────────────────────────────────
 */

const PROVIDER   = (process.env.SEPA_PROVIDER || '').toLowerCase();
const SIMULATION = !PROVIDER || PROVIDER === 'simulation';

/* ── GoCardless client (chargé dynamiquement si besoin) ── */
let gcClient = null;
function getGCClient() {
  if (gcClient) return gcClient;
  const { GoCardlessClient, Environments } = require('gocardless-nodejs');
  const isSandbox = process.env.GOCARDLESS_SANDBOX === 'true' || process.env.GOCARDLESS_ACCESS_TOKEN?.startsWith('sandbox');
  gcClient = new GoCardlessClient(
    process.env.GOCARDLESS_ACCESS_TOKEN,
    isSandbox ? Environments.Sandbox : Environments.Live
  );
  return gcClient;
}

/* ── Stripe client (chargé dynamiquement si besoin) ── */
let stripeClient = null;
function getStripeClient() {
  if (stripeClient) return stripeClient;
  stripeClient = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

/* ──────────────────────────────────────────────────────────
   Fonctions publiques
   ────────────────────────────────────────────────────────── */

/**
 * Retourne le mode actif : 'simulation' | 'gocardless' | 'stripe'
 */
function getMode() {
  if (SIMULATION) return 'simulation';
  return PROVIDER;
}

/**
 * Génère une référence de mandat SEPA unique
 */
function genMandatRef(dossierId) {
  const ts = Date.now().toString(36).toUpperCase();
  return `MNDT-${String(dossierId).padStart(5, '0')}-${ts}`;
}

/**
 * Valide un IBAN (format basique + checksum Mod97)
 */
function validateIBAN(iban) {
  if (!iban) return false;
  const clean = iban.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(clean)) return false;
  // Déplacer les 4 premiers chars à la fin + convertir lettres → chiffres
  const rearranged = (clean.slice(4) + clean.slice(0, 4))
    .split('').map(c => isNaN(c) ? c.charCodeAt(0) - 55 : c).join('');
  // Mod 97
  let remainder = '';
  for (const ch of rearranged) {
    remainder = (BigInt(remainder + ch) % 97n).toString();
  }
  return remainder === '1';
}

/**
 * Crée un client + compte bancaire + mandat SEPA chez le provider
 * Retourne { mandat_ref, mandat_date, provider_customer_id, provider_mandate_id }
 */
async function createMandat(dossier) {
  const mandatRef = genMandatRef(dossier.id);

  if (SIMULATION) {
    return {
      mandat_ref:           mandatRef,
      mandat_date:          new Date().toISOString().split('T')[0],
      provider_customer_id: `SIM-CUST-${dossier.id}`,
      provider_mandate_id:  `SIM-MNDT-${dossier.id}`,
      mode:                 'simulation',
    };
  }

  if (PROVIDER === 'gocardless') {
    const gc = getGCClient();

    // 1. Créer le client GoCardless
    const customer = await gc.customers.create({
      email:        dossier.email || `dossier${dossier.id}@crm.local`,
      given_name:   dossier.prenom || 'Apprenant',
      family_name:  dossier.nom,
      address_line1: dossier.adresse || '',
      city:          dossier.ville  || '',
      postal_code:   dossier.code_postal || '',
      country_code:  'FR',
    });

    // 2. Créer le compte bancaire
    const bankAccount = await gc.customerBankAccounts.create({
      account_number:  dossier.iban.replace(/\s/g, ''),
      account_holder_name: `${dossier.prenom} ${dossier.nom}`,
      country_code:    'FR',
      links:           { customer: customer.id },
    });

    // 3. Créer le mandat SEPA
    const mandate = await gc.mandates.create({
      scheme: 'sepa_core',
      links:  { customer_bank_account: bankAccount.id },
      metadata: { dossier_id: String(dossier.id), ref_interne: mandatRef },
    });

    return {
      mandat_ref:           mandatRef,
      mandat_date:          new Date().toISOString().split('T')[0],
      provider_customer_id: customer.id,
      provider_mandate_id:  mandate.id,
      mode:                 'gocardless',
    };
  }

  if (PROVIDER === 'stripe') {
    const stripe = getStripeClient();

    const customer = await stripe.customers.create({
      email: dossier.email || undefined,
      name:  `${dossier.prenom} ${dossier.nom}`,
      metadata: { dossier_id: String(dossier.id) },
    });

    // SetupIntent pour enregistrer l'IBAN SEPA
    const setupIntent = await stripe.setupIntents.create({
      customer,
      payment_method_types: ['sepa_debit'],
    });

    return {
      mandat_ref:           mandatRef,
      mandat_date:          new Date().toISOString().split('T')[0],
      provider_customer_id: customer.id,
      provider_setup_intent: setupIntent.id, // à confirmer côté client
      mode:                 'stripe',
      note:                 'Confirmation du mandat requise côté client (SetupIntent)',
    };
  }

  throw new Error(`Provider SEPA non supporté : ${PROVIDER}`);
}

/**
 * Exécute un prélèvement pour une échéance
 * Retourne { success, provider_ref, mode, message }
 */
async function processPrelevement({ dossier, echeance }) {
  if (SIMULATION) {
    // Simule un délai réseau
    await new Promise(r => setTimeout(r, 200));
    const success = Math.random() > 0.05; // 95% de succès en simulation
    return {
      success,
      provider_ref: `SIM-${Date.now()}`,
      mode:         'simulation',
      message:      success ? 'Prélèvement simulé avec succès' : 'Simulation : échec aléatoire (5%)',
    };
  }

  if (PROVIDER === 'gocardless') {
    const gc = getGCClient();

    if (!dossier.provider_mandate_id) {
      return { success: false, mode: 'gocardless', message: 'Mandat GoCardless non configuré pour ce dossier.' };
    }

    const payment = await gc.payments.create({
      amount:      Math.round(parseFloat(echeance.montant) * 100), // en centimes
      currency:    'EUR',
      description: `Mensualité ${echeance.date_echeance} — ${dossier.prenom} ${dossier.nom}`,
      retry_if_possible: false,
      links: { mandate: dossier.provider_mandate_id },
      metadata: { echeance_id: String(echeance.id), dossier_id: String(dossier.id) },
    });

    return {
      success:      true,
      provider_ref: payment.id,
      mode:         'gocardless',
      message:      `Prélèvement GoCardless créé (${payment.status})`,
    };
  }

  if (PROVIDER === 'stripe') {
    const stripe = getStripeClient();

    if (!dossier.provider_customer_id) {
      return { success: false, mode: 'stripe', message: 'Customer Stripe non configuré pour ce dossier.' };
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(parseFloat(echeance.montant) * 100),
      currency: 'eur',
      customer: dossier.provider_customer_id,
      payment_method_types: ['sepa_debit'],
      confirm: true,
      description: `Mensualité ${echeance.date_echeance} — Dossier #${dossier.id}`,
      metadata: { echeance_id: String(echeance.id) },
    });

    return {
      success:      paymentIntent.status !== 'requires_action',
      provider_ref: paymentIntent.id,
      mode:         'stripe',
      message:      `PaymentIntent Stripe : ${paymentIntent.status}`,
    };
  }

  throw new Error(`Provider SEPA non supporté : ${PROVIDER}`);
}

module.exports = { getMode, genMandatRef, validateIBAN, createMandat, processPrelevement };
