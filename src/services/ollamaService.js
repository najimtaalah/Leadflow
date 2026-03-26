'use strict';

/**
 * ────────────────────────────────────────────────────────────────────────────
 * ollamaService.js — Génération de contenu IA via Ollama (local, gratuit)
 * ────────────────────────────────────────────────────────────────────────────
 * Configuration .env :
 *   OLLAMA_BASE_URL=http://localhost:11434   (défaut)
 *   OLLAMA_MODEL=llama3                      (défaut — ou mistral, gemma, etc.)
 *
 * Installer Ollama : https://ollama.com
 * Télécharger le modèle : ollama pull llama3
 * ────────────────────────────────────────────────────────────────────────────
 */

const OLLAMA_BASE = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
const MODEL       = process.env.OLLAMA_MODEL || 'llama3';

/* ── Helpers ── */

async function fetchOllama(path, body) {
  const res = await fetch(`${OLLAMA_BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(60_000), // 60s max
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama ${res.status}: ${text}`);
  }
  return res.json();
}

/* ── Disponibilité ── */

async function isAvailable() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(3_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function listModels() {
  try {
    const res  = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(5_000) });
    const data = await res.json();
    return (data.models || []).map((m) => m.name);
  } catch {
    return [];
  }
}

/* ── Génération brute ── */

async function generate(prompt, options = {}) {
  const data = await fetchOllama('/api/generate', {
    model:  options.model || MODEL,
    prompt,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.max_tokens  ?? 400,
    },
  });
  return (data.response || '').trim();
}

/* ── Emails automatiques CMA ── */

const EMAIL_PROMPTS = {
  admis_theorie: ({ prenom, nom, formation }) =>
    `Tu es un assistant RH pour un centre de formation professionnelle. Rédige un email court et professionnel en français pour féliciter ${prenom} ${nom} d'avoir réussi la partie théorique de la formation "${formation}". Informe-le/la qu'il/elle est automatiquement inscrit(e) en pratique et que l'équipe le/la contactera. Sois chaleureux(se) et encourageant(e). 3 à 4 phrases maximum. Ne mets pas d'objet, juste le corps du mail.`,

  echec_theorie: ({ prenom, nom, formation }) =>
    `Tu es un assistant RH pour un centre de formation professionnelle. Rédige un email court et bienveillant en français pour ${prenom} ${nom} qui n'a pas obtenu la moyenne à la théorie de la formation "${formation}". Encourage-le/la et propose-lui de se réinscrire à la prochaine session. Sois empathique et positif(ve). 3 à 4 phrases maximum. Ne mets pas d'objet.`,

  admis_pratique: ({ prenom, nom, formation }) =>
    `Tu es un assistant RH pour un centre de formation professionnelle. Rédige un email de félicitations en français pour ${prenom} ${nom} qui vient d'être officiellement diplômé(e) en "${formation}". Félicite-le/la chaleureusement et propose des services complémentaires comme la création d'entreprise ou l'hébergement web. 4 à 5 phrases maximum. Ne mets pas d'objet.`,

  echec_pratique: ({ prenom, nom, formation }) =>
    `Tu es un assistant RH pour un centre de formation professionnelle. Rédige un email bienveillant en français pour ${prenom} ${nom} qui n'a pas réussi la pratique de la formation "${formation}". Encourage-le/la à ne pas se décourager et propose de se réinscrire à la prochaine session pratique. Sois positif(ve) et soutenant(e). 3 à 4 phrases maximum. Ne mets pas d'objet.`,
};

const EMAIL_DEFAULTS = {
  admis_theorie: ({ prenom, nom, formation }) =>
    `Bonjour ${prenom} ${nom},\n\nFélicitations ! Vous avez brillamment réussi la partie théorique de votre formation "${formation}". Vous êtes automatiquement inscrit(e) en pratique — notre équipe vous contactera très prochainement.\n\nBravo et continuez sur cette belle lancée !\n\nCordialement,\nL'équipe pédagogique`,

  echec_theorie: ({ prenom, nom, formation }) =>
    `Bonjour ${prenom} ${nom},\n\nNous avons pris connaissance de votre résultat à la partie théorique de la formation "${formation}". Ne vous découragez pas, un résultat ne définit pas votre potentiel ! Nous vous proposons de vous réinscrire à la prochaine session — notre équipe reste disponible pour vous accompagner.\n\nCordialement,\nL'équipe pédagogique`,

  admis_pratique: ({ prenom, nom, formation }) =>
    `Bonjour ${prenom} ${nom},\n\nToutes nos félicitations ! Vous êtes officiellement diplômé(e) en "${formation}" ! C'est une belle réussite dont vous pouvez être fier(e). Pour aller encore plus loin, nous vous proposons des services complémentaires : création d'entreprise, hébergement web, accompagnement professionnel. Contactez-nous pour en savoir plus.\n\nEncore bravo !\nL'équipe`,

  echec_pratique: ({ prenom, nom, formation }) =>
    `Bonjour ${prenom} ${nom},\n\nNous avons pris connaissance de votre résultat à la pratique de "${formation}". Ne baissez pas les bras ! La pratique est souvent la partie la plus exigeante, et beaucoup réussissent à la deuxième tentative. Nous vous invitons à vous réinscrire à la prochaine session — notre équipe est là pour vous soutenir.\n\nCordialement,\nL'équipe pédagogique`,
};

async function generateEmailContent({ type, apprenant, formation }) {
  const ctx = {
    prenom:   apprenant.prenom || '',
    nom:      apprenant.nom    || '',
    formation: formation        || 'votre formation',
  };

  // Default content always available
  const defaultContent = EMAIL_DEFAULTS[type]?.(ctx) || '';

  // Try Ollama if available
  const promptFn = EMAIL_PROMPTS[type];
  if (!promptFn) return { content: defaultContent, source: 'default' };

  try {
    const ollamaOk = await isAvailable();
    if (!ollamaOk) return { content: defaultContent, source: 'default' };

    const content = await generate(promptFn(ctx), { temperature: 0.75, max_tokens: 300 });
    return { content: content || defaultContent, source: 'ollama' };
  } catch {
    return { content: defaultContent, source: 'default' };
  }
}

/* ── Scoring lead ── */

async function scoreLead(lead) {
  const prompt = `Tu es un expert CRM pour un centre de formation professionnelle. Analyse ce lead et donne un score de conversion entre 0 et 100.

Lead :
- Nom : ${lead.prenom} ${lead.nom}
- Source : ${lead.source || 'inconnue'}
- Formation souhaitée : ${lead.formation_souhaitee || 'non précisée'}
- Statut actuel : ${lead.statut || 'entrant'}
- Commentaires : ${lead.notes || 'aucun'}
- Jours depuis création : ${lead.jours_depuis_creation || '?'}

Réponds UNIQUEMENT avec un JSON valide dans ce format exact :
{"score": 75, "niveau": "chaud", "raison": "courte explication", "action": "recommandation concrète"}

Niveaux possibles : froid (0-30), tiède (31-60), chaud (61-80), très chaud (81-100)`;

  try {
    const ollamaOk = await isAvailable();
    if (!ollamaOk) return null;

    const raw = await generate(prompt, { temperature: 0.3, max_tokens: 150 });
    // Extract JSON from response
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

module.exports = {
  isAvailable,
  listModels,
  generate,
  generateEmailContent,
  scoreLead,
  MODEL,
  OLLAMA_BASE,
};
