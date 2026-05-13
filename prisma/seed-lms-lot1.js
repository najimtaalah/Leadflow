'use strict';

/**
 * Seeder LMS — Lot 1 : Tronc commun M01→M07b
 * Épreuves A (10 QCM), B (16 QCM+QRC), C (20 QCM), D (QCM+QRC), E (20 QCM)
 *
 * Usage : node prisma/seed-lms-lot1.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── helpers ──────────────────────────────────────────────────────────────────

async function upsertModule(data) {
  const m = await prisma.module.upsert({ where: { id: data.id }, update: {}, create: data });
  console.log(`  ✅ Module : ${m.titre}`);
  return m;
}

async function upsertLesson(data) {
  const l = await prisma.lesson.upsert({ where: { id: data.id }, update: {}, create: data });
  console.log(`     📖 Leçon : ${l.titre}`);
  return l;
}

async function upsertQCMs(list) {
  for (const q of list) {
    await prisma.quizQuestion.upsert({ where: { id: q.id }, update: {}, create: q });
  }
  console.log(`        ❓ ${list.length} questions créées`);
}

async function upsertFlashcards(list) {
  for (const fc of list) {
    await prisma.flashcard.upsert({ where: { id: fc.id }, update: {}, create: fc });
  }
  console.log(`        🎴 ${list.length} flashcards créées`);
}

async function upsertMedia(data) {
  await prisma.mediaAsset.upsert({ where: { id: data.id }, update: {}, create: data });
}

// ─── M01 / Ch2 — Carte professionnelle et sanctions T3P ───────────────────────

async function seedM01Ch2() {
  const lesson = await upsertLesson({
    id:               'm01-ch2-carte-pro',
    module_id:        'm01-t3p-intro',
    titre:            'La carte professionnelle T3P',
    objectif:         'Connaître les conditions d\'obtention, les obligations et les sanctions liées à la carte professionnelle T3P.',
    duration_seconds: 420,
    interaction_type: 'quiz',
    media_prompt:     'Illustration pédagogique sobre : gros plan sur une carte professionnelle de conducteur T3P française, fond bleu institutionnel, logo République Française, texte "Conducteur de Véhicule de Taxi / VTC / VMDTR". Style officiel, haute résolution.',
    content_blocks: [
      { type: 'heading', level: 1, text: 'La carte professionnelle T3P' },
      { type: 'paragraph', text: 'Pour exercer en tant que conducteur T3P (Taxi, VTC ou VMDTR), vous devez impérativement détenir une **carte professionnelle** délivrée par le préfet du département. Elle atteste de votre aptitude à exercer le métier.' },
      { type: 'section', heading: '📋 Conditions d\'obtention', items: [
        'Être titulaire du **permis de conduire B** en cours de validité.',
        'Justifier d\'une **aptitude médicale** à la conduite professionnelle (visite médicale).',
        'N\'avoir pas fait l\'objet de certaines **condamnations pénales** (incapacités légales).',
        'Avoir réussi l\'**examen T3P** ou justifier d\'une VAE (Validation des Acquis de l\'Expérience).',
      ]},
      { type: 'section', heading: '🔄 Renouvellement', items: [
        'La carte est valable **5 ans** et doit être renouvelée avant expiration.',
        'Le renouvellement exige une **nouvelle visite médicale** et la vérification du casier judiciaire.',
        'En cas de retard de renouvellement, l\'exercice de l\'activité est **interdit**.',
      ]},
      { type: 'section', heading: '⚠️ Sanctions et retrait', items: [
        '**Retrait temporaire** : en cas de suspension du permis de conduire ou d\'infraction grave.',
        '**Retrait définitif** : condamnation pénale grave, récidive ou exercice illégal caractérisé.',
        'L\'exercice sans carte professionnelle est une **infraction pénale** (amende + interdiction d\'exercer).',
        'L\'autorité préfectorale peut prononcer un retrait **d\'office** sur signalement des forces de l\'ordre.',
      ]},
      { type: 'callout', variant: 'warning', text: '⚠️ Sans carte professionnelle valide, tout exercice de l\'activité T3P est illégal, même si vous disposez d\'un véhicule agréé et d\'une licence.' },
      { type: 'voix_off', text: 'La carte professionnelle T3P est le document indispensable à tout conducteur souhaitant exercer légalement. Elle est délivrée par la préfecture après vérification de votre permis de conduire B, de votre aptitude médicale, de votre casier judiciaire et de votre réussite à l\'examen. Elle est valable 5 ans. En cas d\'infraction grave, de suspension de permis ou de condamnation pénale, la carte peut être retirée temporairement ou définitivement par le préfet. Exercer sans carte professionnelle valide expose à des sanctions pénales lourdes.' },
    ],
  });

  await upsertQCMs([
    { id: 'm01-ch2-qcm-1', lesson_id: lesson.id, type: 'qcm', ordre: 1,
      question: 'Qui délivre la carte professionnelle T3P ?',
      choices: ['La mairie', 'Le préfet du département', 'Le ministère des transports', 'La chambre de commerce'],
      correct_answer: 'Le préfet du département',
      explanation: 'La carte professionnelle T3P est délivrée par le préfet (ou sous-préfet) du département du domicile du conducteur, après vérification des conditions d\'aptitude.',
      difficulty: 'easy', exam_tag: 'carte_professionnelle' },
    { id: 'm01-ch2-qcm-2', lesson_id: lesson.id, type: 'qcm', ordre: 2,
      question: 'Quelle est la durée de validité de la carte professionnelle T3P ?',
      choices: ['1 an', '3 ans', '5 ans', '10 ans'],
      correct_answer: '5 ans',
      explanation: 'La carte professionnelle T3P est valable 5 ans. Elle doit être renouvelée avant son expiration, sous peine d\'interdiction d\'exercer.',
      difficulty: 'easy', exam_tag: 'carte_professionnelle' },
    { id: 'm01-ch2-qcm-3', lesson_id: lesson.id, type: 'qcm', ordre: 3,
      question: 'Quelle condition médicale est requise pour obtenir la carte professionnelle ?',
      choices: ['Un certificat de bonne santé du médecin traitant', 'Une visite médicale d\'aptitude à la conduite professionnelle', 'Un bilan sanguin annuel', 'Aucune condition médicale n\'est exigée'],
      correct_answer: 'Une visite médicale d\'aptitude à la conduite professionnelle',
      explanation: 'Le candidat doit être déclaré apte à la conduite professionnelle par un médecin agréé. Cette visite est obligatoire à l\'obtention et au renouvellement.',
      difficulty: 'medium', exam_tag: 'aptitude_medicale' },
    { id: 'm01-ch2-qcm-4', lesson_id: lesson.id, type: 'qcm', ordre: 4,
      question: 'Un conducteur dont la carte professionnelle est expirée peut-il exercer ?',
      choices: ['Oui, pendant 3 mois de tolérance', 'Oui, si son véhicule est agréé', 'Non, l\'exercice est interdit', 'Oui, en attendant le renouvellement'],
      correct_answer: 'Non, l\'exercice est interdit',
      explanation: 'Toute carte professionnelle expirée retire immédiatement le droit d\'exercer. Il n\'existe aucune période de tolérance : le conducteur doit cesser toute activité T3P.',
      difficulty: 'medium', exam_tag: 'carte_professionnelle' },
    { id: 'm01-ch2-qcm-5', lesson_id: lesson.id, type: 'qcm', ordre: 5,
      question: 'Dans quel cas la carte professionnelle peut-elle être retirée définitivement ?',
      choices: ['En cas d\'excès de vitesse isolé', 'En cas de condamnation pénale grave', 'En cas de retard de renouvellement', 'En cas de changement de véhicule'],
      correct_answer: 'En cas de condamnation pénale grave',
      explanation: 'Le retrait définitif intervient notamment en cas de condamnation pénale grave (infractions listées par le Code des transports), de récidive ou d\'exercice illégal caractérisé.',
      difficulty: 'medium', exam_tag: 'sanctions' },
    { id: 'm01-ch2-qcm-6', lesson_id: lesson.id, type: 'qcm', ordre: 6,
      question: 'Quel document est exigé lors du renouvellement de la carte professionnelle T3P ?',
      choices: ['L\'acte de naissance', 'Un justificatif de propriété du véhicule', 'Un nouveau certificat médical d\'aptitude', 'La preuve d\'assurance du véhicule'],
      correct_answer: 'Un nouveau certificat médical d\'aptitude',
      explanation: 'Le renouvellement de la carte professionnelle nécessite une nouvelle visite médicale d\'aptitude à la conduite professionnelle, en plus de la vérification du permis et du casier judiciaire.',
      difficulty: 'medium', exam_tag: 'renouvellement' },
    { id: 'm01-ch2-qcm-7', lesson_id: lesson.id, type: 'qcm', ordre: 7,
      question: 'Quelles sont les conséquences pénales d\'un exercice de l\'activité T3P sans carte professionnelle valide ?',
      choices: ['Un simple avertissement préfectoral', 'Une amende et une interdiction d\'exercer', 'Une mise en demeure sans suite immédiate', 'Aucune sanction si le véhicule est en règle'],
      correct_answer: 'Une amende et une interdiction d\'exercer',
      explanation: 'L\'exercice sans carte professionnelle valide constitue une infraction pénale passible d\'une amende et d\'une interdiction d\'exercer, conformément au Code des transports.',
      difficulty: 'hard', exam_tag: 'sanctions' },
  ]);

  await upsertFlashcards([
    { id: 'm01-ch2-fc-1', lesson_id: lesson.id, ordre: 1,
      front: 'Carte professionnelle T3P',
      back: 'Document délivré par le préfet, valable 5 ans, obligatoire pour exercer l\'activité Taxi, VTC ou VMDTR.' },
    { id: 'm01-ch2-fc-2', lesson_id: lesson.id, ordre: 2,
      front: 'Retrait définitif de la carte pro',
      back: 'Prononcé en cas de condamnation pénale grave, de récidive ou d\'exercice illégal caractérisé par l\'autorité préfectorale.' },
    { id: 'm01-ch2-fc-3', lesson_id: lesson.id, ordre: 3,
      front: 'Aptitude médicale T3P',
      back: 'Visite médicale obligatoire auprès d\'un médecin agréé, requise à l\'obtention et au renouvellement de la carte professionnelle.' },
  ]);

  await upsertMedia({ id: 'm01-ch2-img-1', lesson_id: lesson.id, type: 'image',
    prompt: 'Illustration pédagogique sobre : gros plan sur une carte professionnelle de conducteur T3P française, fond bleu institutionnel, logo République Française.',
    alt_text: 'Carte professionnelle T3P délivrée par la préfecture', status: 'draft' });
}

// ─── M03 ──────────────────────────────────────────────────────────────────────

async function seedM03() {
  await upsertModule({
    id: 'm03-gestion', titre: 'M03 — Gestion d\'entreprise et comptabilité',
    ordre: 3, filiere: 'commun',
    objectif: 'Maîtriser les structures juridiques, les obligations comptables et la fiscalité applicables aux conducteurs T3P.',
    duree_estimee: 90,
  });

  // Ch1 — Structures juridiques
  const ch1 = await upsertLesson({
    id: 'm03-ch1-statuts', module_id: 'm03-gestion',
    titre: 'Choisir son statut juridique',
    objectif: 'Distinguer les principaux statuts juridiques accessibles aux conducteurs T3P et leurs implications.',
    duration_seconds: 480, interaction_type: 'quiz',
    media_prompt: 'Infographie comparant 4 statuts juridiques T3P : Auto-entrepreneur, EIRL, SARL, SAS. Tableau simple, fond blanc, couleurs vives, icônes représentatives pour chaque forme.',
    content_blocks: [
      { type: 'heading', level: 1, text: 'Choisir son statut juridique' },
      { type: 'paragraph', text: 'Avant de démarrer une activité T3P, vous devez choisir un **statut juridique** adapté. Ce choix détermine votre régime fiscal, vos obligations comptables et votre protection sociale.' },
      { type: 'section', heading: '🧑‍💼 Micro-entrepreneur (auto-entrepreneur)', items: [
        'Régime simplifié : cotisations sociales calculées sur le **chiffre d\'affaires réel**.',
        'Plafond annuel de CA : **77 700 € HT** (prestations de services) — au-delà, basculement obligatoire.',
        'Comptabilité allégée : pas de bilan, juste un livre des recettes.',
        'TVA : franchise en base jusqu\'à 36 800 €, puis assujettissement obligatoire.',
      ]},
      { type: 'section', heading: '🏢 SARL / EURL (société)', items: [
        'Personnalité morale distincte du gérant — **responsabilité limitée** aux apports.',
        'Imposition sur les sociétés (IS) par défaut ; option IR possible pour l\'EURL.',
        'Obligations comptables complètes : bilan, compte de résultat, liasse fiscale annuelle.',
        'Idéal pour un conducteur qui souhaite embaucher ou s\'associer.',
      ]},
      { type: 'section', heading: '🚀 SAS / SASU', items: [
        'Très flexible : statuts librement rédigés, aucun capital minimum.',
        'Président assimilé salarié : cotisations plus élevées mais meilleure protection sociale.',
        'Imposition IS ; dividendes possibles (soumis à la flat tax 30 %).',
      ]},
      { type: 'callout', variant: 'info', text: '💡 Pour débuter seul en T3P, le régime micro-entrepreneur est souvent le plus simple. Mais si votre CA dépasse le plafond ou si vous embauchez, une société devient indispensable.' },
      { type: 'voix_off', text: 'Le choix du statut juridique est une décision fondamentale avant de vous lancer. Le régime micro-entrepreneur est idéal pour démarrer : comptabilité simplifiée, cotisations proportionnelles au chiffre d\'affaires. Mais il est plafonné à 77 700 euros par an. Au-delà, vous devrez créer une société — EURL, SARL ou SAS. Ces formes offrent une responsabilité limitée et permettent d\'embaucher, mais impliquent des obligations comptables plus lourdes.' },
    ],
  });

  await upsertQCMs([
    { id: 'm03-ch1-qcm-1', lesson_id: ch1.id, type: 'qcm', ordre: 1,
      question: 'Quel est le plafond annuel de chiffre d\'affaires pour le régime micro-entrepreneur en prestations de services ?',
      choices: ['36 800 €', '77 700 €', '120 000 €', '150 000 €'],
      correct_answer: '77 700 €',
      explanation: 'En 2024, le plafond du régime micro-entrepreneur pour les prestations de services (dont T3P) est de 77 700 € HT. Au-delà, le basculement vers un régime réel est obligatoire.',
      difficulty: 'medium', exam_tag: 'micro_entrepreneur' },
    { id: 'm03-ch1-qcm-2', lesson_id: ch1.id, type: 'qcm', ordre: 2,
      question: 'Quelle forme juridique offre une responsabilité limitée aux apports du gérant ?',
      choices: ['Entreprise individuelle', 'Micro-entrepreneur', 'SARL', 'Toutes les formes'],
      correct_answer: 'SARL',
      explanation: 'La SARL (Société à Responsabilité Limitée) distingue le patrimoine du gérant de celui de la société. La responsabilité est limitée aux apports, contrairement à l\'entreprise individuelle.',
      difficulty: 'easy', exam_tag: 'statuts_juridiques' },
    { id: 'm03-ch1-qcm-3', lesson_id: ch1.id, type: 'qcm', ordre: 3,
      question: 'Quel régime fiscal s\'applique par défaut à une SARL ?',
      choices: ['Impôt sur le revenu (IR)', 'Impôt sur les sociétés (IS)', 'Micro-BIC', 'TVA réduite à 5,5 %'],
      correct_answer: 'Impôt sur les sociétés (IS)',
      explanation: 'La SARL est par défaut soumise à l\'impôt sur les sociétés (IS). Une option pour l\'impôt sur le revenu est possible sous conditions pour les SARL de famille ou les EURL.',
      difficulty: 'medium', exam_tag: 'fiscalite' },
    { id: 'm03-ch1-qcm-4', lesson_id: ch1.id, type: 'qcm', ordre: 4,
      question: 'Un conducteur VTC en micro-entrepreneur doit-il tenir une comptabilité complète (bilan + compte de résultat) ?',
      choices: ['Oui, comme toute entreprise', 'Non, il tient uniquement un livre des recettes', 'Oui, mais seulement si son CA dépasse 10 000 €', 'Non, aucune comptabilité n\'est exigée'],
      correct_answer: 'Non, il tient uniquement un livre des recettes',
      explanation: 'Le régime micro-entrepreneur bénéficie d\'une comptabilité allégée : tenue d\'un livre chronologique des recettes suffit. Aucun bilan ni compte de résultat n\'est exigé.',
      difficulty: 'easy', exam_tag: 'comptabilite' },
    { id: 'm03-ch1-qcm-5', lesson_id: ch1.id, type: 'qcm', ordre: 5,
      question: 'Quel est le statut social du président d\'une SAS ?',
      choices: ['Travailleur non salarié (TNS)', 'Assimilé salarié', 'Fonctionnaire', 'Aucun statut social obligatoire'],
      correct_answer: 'Assimilé salarié',
      explanation: 'Le président de SAS est assimilé salarié, affilié au régime général de la Sécurité sociale. Ses cotisations sont plus élevées qu\'un gérant TNS, mais sa protection sociale est meilleure.',
      difficulty: 'hard', exam_tag: 'statuts_juridiques' },
    { id: 'm03-ch1-qcm-6', lesson_id: ch1.id, type: 'qcm', ordre: 6,
      question: 'Que se passe-t-il si un micro-entrepreneur T3P dépasse le plafond de CA ?',
      choices: ['Il reçoit une amende fiscale', 'Il bascule automatiquement vers un régime réel d\'imposition', 'Il doit cesser son activité', 'Rien, le plafond est indicatif'],
      correct_answer: 'Il bascule automatiquement vers un régime réel d\'imposition',
      explanation: 'Le dépassement du plafond micro entraîne le basculement au régime réel (réel simplifié ou réel normal) dès l\'année suivante, avec obligations comptables complètes.',
      difficulty: 'medium', exam_tag: 'micro_entrepreneur' },
    { id: 'm03-ch1-qcm-7', lesson_id: ch1.id, type: 'qcm', ordre: 7,
      question: 'Quel document synthétise la situation financière d\'une société à une date donnée ?',
      choices: ['Le livre des recettes', 'Le bilan comptable', 'La déclaration de TVA', 'Le relevé bancaire'],
      correct_answer: 'Le bilan comptable',
      explanation: 'Le bilan présente l\'actif (ce que possède l\'entreprise) et le passif (ce qu\'elle doit) à une date donnée (clôture de l\'exercice). C\'est le document central de la comptabilité d\'entreprise.',
      difficulty: 'easy', exam_tag: 'comptabilite' },
    { id: 'm03-ch1-qcm-8', lesson_id: ch1.id, type: 'qcm', ordre: 8,
      question: 'Quelle forme juridique est recommandée pour un conducteur T3P souhaitant s\'associer avec un partenaire ?',
      choices: ['Micro-entrepreneur', 'Entreprise individuelle', 'SARL', 'EURL'],
      correct_answer: 'SARL',
      explanation: 'La SARL (au moins 2 associés) est la forme adaptée à l\'association. L\'EURL n\'a qu\'un seul associé. La micro-entreprise et l\'EI sont des statuts individuels.',
      difficulty: 'medium', exam_tag: 'statuts_juridiques' },
  ]);

  await upsertFlashcards([
    { id: 'm03-ch1-fc-1', lesson_id: ch1.id, ordre: 1,
      front: 'Micro-entrepreneur T3P',
      back: 'Régime simplifié, CA plafonné à 77 700 €/an (services), comptabilité allégée (livre des recettes uniquement).' },
    { id: 'm03-ch1-fc-2', lesson_id: ch1.id, ordre: 2,
      front: 'SARL',
      back: 'Société à Responsabilité Limitée — personnalité morale, responsabilité limitée aux apports, IS par défaut, obligations comptables complètes.' },
    { id: 'm03-ch1-fc-3', lesson_id: ch1.id, ordre: 3,
      front: 'Bilan comptable',
      back: 'Document récapitulatif de l\'actif (avoirs) et du passif (dettes) d\'une entreprise à la date de clôture de l\'exercice.' },
  ]);

  await upsertMedia({ id: 'm03-ch1-img-1', lesson_id: ch1.id, type: 'image',
    prompt: 'Infographie comparant 4 statuts juridiques T3P : Auto-entrepreneur, EIRL, SARL, SAS.',
    alt_text: 'Comparaison des statuts juridiques pour conducteurs T3P', status: 'draft' });

  // Ch2 — Fiscalité et gestion financière
  const ch2 = await upsertLesson({
    id: 'm03-ch2-fiscalite', module_id: 'm03-gestion',
    titre: 'Fiscalité et gestion financière T3P',
    objectif: 'Comprendre la TVA, les charges déductibles et les principaux indicateurs de gestion financière pour un conducteur T3P.',
    duration_seconds: 480, interaction_type: 'quiz',
    media_prompt: 'Illustration pédagogique : schéma de flux financiers d\'une entreprise T3P — recettes (courses), charges (carburant, assurance, entretien), résultat net. Style diagramme clair et coloré.',
    content_blocks: [
      { type: 'heading', level: 1, text: 'Fiscalité et gestion financière T3P' },
      { type: 'paragraph', text: 'Gérer une entreprise T3P implique de maîtriser la **TVA**, les **charges déductibles** et le calcul du **résultat**. Ces notions sont au cœur de l\'épreuve B.' },
      { type: 'section', heading: '💰 La TVA (Taxe sur la Valeur Ajoutée)', items: [
        'Taux normal applicable aux prestations T3P : **10 % pour les taxis** (taux réduit transport), **20 % pour les VTC**.',
        'Franchise en base TVA : exonéré si CA < 36 800 €. Au-delà, déclaration et collecte obligatoires.',
        'TVA collectée (sur ventes) − TVA déductible (sur achats) = TVA à reverser à l\'État.',
      ]},
      { type: 'section', heading: '📊 Charges déductibles', items: [
        '**Carburant** : charge d\'exploitation principale, totalement déductible.',
        '**Assurance professionnelle** : obligatoire et déductible.',
        '**Entretien et réparations** du véhicule professionnel : déductibles.',
        '**Cotisations sociales** (TNS ou salarié) : déductibles du résultat.',
        '**Loyer ou crédit-bail** du véhicule si utilisé à 100 % pour l\'activité.',
      ]},
      { type: 'section', heading: '📈 Compte de résultat simplifié', items: [
        'Chiffre d\'affaires (CA) — Charges d\'exploitation = **Résultat d\'exploitation**.',
        'Résultat d\'exploitation − Cotisations sociales et impôts = **Résultat net**.',
        'Un résultat positif est un **bénéfice** ; négatif, une **perte**.',
      ]},
      { type: 'callout', variant: 'info', text: '💡 Le seuil de rentabilité (point mort) est le CA minimum pour couvrir toutes les charges. En dessous, l\'activité est déficitaire.' },
      { type: 'voix_off', text: 'La fiscalité T3P est un domaine clé de l\'épreuve B. Les taxis appliquent un taux de TVA réduit à 10 %, tandis que les VTC sont soumis au taux normal de 20 %. En dessous de 36 800 euros de chiffre d\'affaires, vous bénéficiez de la franchise en base — pas de TVA à facturer ni à reverser. Au-delà, vous collectez la TVA sur vos ventes et déduisez celle de vos achats. Parmi les charges déductibles : carburant, assurance, entretien, cotisations sociales. Le résultat net, c\'est ce qu\'il reste après toutes les charges.' },
    ],
  });

  await upsertQCMs([
    { id: 'm03-ch2-qcm-1', lesson_id: ch2.id, type: 'qcm', ordre: 1,
      question: 'Quel taux de TVA s\'applique aux courses de taxi en France ?',
      choices: ['5,5 %', '10 %', '20 %', 'Exonération totale'],
      correct_answer: '10 %',
      explanation: 'Les courses de taxi bénéficient du taux réduit de TVA à 10 % (transport de voyageurs). Les courses VTC sont soumises au taux normal de 20 %.',
      difficulty: 'medium', exam_tag: 'tva' },
    { id: 'm03-ch2-qcm-2', lesson_id: ch2.id, type: 'qcm', ordre: 2,
      question: 'Jusqu\'à quel seuil de CA un conducteur T3P bénéficie-t-il de la franchise en base de TVA ?',
      choices: ['10 000 €', '36 800 €', '77 700 €', '100 000 €'],
      correct_answer: '36 800 €',
      explanation: 'La franchise en base de TVA s\'applique jusqu\'à 36 800 € de CA pour les prestations de services. En dessous, le conducteur ne facture pas et ne reverse pas de TVA.',
      difficulty: 'medium', exam_tag: 'tva' },
    { id: 'm03-ch2-qcm-3', lesson_id: ch2.id, type: 'qcm', ordre: 3,
      question: 'Comment calcule-t-on le résultat d\'exploitation d\'une entreprise T3P ?',
      choices: ['CA − TVA collectée', 'CA − charges d\'exploitation', 'CA × taux de marge', 'CA − impôt sur les sociétés'],
      correct_answer: 'CA − charges d\'exploitation',
      explanation: 'Le résultat d\'exploitation = Chiffre d\'affaires − Charges d\'exploitation (carburant, assurance, entretien, etc.). C\'est l\'indicateur de base de la rentabilité opérationnelle.',
      difficulty: 'easy', exam_tag: 'comptabilite' },
    { id: 'm03-ch2-qcm-4', lesson_id: ch2.id, type: 'qcm', ordre: 4,
      question: 'Le carburant est-il une charge déductible pour un conducteur T3P ?',
      choices: ['Non, jamais', 'Oui, totalement', 'Oui, à 50 % seulement', 'Seulement si le véhicule est électrique'],
      correct_answer: 'Oui, totalement',
      explanation: 'Le carburant utilisé pour l\'activité professionnelle est intégralement déductible du résultat imposable, à condition d\'être justifié par des factures ou relevés.',
      difficulty: 'easy', exam_tag: 'charges_deductibles' },
    { id: 'm03-ch2-qcm-5', lesson_id: ch2.id, type: 'qcm', ordre: 5,
      question: 'Qu\'est-ce que le seuil de rentabilité (point mort) ?',
      choices: ['Le CA maximum avant impôt', 'Le CA minimum pour couvrir toutes les charges', 'Le montant des charges fixes annuelles', 'Le CA à partir duquel la TVA est due'],
      correct_answer: 'Le CA minimum pour couvrir toutes les charges',
      explanation: 'Le seuil de rentabilité est le niveau de CA à partir duquel l\'entreprise ne fait ni bénéfice ni perte — toutes les charges sont couvertes. En dessous, l\'activité est déficitaire.',
      difficulty: 'medium', exam_tag: 'gestion_financiere' },
    { id: 'm03-ch2-qcm-6', lesson_id: ch2.id, type: 'qcm', ordre: 6,
      question: 'Un conducteur VTC collecte 200 € de TVA sur ses ventes et a payé 80 € de TVA sur ses achats. Combien reverse-t-il à l\'État ?',
      choices: ['200 €', '80 €', '120 €', '280 €'],
      correct_answer: '120 €',
      explanation: 'TVA à reverser = TVA collectée (200 €) − TVA déductible (80 €) = 120 €. C\'est le mécanisme fondamental de la TVA : le conducteur ne paye que la valeur ajoutée.',
      difficulty: 'hard', exam_tag: 'tva' },
    { id: 'm03-ch2-qcm-7', lesson_id: ch2.id, type: 'qcm', ordre: 7,
      question: 'Quel document présente les produits et les charges d\'une entreprise sur un exercice ?',
      choices: ['Le bilan', 'Le compte de résultat', 'La déclaration de TVA', 'Le livre des recettes'],
      correct_answer: 'Le compte de résultat',
      explanation: 'Le compte de résultat recense tous les produits (recettes) et charges (dépenses) sur l\'exercice, et indique si l\'entreprise est bénéficiaire ou déficitaire.',
      difficulty: 'easy', exam_tag: 'comptabilite' },
    { id: 'm03-ch2-qcm-8', lesson_id: ch2.id, type: 'qcm', ordre: 8,
      question: 'Quel taux de TVA s\'applique aux courses VTC en France ?',
      choices: ['0 %', '5,5 %', '10 %', '20 %'],
      correct_answer: '20 %',
      explanation: 'Les courses VTC (Véhicule de Tourisme avec Chauffeur) sont soumises au taux normal de TVA à 20 %, contrairement aux taxis qui bénéficient du taux réduit de 10 %.',
      difficulty: 'medium', exam_tag: 'tva' },
  ]);

  // 2 QRC → flashcards
  await upsertFlashcards([
    { id: 'm03-ch2-fc-1', lesson_id: ch2.id, ordre: 1,
      front: 'TVA collectée vs TVA déductible',
      back: 'TVA collectée : facturée au client sur les ventes. TVA déductible : payée sur les achats professionnels. À reverser = collectée − déductible.' },
    { id: 'm03-ch2-fc-2', lesson_id: ch2.id, ordre: 2,
      front: 'Charges déductibles T3P (4 exemples)',
      back: 'Carburant · Assurance professionnelle · Entretien/réparations du véhicule · Cotisations sociales.' },
    { id: 'm03-ch2-fc-3', lesson_id: ch2.id, ordre: 3,
      front: 'Compte de résultat',
      back: 'Document comptable présentant les produits (CA) et charges sur un exercice. Résultat = Produits − Charges.' },
  ]);

  await upsertMedia({ id: 'm03-ch2-img-1', lesson_id: ch2.id, type: 'image',
    prompt: 'Schéma de flux financiers d\'une entreprise T3P — recettes, charges, résultat net. Style diagramme clair.',
    alt_text: 'Flux financiers d\'une entreprise T3P : CA, charges déductibles, résultat net', status: 'draft' });
}

// ─── M05 ──────────────────────────────────────────────────────────────────────

async function seedM05() {
  await upsertModule({
    id: 'm05-securite', titre: 'M05 — Sécurité routière professionnelle',
    ordre: 5, filiere: 'commun',
    objectif: 'Maîtriser les règles de sécurité routière spécifiques à la conduite professionnelle T3P : signalisation, distances, vitesses, gestion des situations d\'urgence.',
    duree_estimee: 90,
  });

  // Ch1 — Code de la route professionnel
  const ch1 = await upsertLesson({
    id: 'm05-ch1-code-route', module_id: 'm05-securite',
    titre: 'Code de la route professionnel',
    objectif: 'Maîtriser la signalisation, les priorités, les vitesses et les distances de sécurité pour la conduite professionnelle.',
    duration_seconds: 480, interaction_type: 'quiz',
    media_prompt: 'Illustration pédagogique : tableau de panneaux de signalisation routière français les plus importants pour les conducteurs professionnels. Fond blanc, panneaux en couleurs officielles, légendes claires.',
    content_blocks: [
      { type: 'heading', level: 1, text: 'Code de la route professionnel' },
      { type: 'paragraph', text: 'L\'épreuve C porte sur la **sécurité routière** : signalisation, priorités, distances de sécurité, vitesses. Ces règles s\'appliquent à tous les conducteurs T3P.' },
      { type: 'section', heading: '🚦 Vitesses maximales autorisées', items: [
        'Autoroute (voie sèche) : **130 km/h**, 110 km/h par temps de pluie.',
        'Route nationale (hors agglomération) : **80 km/h** (depuis 2018).',
        'En agglomération : **50 km/h**, zones 30 : 30 km/h.',
        'Conducteur en période probatoire (< 2 ans permis) : −10 km/h sur toutes limites.',
      ]},
      { type: 'section', heading: '📏 Distances de sécurité', items: [
        'Règle des **2 secondes** : laisser passer 2 secondes entre votre passage et celui du véhicule devant.',
        'À 50 km/h : distance minimale ≈ **28 mètres**.',
        'À 80 km/h : distance minimale ≈ **44 mètres**.',
        'Par temps de pluie ou mauvaise visibilité : **doubler** la distance.',
      ]},
      { type: 'section', heading: '🔴 Priorités de passage', items: [
        'Priorité à droite dans les carrefours sans signalisation.',
        'Cédez le passage (triangle inversé) : s\'arrêter si nécessaire pour laisser passer.',
        'Stop (panneau octogonal rouge) : **arrêt complet obligatoire**, même sans visibilité de véhicule.',
        'Véhicules prioritaires (gyrophare + sirène) : dégager immédiatement la voie.',
      ]},
      { type: 'callout', variant: 'warning', text: '⚠️ En tant que conducteur professionnel, vous êtes soumis aux mêmes règles que les particuliers, mais votre responsabilité est aggravée en cas d\'infraction commise en service.' },
      { type: 'voix_off', text: 'L\'épreuve C de sécurité routière est l\'une des plus importantes : 20 questions, 30 minutes. Les vitesses maximales — 130 km/h sur autoroute, 80 km/h sur route hors agglomération, 50 km/h en ville — doivent être connues par cœur. Les distances de sécurité sont calculées selon la règle des 2 secondes : le temps entre votre passage sur un point et celui du véhicule devant vous. Un stop, c\'est un arrêt complet, même si la route semble dégagée. En tant que professionnel, votre responsabilité est renforcée.' },
    ],
  });

  await upsertQCMs([
    { id: 'm05-ch1-qcm-1', lesson_id: ch1.id, type: 'qcm', ordre: 1,
      question: 'Quelle est la vitesse maximale autorisée sur autoroute par temps sec pour un conducteur T3P ?',
      choices: ['110 km/h', '120 km/h', '130 km/h', '140 km/h'],
      correct_answer: '130 km/h',
      explanation: 'Sur autoroute par temps sec, la vitesse maximale est de 130 km/h pour tous les conducteurs de véhicules légers, y compris les conducteurs professionnels T3P.',
      difficulty: 'easy', exam_tag: 'vitesses' },
    { id: 'm05-ch1-qcm-2', lesson_id: ch1.id, type: 'qcm', ordre: 2,
      question: 'Quelle est la vitesse maximale sur une route nationale hors agglomération depuis 2018 ?',
      choices: ['70 km/h', '80 km/h', '90 km/h', '110 km/h'],
      correct_answer: '80 km/h',
      explanation: 'Depuis juillet 2018, la vitesse maximale sur les routes à double sens sans séparateur central est abaissée à 80 km/h (anciennement 90 km/h).',
      difficulty: 'easy', exam_tag: 'vitesses' },
    { id: 'm05-ch1-qcm-3', lesson_id: ch1.id, type: 'qcm', ordre: 3,
      question: 'Un conducteur titulaire du permis depuis 6 mois roule sur autoroute. Sa vitesse maximale est :',
      choices: ['130 km/h comme tout le monde', '120 km/h', '110 km/h', '100 km/h'],
      correct_answer: '110 km/h',
      explanation: 'Les conducteurs en période probatoire (moins de 2 ans de permis) ont une limite réduite : 110 km/h sur autoroute au lieu de 130 km/h.',
      difficulty: 'medium', exam_tag: 'vitesses' },
    { id: 'm05-ch1-qcm-4', lesson_id: ch1.id, type: 'qcm', ordre: 4,
      question: 'Devant un panneau STOP, que doit faire le conducteur ?',
      choices: ['Ralentir et céder le passage', 'Marquer un arrêt complet avant de s\'engager', 'S\'arrêter seulement si un véhicule arrive', 'Klaxonner et passer'],
      correct_answer: 'Marquer un arrêt complet avant de s\'engager',
      explanation: 'Le panneau STOP impose un arrêt complet du véhicule — roues bloquées — même si aucun véhicule n\'est visible. Ne pas s\'arrêter constitue une infraction grave.',
      difficulty: 'easy', exam_tag: 'priorites' },
    { id: 'm05-ch1-qcm-5', lesson_id: ch1.id, type: 'qcm', ordre: 5,
      question: 'La règle des 2 secondes permet de calculer :',
      choices: ['Le temps de réaction du conducteur', 'La distance de sécurité à maintenir derrière le véhicule précédent', 'La durée légale des pauses', 'Le délai avant de changer de file'],
      correct_answer: 'La distance de sécurité à maintenir derrière le véhicule précédent',
      explanation: 'La règle des 2 secondes : attendez 2 secondes après que le véhicule devant vous ait dépassé un point fixe avant de le dépasser vous-même. Elle garantit une distance de sécurité adaptée à la vitesse.',
      difficulty: 'easy', exam_tag: 'distances' },
    { id: 'm05-ch1-qcm-6', lesson_id: ch1.id, type: 'qcm', ordre: 6,
      question: 'Quelle est la distance de sécurité approximative à respecter à 80 km/h ?',
      choices: ['22 mètres', '33 mètres', '44 mètres', '66 mètres'],
      correct_answer: '44 mètres',
      explanation: 'À 80 km/h, la distance de sécurité correspond à environ 44 mètres (règle des 2 secondes). À 130 km/h, elle est de l\'ordre de 72 mètres.',
      difficulty: 'medium', exam_tag: 'distances' },
    { id: 'm05-ch1-qcm-7', lesson_id: ch1.id, type: 'qcm', ordre: 7,
      question: 'Que signifie le triangle inversé (pointe en bas) au bord de la route ?',
      choices: ['Stop — arrêt complet obligatoire', 'Priorité à droite', 'Cédez le passage — laisser passer si nécessaire', 'Route prioritaire'],
      correct_answer: 'Cédez le passage — laisser passer si nécessaire',
      explanation: 'Le panneau "Cédez le passage" (triangle inversé) indique que vous n\'avez pas la priorité. Vous devez céder le passage aux véhicules de la route que vous rejoignez, en vous arrêtant si nécessaire.',
      difficulty: 'easy', exam_tag: 'signalisation' },
    { id: 'm05-ch1-qcm-8', lesson_id: ch1.id, type: 'qcm', ordre: 8,
      question: 'Par temps de pluie, comment doit évoluer la distance de sécurité ?',
      choices: ['Elle reste la même', 'Elle est réduite de moitié', 'Elle est doublée', 'Elle est triplée'],
      correct_answer: 'Elle est doublée',
      explanation: 'Par temps de pluie (ou mauvaises conditions météo), la distance de freinage augmente significativement sur chaussée mouillée. La distance de sécurité recommandée est au minimum doublée.',
      difficulty: 'medium', exam_tag: 'distances' },
    { id: 'm05-ch1-qcm-9', lesson_id: ch1.id, type: 'qcm', ordre: 9,
      question: 'Quelle est la vitesse maximale en agglomération en France ?',
      choices: ['30 km/h', '50 km/h', '70 km/h', '80 km/h'],
      correct_answer: '50 km/h',
      explanation: 'La vitesse maximale autorisée en agglomération est de 50 km/h, sauf signalisation particulière (zones 30, zones de rencontre à 20 km/h).',
      difficulty: 'easy', exam_tag: 'vitesses' },
    { id: 'm05-ch1-qcm-10', lesson_id: ch1.id, type: 'qcm', ordre: 10,
      question: 'Quelle obligation s\'impose lorsqu\'un véhicule prioritaire (pompiers, SAMU) s\'approche avec gyrophare et sirène ?',
      choices: ['Accélérer pour ne pas gêner', 'Continuer sa route normalement', 'Dégager immédiatement la chaussée et s\'immobiliser', 'Klaxonner pour signaler sa présence'],
      correct_answer: 'Dégager immédiatement la chaussée et s\'immobiliser',
      explanation: 'Les véhicules prioritaires (pompiers, SAMU, police en intervention) imposent à tous les conducteurs de dégager la voie et de s\'immobiliser pour leur laisser le passage.',
      difficulty: 'medium', exam_tag: 'priorites' },
  ]);

  await upsertFlashcards([
    { id: 'm05-ch1-fc-1', lesson_id: ch1.id, ordre: 1,
      front: 'Vitesses maximales (3 voies)',
      back: 'Autoroute : 130 km/h (sec) / 110 km/h (pluie). Route nationale : 80 km/h. Agglomération : 50 km/h.' },
    { id: 'm05-ch1-fc-2', lesson_id: ch1.id, ordre: 2,
      front: 'Règle des 2 secondes',
      back: 'Laissez 2 secondes entre votre véhicule et celui devant. Par mauvais temps : doublez la distance.' },
    { id: 'm05-ch1-fc-3', lesson_id: ch1.id, ordre: 3,
      front: 'STOP vs Cédez le passage',
      back: 'STOP = arrêt complet obligatoire. Cédez le passage = s\'arrêter seulement si un véhicule prioritaire approche.' },
  ]);

  await upsertMedia({ id: 'm05-ch1-img-1', lesson_id: ch1.id, type: 'image',
    prompt: 'Tableau de panneaux de signalisation routière français les plus importants pour conducteurs professionnels. Fond blanc, panneaux en couleurs officielles.',
    alt_text: 'Panneaux de signalisation routière pour conducteurs professionnels T3P', status: 'draft' });

  // Ch2 — Éco-conduite et urgences
  const ch2 = await upsertLesson({
    id: 'm05-ch2-urgences', module_id: 'm05-securite',
    titre: 'Éco-conduite et gestion des urgences',
    objectif: 'Adopter une conduite économique et sécurisée, et réagir correctement aux situations d\'urgence.',
    duration_seconds: 480, interaction_type: 'quiz',
    media_prompt: 'Illustration pédagogique : conducteur professionnel T3P qui aide un passager en difficulté, avec en arrière-plan un véhicule immobilisé sur le bas-côté avec triangle de présignalisation. Style rassurant, couleurs douces.',
    content_blocks: [
      { type: 'heading', level: 1, text: 'Éco-conduite et gestion des urgences' },
      { type: 'paragraph', text: 'En tant que conducteur professionnel, vous devez maîtriser l\'**éco-conduite** pour réduire les coûts et l\'empreinte carbone, et savoir réagir face aux **situations d\'urgence**.' },
      { type: 'section', heading: '🌿 Éco-conduite', items: [
        'Anticipation : éviter les freinages et accélérations brusques → économise jusqu\'à **20 % de carburant**.',
        'Régime moteur optimal : passer les vitesses vers **2 000 tr/min** (essence) ou **1 500 tr/min** (diesel).',
        'Arrêt prolongé (> 1 min) : **couper le moteur** (ralenti consomme du carburant).',
        'Pression des pneus : vérification mensuelle — des pneus sous-gonflés augmentent la consommation de **0,6 %** par psi manquant.',
      ]},
      { type: 'section', heading: '🚨 Alcool et drogues', items: [
        'Taux légal d\'alcoolémie : **0,5 g/L** de sang (0,2 g/L pour les conducteurs < 2 ans de permis).',
        'Conduite sous l\'emprise de drogues : tolérance **zéro**, peu importe la substance.',
        'Sanctions : retrait de permis, amende jusqu\'à 4 500 €, emprisonnement en cas de récidive ou accident.',
      ]},
      { type: 'section', heading: '🆘 Accident et premiers secours', items: [
        '**PAS** : Protéger la zone (triangle, gilet), Alerter les secours (15 SAMU / 18 pompiers / 112), Secourir sans aggraver.',
        'Ne jamais déplacer un blessé sauf danger immédiat (incendie, noyade).',
        'Position latérale de sécurité (PLS) pour une personne inconsciente qui respire.',
        'Triangle de présignalisation : placer à **150 m minimum** en arrière sur autoroute, 30 m en ville.',
      ]},
      { type: 'callout', variant: 'warning', text: '⚠️ Prendre la fuite après un accident (délit de fuite) est un délit pénal passible de 3 ans d\'emprisonnement et 75 000 € d\'amende, en plus du retrait de permis.' },
      { type: 'voix_off', text: 'L\'éco-conduite, c\'est anticiper pour éviter les à-coups — on peut économiser jusqu\'à 20 % de carburant simplement en anticipant la circulation. Concernant l\'alcool, la limite légale est à 0,5 gramme par litre de sang, 0,2 pour les jeunes conducteurs. Pour les drogues, c\'est tolérance zéro. En cas d\'accident, rappelez-vous le PAS : Protéger, Alerter, Secourir. Le triangle de présignalisation doit être placé au moins à 30 mètres en ville, 150 mètres sur autoroute.' },
    ],
  });

  await upsertQCMs([
    { id: 'm05-ch2-qcm-1', lesson_id: ch2.id, type: 'qcm', ordre: 1,
      question: 'Quelle est la taux légal d\'alcoolémie autorisé pour un conducteur T3P expérimenté ?',
      choices: ['0,0 g/L', '0,2 g/L', '0,5 g/L', '0,8 g/L'],
      correct_answer: '0,5 g/L',
      explanation: 'Le taux légal d\'alcoolémie est de 0,5 g/L pour les conducteurs avec plus de 2 ans de permis. Il est abaissé à 0,2 g/L pour les conducteurs en période probatoire.',
      difficulty: 'easy', exam_tag: 'alcool' },
    { id: 'm05-ch2-qcm-2', lesson_id: ch2.id, type: 'qcm', ordre: 2,
      question: 'Que signifie l\'acronyme PAS en cas d\'accident ?',
      choices: ['Prévenir, Assister, Sauver', 'Protéger, Alerter, Secourir', 'Partir, Appeler, Signaler', 'Protéger, Analyser, Sécuriser'],
      correct_answer: 'Protéger, Alerter, Secourir',
      explanation: 'PAS est le protocole d\'urgence : Protéger la zone (triangle, gilet), Alerter les secours (15/18/112), Secourir les victimes sans aggraver leur état.',
      difficulty: 'easy', exam_tag: 'urgences' },
    { id: 'm05-ch2-qcm-3', lesson_id: ch2.id, type: 'qcm', ordre: 3,
      question: 'À quelle distance minimum placer le triangle de présignalisation sur autoroute ?',
      choices: ['30 mètres', '50 mètres', '100 mètres', '150 mètres'],
      correct_answer: '150 mètres',
      explanation: 'Sur autoroute (vitesse élevée), le triangle de présignalisation doit être placé à au moins 150 m en arrière du véhicule accidenté. En ville (50 km/h), 30 m suffisent.',
      difficulty: 'medium', exam_tag: 'urgences' },
    { id: 'm05-ch2-qcm-4', lesson_id: ch2.id, type: 'qcm', ordre: 4,
      question: 'Quelle action est interdite par le conducteur T3P lors d\'un accident avec blessé ?',
      choices: ['Appeler le 15 (SAMU)', 'Déplacer le blessé sauf danger immédiat', 'Placer le triangle de signalisation', 'Mettre le gilet de sécurité'],
      correct_answer: 'Déplacer le blessé sauf danger immédiat',
      explanation: 'Déplacer un blessé peut aggraver les blessures, notamment les traumatismes médullaires. On ne déplace un blessé que s\'il est en danger immédiat (incendie, noyade).',
      difficulty: 'medium', exam_tag: 'urgences' },
    { id: 'm05-ch2-qcm-5', lesson_id: ch2.id, type: 'qcm', ordre: 5,
      question: 'L\'éco-conduite peut réduire la consommation de carburant de quel ordre ?',
      choices: ['1 à 2 %', '5 à 10 %', '10 à 20 %', '30 à 40 %'],
      correct_answer: '10 à 20 %',
      explanation: 'Une conduite souple et anticipatrice (éco-conduite) permet généralement d\'économiser 10 à 20 % de carburant par rapport à une conduite sportive ou agressive.',
      difficulty: 'medium', exam_tag: 'eco_conduite' },
    { id: 'm05-ch2-qcm-6', lesson_id: ch2.id, type: 'qcm', ordre: 6,
      question: 'Quelle est la position à adopter pour une personne inconsciente qui respire ?',
      choices: ['La laisser sur le dos', 'La mettre en position assise', 'La mettre en Position Latérale de Sécurité (PLS)', 'La déplacer vers le bord de la route'],
      correct_answer: 'La mettre en Position Latérale de Sécurité (PLS)',
      explanation: 'La PLS (Position Latérale de Sécurité) est obligatoire pour une personne inconsciente qui respire : elle évite l\'asphyxie en cas de vomissements et maintient les voies respiratoires ouvertes.',
      difficulty: 'easy', exam_tag: 'urgences' },
    { id: 'm05-ch2-qcm-7', lesson_id: ch2.id, type: 'qcm', ordre: 7,
      question: 'Quel régime moteur est recommandé pour passer une vitesse en éco-conduite (véhicule essence) ?',
      choices: ['1 000 tr/min', '2 000 tr/min', '3 500 tr/min', '5 000 tr/min'],
      correct_answer: '2 000 tr/min',
      explanation: 'Pour un véhicule essence, le passage de vitesse optimal se situe vers 2 000 tr/min. Pour un diesel, vers 1 500 tr/min. Monter trop haut dans les tours consomme inutilement.',
      difficulty: 'medium', exam_tag: 'eco_conduite' },
    { id: 'm05-ch2-qcm-8', lesson_id: ch2.id, type: 'qcm', ordre: 8,
      question: 'Quelles sont les sanctions du délit de fuite après accident ?',
      choices: ['Simple amende de 135 €', 'Retrait de 6 points', 'Jusqu\'à 3 ans d\'emprisonnement et 75 000 € d\'amende', 'Suspension de permis de 1 mois'],
      correct_answer: 'Jusqu\'à 3 ans d\'emprisonnement et 75 000 € d\'amende',
      explanation: 'Le délit de fuite est un délit pénal grave : jusqu\'à 3 ans d\'emprisonnement, 75 000 € d\'amende, retrait du permis. Des circonstances aggravantes (blessé grave) alourdissent les peines.',
      difficulty: 'hard', exam_tag: 'sanctions' },
    { id: 'm05-ch2-qcm-9', lesson_id: ch2.id, type: 'qcm', ordre: 9,
      question: 'Un conducteur T3P positif aux drogues peut-il conduire sous certaines conditions ?',
      choices: ['Oui, si le taux est faible', 'Oui, si c\'est prescrit par un médecin', 'Non, tolérance zéro pour les drogues', 'Oui, si les drogues sont légales dans le pays d\'origine'],
      correct_answer: 'Non, tolérance zéro pour les drogues',
      explanation: 'La conduite sous l\'emprise de substances psychoactives (drogues illicites ou médicaments à effet psychotrope) est soumise à tolérance zéro. Tout résultat positif est sanctionné.',
      difficulty: 'easy', exam_tag: 'alcool' },
    { id: 'm05-ch2-qcm-10', lesson_id: ch2.id, type: 'qcm', ordre: 10,
      question: 'Quel impact les pneus sous-gonflés ont-ils sur la consommation de carburant ?',
      choices: ['Aucun impact', 'Réduction de la consommation', 'Augmentation de la consommation', 'Uniquement un impact sur l\'usure des pneus'],
      correct_answer: 'Augmentation de la consommation',
      explanation: 'Des pneus sous-gonflés augmentent la résistance au roulement, ce qui élève la consommation de carburant. On estime qu\'un déficit de pression de 0,5 bar augmente la consommation de 2 à 3 %.',
      difficulty: 'medium', exam_tag: 'eco_conduite' },
  ]);

  await upsertFlashcards([
    { id: 'm05-ch2-fc-1', lesson_id: ch2.id, ordre: 1,
      front: 'Protocole PAS (accident)',
      back: 'Protéger la zone (triangle + gilet). Alerter (15 SAMU / 18 pompiers / 112). Secourir sans déplacer le blessé (sauf danger immédiat).' },
    { id: 'm05-ch2-fc-2', lesson_id: ch2.id, ordre: 2,
      front: 'Taux d\'alcoolémie légaux',
      back: '0,5 g/L pour conducteurs expérimentés (> 2 ans). 0,2 g/L pour période probatoire. Zéro tolérance pour les drogues.' },
    { id: 'm05-ch2-fc-3', lesson_id: ch2.id, ordre: 3,
      front: 'Position Latérale de Sécurité (PLS)',
      back: 'Position pour une personne inconsciente qui respire : sur le côté, bouche vers le bas, pour éviter l\'asphyxie en cas de vomissements.' },
  ]);

  await upsertMedia({ id: 'm05-ch2-img-1', lesson_id: ch2.id, type: 'image',
    prompt: 'Illustration pédagogique : conducteur T3P avec gilet jaune posant un triangle de présignalisation derrière son véhicule. Style rassurant et professionnel.',
    alt_text: 'Mise en place du triangle de présignalisation après un accident T3P', status: 'draft' });
}

// ─── M07a ─────────────────────────────────────────────────────────────────────

async function seedM07a() {
  await upsertModule({
    id: 'm07a-francais', titre: 'M07a — Français écrit pour l\'examen',
    ordre: 7, filiere: 'commun',
    objectif: 'Développer les compétences en français écrit nécessaires à l\'épreuve D : compréhension de texte, vocabulaire professionnel et expression écrite.',
    duree_estimee: 60,
  });

  // Ch1 — Compréhension de texte
  const ch1 = await upsertLesson({
    id: 'm07a-ch1-comprehension', module_id: 'm07a-francais',
    titre: 'Compréhension de texte professionnel',
    objectif: 'Lire et comprendre un texte administratif ou professionnel lié à l\'activité T3P.',
    duration_seconds: 420, interaction_type: 'quiz',
    media_prompt: 'Illustration pédagogique : personne lisant attentivement un document officiel (décret ou arrêté) avec un stylo à la main, bureau professionnel. Style sobre, tons bleus et blancs.',
    content_blocks: [
      { type: 'heading', level: 1, text: 'Compréhension de texte professionnel' },
      { type: 'paragraph', text: 'L\'épreuve D de français évalue votre capacité à **lire et comprendre** des textes professionnels. On vous demande de répondre à des questions de compréhension, d\'identifier le sens de mots en contexte et de résumer l\'essentiel.' },
      { type: 'section', heading: '📖 Stratégies de lecture', items: [
        '**Lire le titre et les sous-titres** en premier pour comprendre le thème général.',
        '**Lire les questions** avant le texte : vous savez ce que vous cherchez.',
        '**Repérer les mots-clés** : chiffres, dates, noms propres, termes juridiques.',
        '**Attention aux négations** : "n\'est pas autorisé" change complètement le sens.',
      ]},
      { type: 'section', heading: '📝 Vocabulaire professionnel clé', items: [
        '**Arrêté** : décision administrative d\'une autorité (préfet, ministre).',
        '**Décret** : texte réglementaire signé par le Premier ministre ou le Président.',
        '**Circulaire** : instruction donnée par un ministère à ses services.',
        '**Habilitation** : autorisation officielle permettant d\'exercer une activité.',
        '**Exonération** : dispense de payer une taxe ou une obligation.',
      ]},
      { type: 'section', heading: '✍️ Résumé et synthèse', items: [
        'Un bon résumé garde l\'**idée principale** et les éléments essentiels, sans détails secondaires.',
        'Utilisez vos propres mots — recopiez le moins possible.',
        'Structure recommandée : Sujet + Verbe principal + complément essentiel.',
      ]},
      { type: 'voix_off', text: 'L\'épreuve de français vous demande de comprendre des textes professionnels, souvent des extraits de lois ou d\'arrêtés préfectoraux. La clé, c\'est de lire les questions avant le texte pour savoir ce que vous cherchez. Repérez les mots importants : les chiffres, les dates, les négations. Parmi les termes courants : un arrêté est une décision administrative du préfet ou du ministre, un décret vient du gouvernement, une habilitation est une autorisation officielle. Entraînez-vous à faire des résumés courts et précis.' },
    ],
  });

  await upsertQCMs([
    { id: 'm07a-ch1-qcm-1', lesson_id: ch1.id, type: 'qcm', ordre: 1,
      question: 'Qu\'est-ce qu\'un "arrêté préfectoral" ?',
      choices: ['Un jugement d\'un tribunal administratif', 'Une décision administrative prise par le préfet', 'Un texte de loi voté par le Parlement', 'Une circulaire ministérielle'],
      correct_answer: 'Une décision administrative prise par le préfet',
      explanation: 'Un arrêté préfectoral est une décision prise par le préfet du département, dans le cadre de ses attributions. Il peut porter sur des tarifs de taxi, des licences, des horaires, etc.',
      difficulty: 'easy', exam_tag: 'vocabulaire' },
    { id: 'm07a-ch1-qcm-2', lesson_id: ch1.id, type: 'qcm', ordre: 2,
      question: 'Dans un texte, le mot "habilitation" signifie :',
      choices: ['Une compétence acquise par l\'expérience', 'Une autorisation officielle d\'exercer une activité', 'Un diplôme de formation professionnelle', 'Un contrat de travail particulier'],
      correct_answer: 'Une autorisation officielle d\'exercer une activité',
      explanation: 'Une habilitation est une autorisation formelle accordée par une autorité compétente (État, préfecture) permettant d\'exercer une activité réglementée.',
      difficulty: 'easy', exam_tag: 'vocabulaire' },
    { id: 'm07a-ch1-qcm-3', lesson_id: ch1.id, type: 'qcm', ordre: 3,
      question: 'Quelle stratégie est recommandée avant de lire un texte de compréhension ?',
      choices: ['Lire le texte deux fois de suite rapidement', 'Lire d\'abord les questions, puis le texte', 'Commencer à répondre sans lire le texte', 'Chercher tous les mots inconnus dans le dictionnaire'],
      correct_answer: 'Lire d\'abord les questions, puis le texte',
      explanation: 'Lire les questions avant le texte permet de savoir ce que l\'on cherche et de repérer les informations utiles dès la première lecture, gagnant ainsi du temps.',
      difficulty: 'easy', exam_tag: 'methode' },
    { id: 'm07a-ch1-qcm-4', lesson_id: ch1.id, type: 'qcm', ordre: 4,
      question: 'La phrase "Le conducteur n\'est pas autorisé à maraude" signifie que le conducteur :',
      choices: ['Peut prendre des clients dans la rue', 'Ne peut pas prendre de clients sans réservation', 'Doit maraude à certaines heures', 'Peut maraude avec autorisation spéciale'],
      correct_answer: 'Ne peut pas prendre de clients sans réservation',
      explanation: 'La négation "n\'est pas autorisé" est une interdiction. Maraude = prise en charge sans réservation. Donc le conducteur ne peut pas prendre de clients spontanément dans la rue.',
      difficulty: 'medium', exam_tag: 'comprehension' },
    { id: 'm07a-ch1-qcm-5', lesson_id: ch1.id, type: 'qcm', ordre: 5,
      question: 'Qu\'est-ce qu\'une "exonération fiscale" ?',
      choices: ['Une obligation de payer des impôts supplémentaires', 'Une dispense de payer une taxe ou un impôt', 'Un formulaire de déclaration d\'impôts', 'Un contrôle fiscal effectué par l\'administration'],
      correct_answer: 'Une dispense de payer une taxe ou un impôt',
      explanation: 'Une exonération est une dispense légale de payer une taxe ou une obligation financière. Exemple : un conducteur peut être exonéré de TVA sous le seuil de franchise.',
      difficulty: 'medium', exam_tag: 'vocabulaire' },
  ]);

  await upsertFlashcards([
    { id: 'm07a-ch1-fc-1', lesson_id: ch1.id, ordre: 1,
      front: 'Arrêté (texte administratif)', back: 'Décision d\'une autorité administrative (préfet, ministre). Niveau inférieur au décret et à la loi.' },
    { id: 'm07a-ch1-fc-2', lesson_id: ch1.id, ordre: 2,
      front: 'Habilitation', back: 'Autorisation officielle accordée par une autorité compétente, permettant d\'exercer une activité réglementée.' },
    { id: 'm07a-ch1-fc-3', lesson_id: ch1.id, ordre: 3,
      front: 'Exonération', back: 'Dispense légale de payer une taxe ou de respecter une obligation. Ex : franchise de TVA pour les micro-entrepreneurs.' },
  ]);

  await upsertMedia({ id: 'm07a-ch1-img-1', lesson_id: ch1.id, type: 'image',
    prompt: 'Illustration sobre : personne lisant un document officiel avec des annotations en marge. Style épuré, tons bleus.',
    alt_text: 'Lecture et compréhension de texte administratif pour l\'épreuve D', status: 'draft' });

  // Ch2 — Expression écrite
  const ch2 = await upsertLesson({
    id: 'm07a-ch2-expression', module_id: 'm07a-francais',
    titre: 'Expression écrite et orthographe',
    objectif: 'Maîtriser les règles d\'orthographe, de grammaire et de conjugaison nécessaires à l\'épreuve D.',
    duration_seconds: 420, interaction_type: 'quiz',
    media_prompt: 'Illustration pédagogique : feuille de papier avec un texte manuscrit corrigé en rouge, stylo posé à côté. Style propre et professionnel, symbole du soin apporté à l\'écrit.',
    content_blocks: [
      { type: 'heading', level: 1, text: 'Expression écrite et orthographe' },
      { type: 'paragraph', text: 'La maîtrise de l\'orthographe et de la grammaire est évaluée dans l\'épreuve D. Voici les règles les plus fréquemment testées dans le contexte professionnel T3P.' },
      { type: 'section', heading: '✏️ Accords fréquents', items: [
        '**Accord sujet-verbe** : "Les conducteurs respectent les règles" (pluriel).',
        '**Accord du participe passé** avec "être" : "Elle est autorisée" (féminin).',
        '**Infinitif vs participe** : "Il faut respecter" (inf.) / "Il a respecté" (pp.).',
      ]},
      { type: 'section', heading: '🔤 Confusions courantes', items: [
        '**a / à** : "a" = verbe avoir (il a); "à" = préposition (à Paris).',
        '**ou / où** : "ou" = choix (taxi ou VTC); "où" = lieu (là où).',
        '**ce / se** : "ce" = démonstratif (ce conducteur); "se" = pronom réfléchi (il se lève).',
        '**ses / ces / s\'est** : "ses clients", "ces règles", "il s\'est arrêté".',
      ]},
      { type: 'section', heading: '📧 Écrire une phrase professionnelle', items: [
        'Commencer par une majuscule, finir par un point.',
        'Sujet + Verbe conjugué + Complément : "Le conducteur remet la facture au client."',
        'Éviter les abréviations dans un texte formel (sauf OK pour "M." "Mme" "etc.").',
      ]},
      { type: 'voix_off', text: 'L\'orthographe est notée dans l\'épreuve D. Les pièges les plus fréquents : a sans accent versus à avec accent — a est le verbe avoir, à est une préposition. Ou sans accent pour le choix, où avec accent pour le lieu. Pour les accords : un verbe s\'accorde toujours avec son sujet. Le participe passé avec être s\'accorde avec le sujet. En cas de doute, relisez votre phrase à voix basse pour détecter les incohérences.' },
    ],
  });

  await upsertQCMs([
    { id: 'm07a-ch2-qcm-1', lesson_id: ch2.id, type: 'qcm', ordre: 1,
      question: 'Choisissez la bonne orthographe : "Le conducteur ____ respecté le code de la route."',
      choices: ['a', 'à', 'as', 'ah'],
      correct_answer: 'a',
      explanation: '"a" est le verbe avoir conjugué à la 3e personne du singulier (il a). "à" est une préposition de lieu ou de direction. "Le conducteur a respecté" = passé composé.',
      difficulty: 'easy', exam_tag: 'orthographe' },
    { id: 'm07a-ch2-qcm-2', lesson_id: ch2.id, type: 'qcm', ordre: 2,
      question: 'Laquelle de ces phrases est correcte ?',
      choices: [
        'Les conducteurs respecte les règles.',
        'Les conducteurs respectent les règles.',
        'Les conducteurs respectes les règles.',
        'Les conducteur respectent les règles.',
      ],
      correct_answer: 'Les conducteurs respectent les règles.',
      explanation: 'Le sujet "Les conducteurs" est pluriel, donc le verbe prend la terminaison "-ent". "Respecte" est singulier, "respectes" n\'existe pas, et "conducteur" doit être au pluriel.',
      difficulty: 'easy', exam_tag: 'grammaire' },
    { id: 'm07a-ch2-qcm-3', lesson_id: ch2.id, type: 'qcm', ordre: 3,
      question: 'Complétez : "La passagère ____ montée dans le véhicule."',
      choices: ['est', 'a', 'es', 'était'],
      correct_answer: 'est',
      explanation: 'Le verbe "monter" se conjugue avec l\'auxiliaire "être" au passé composé. Avec "être", le participe passé s\'accorde avec le sujet : "la passagère est montée" (féminin singulier → -e).',
      difficulty: 'medium', exam_tag: 'grammaire' },
    { id: 'm07a-ch2-qcm-4', lesson_id: ch2.id, type: 'qcm', ordre: 4,
      question: 'Quelle phrase utilise correctement "ou" et "où" ?',
      choices: [
        'Taxi ou VTC, choisissez ou vous voulez aller.',
        'Taxi ou VTC, choisissez où vous voulez aller.',
        'Taxi où VTC, choisissez où vous voulez aller.',
        'Taxi où VTC, choisissez ou vous voulez aller.',
      ],
      correct_answer: 'Taxi ou VTC, choisissez où vous voulez aller.',
      explanation: '"ou" (sans accent) = alternative/choix. "où" (avec accent) = lieu ou question sur un lieu. "Taxi ou VTC" = choix entre deux options. "où vous voulez aller" = lieu de destination.',
      difficulty: 'medium', exam_tag: 'orthographe' },
    { id: 'm07a-ch2-qcm-5', lesson_id: ch2.id, type: 'qcm', ordre: 5,
      question: 'Quelle est la structure correcte d\'une phrase professionnelle ?',
      choices: [
        'Respecter le conducteur le code de la route.',
        'Le conducteur respecte le code de la route.',
        'Code de la route, le conducteur respecte.',
        'Le respecter conducteur le code.',
      ],
      correct_answer: 'Le conducteur respecte le code de la route.',
      explanation: 'Une phrase correcte suit la structure Sujet + Verbe + Complément. "Le conducteur" (sujet) + "respecte" (verbe au présent) + "le code de la route" (COD).',
      difficulty: 'easy', exam_tag: 'grammaire' },
  ]);

  await upsertFlashcards([
    { id: 'm07a-ch2-fc-1', lesson_id: ch2.id, ordre: 1,
      front: 'a / à (distinction)',
      back: '"a" = verbe avoir (il a, elle a). "à" = préposition (à Paris, à 9h). Test : peut-on remplacer par "avait" ? Si oui → "a" sans accent.' },
    { id: 'm07a-ch2-fc-2', lesson_id: ch2.id, ordre: 2,
      front: 'ou / où (distinction)',
      back: '"ou" (sans accent) = alternative (taxi ou VTC). "où" (accent grave) = lieu ou question ("où allez-vous ?").' },
    { id: 'm07a-ch2-fc-3', lesson_id: ch2.id, ordre: 3,
      front: 'Accord sujet-verbe',
      back: 'Le verbe s\'accorde toujours en nombre avec son sujet. Singulier → -e ou -t. Pluriel → -ent (3e pers.).' },
  ]);

  await upsertMedia({ id: 'm07a-ch2-img-1', lesson_id: ch2.id, type: 'image',
    prompt: 'Feuille de texte avec corrections orthographiques en rouge, stylo posé à côté. Style épuré, professionnel.',
    alt_text: 'Exercice d\'expression écrite et corrections orthographiques', status: 'draft' });
}

// ─── M07b ─────────────────────────────────────────────────────────────────────

async function seedM07b() {
  await upsertModule({
    id: 'm07b-anglais', titre: 'M07b — Anglais A2 pour l\'examen',
    ordre: 8, filiere: 'commun',
    objectif: 'Acquérir le vocabulaire et les expressions en anglais niveau A2 nécessaires à l\'épreuve E : accueil du client, directions, situations courantes.',
    duree_estimee: 60,
  });

  // Ch1 — Welcome & Directions
  const ch1 = await upsertLesson({
    id: 'm07b-ch1-welcome', module_id: 'm07b-anglais',
    titre: 'Welcome & Directions',
    objectif: 'Savoir accueillir un client anglophone, comprendre sa destination et donner des informations de base.',
    duration_seconds: 420, interaction_type: 'quiz',
    media_prompt: 'Illustration pédagogique : conducteur T3P souriant qui accueille un passager anglophone dans son véhicule, dialogue en bulles bilingue français/anglais. Style moderne, tons chauds.',
    content_blocks: [
      { type: 'heading', level: 1, text: 'Welcome & Directions' },
      { type: 'paragraph', text: 'L\'épreuve E d\'anglais évalue votre niveau A2. Vous devez être capable d\'**accueillir un client**, de comprendre sa **destination** et de communiquer sur des situations simples de la vie professionnelle.' },
      { type: 'section', heading: '👋 Accueil du client (Greetings)', items: [
        '"Good morning / Good afternoon / Good evening" — Bonjour / Bonsoir.',
        '"Where would you like to go?" — Où souhaitez-vous aller ?',
        '"Please fasten your seatbelt." — Veuillez attacher votre ceinture.',
        '"The journey will take about 20 minutes." — Le trajet durera environ 20 minutes.',
      ]},
      { type: 'section', heading: '🗺️ Directions (Directions)', items: [
        '"Turn left / Turn right" — Tournez à gauche / à droite.',
        '"Go straight ahead" — Continuez tout droit.',
        '"Take the motorway / highway" — Prenez l\'autoroute.',
        '"Stop here, please" — Arrêtez-vous ici, s\'il vous plaît.',
      ]},
      { type: 'section', heading: '💷 Prix et paiement (Price & Payment)', items: [
        '"The fare is 15 euros." — La course est de 15 euros.',
        '"Do you accept card payment?" — Acceptez-vous le paiement par carte ?',
        '"Here is your receipt." — Voici votre reçu.',
        '"Keep the change." — Gardez la monnaie.',
      ]},
      { type: 'callout', variant: 'info', text: '💡 Pour l\'épreuve, vous n\'avez pas besoin de parler parfaitement anglais. L\'objectif est de comprendre et de répondre de façon simple mais efficace à un client anglophone.' },
      { type: 'voix_off', text: 'L\'épreuve d\'anglais porte sur le niveau A2 — pas besoin d\'être bilingue. Les examens testent votre capacité à accueillir un client, à comprendre une destination, à expliquer un tarif ou à gérer une situation simple. Les expressions clés : Where would you like to go ? Please fasten your seatbelt. The fare is X euros. Turn left, turn right, go straight ahead. Entraînez-vous sur ces phrases jusqu\'à les avoir automatisées.' },
    ],
  });

  await upsertQCMs([
    { id: 'm07b-ch1-qcm-1', lesson_id: ch1.id, type: 'qcm', ordre: 1,
      question: 'How do you ask a passenger where they want to go in English?',
      choices: [
        '"Where are you from?"',
        '"Where would you like to go?"',
        '"How long will the journey take?"',
        '"Do you have a reservation?"',
      ],
      correct_answer: '"Where would you like to go?"',
      explanation: '"Where would you like to go?" is the standard professional phrase to ask a passenger\'s destination. "Where are you from?" asks origin, not destination.',
      difficulty: 'easy', exam_tag: 'anglais_accueil' },
    { id: 'm07b-ch1-qcm-2', lesson_id: ch1.id, type: 'qcm', ordre: 2,
      question: 'Comment dit-on "Veuillez attacher votre ceinture" en anglais ?',
      choices: [
        '"Please open the window."',
        '"Please fasten your seatbelt."',
        '"Please check your luggage."',
        '"Please close the door."',
      ],
      correct_answer: '"Please fasten your seatbelt."',
      explanation: '"Please fasten your seatbelt" = Veuillez attacher votre ceinture. "Fasten" = attacher, "seatbelt" = ceinture de sécurité. Cette phrase est obligatoire au démarrage.',
      difficulty: 'easy', exam_tag: 'anglais_accueil' },
    { id: 'm07b-ch1-qcm-3', lesson_id: ch1.id, type: 'qcm', ordre: 3,
      question: 'What does "Turn right" mean in French?',
      choices: ['Continuez tout droit', 'Tournez à gauche', 'Tournez à droite', 'Faites demi-tour'],
      correct_answer: 'Tournez à droite',
      explanation: '"Turn right" = tournez à droite. "Turn left" = tournez à gauche. "Go straight ahead" = continuez tout droit. "Make a U-turn" = faites demi-tour.',
      difficulty: 'easy', exam_tag: 'anglais_directions' },
    { id: 'm07b-ch1-qcm-4', lesson_id: ch1.id, type: 'qcm', ordre: 4,
      question: 'Comment dit-on "La course est de 18 euros" en anglais ?',
      choices: [
        '"The journey costs 18 kilometres."',
        '"The fare is 18 euros."',
        '"The price was 18 minutes."',
        '"18 euros is too much."',
      ],
      correct_answer: '"The fare is 18 euros."',
      explanation: '"Fare" désigne spécifiquement le prix d\'un trajet en transport. "The fare is X euros" est l\'expression standard pour annoncer le prix d\'une course à un client.',
      difficulty: 'easy', exam_tag: 'anglais_paiement' },
    { id: 'm07b-ch1-qcm-5', lesson_id: ch1.id, type: 'qcm', ordre: 5,
      question: 'A passenger says "Go straight ahead." What should you do?',
      choices: ['Tourner à gauche', 'S\'arrêter', 'Continuer tout droit', 'Faire demi-tour'],
      correct_answer: 'Continuer tout droit',
      explanation: '"Go straight ahead" = continuez tout droit / allez tout droit. C\'est une instruction de direction indiquant de ne pas tourner.',
      difficulty: 'easy', exam_tag: 'anglais_directions' },
    { id: 'm07b-ch1-qcm-6', lesson_id: ch1.id, type: 'qcm', ordre: 6,
      question: 'Comment accueillir un client en fin d\'après-midi en anglais ?',
      choices: ['"Good morning"', '"Good afternoon"', '"Good night"', '"Hello evening"'],
      correct_answer: '"Good afternoon"',
      explanation: '"Good morning" = le matin. "Good afternoon" = l\'après-midi (de 12h à 18h environ). "Good evening" = le soir. "Good night" = pour dire bonne nuit (départ/coucher).',
      difficulty: 'easy', exam_tag: 'anglais_accueil' },
    { id: 'm07b-ch1-qcm-7', lesson_id: ch1.id, type: 'qcm', ordre: 7,
      question: 'Que signifie "Here is your receipt" ?',
      choices: ['Voici votre reçu', 'Voici votre ticket de métro', 'Voici votre passeport', 'Voici votre carte de crédit'],
      correct_answer: 'Voici votre reçu',
      explanation: '"Receipt" = reçu, justificatif de paiement. "Here is your receipt" = Voici votre reçu. Cette phrase est importante pour les clients professionnels qui ont besoin d\'un justificatif.',
      difficulty: 'easy', exam_tag: 'anglais_paiement' },
    { id: 'm07b-ch1-qcm-8', lesson_id: ch1.id, type: 'qcm', ordre: 8,
      question: 'How do you say "Prenez l\'autoroute" in English?',
      choices: ['"Take the motorway."', '"Take the subway."', '"Use the roundabout."', '"Go to the airport."'],
      correct_answer: '"Take the motorway."',
      explanation: '"Motorway" (UK English) = autoroute. "Highway" (US English) = autoroute. "Subway" = métro. "Roundabout" = rond-point.',
      difficulty: 'medium', exam_tag: 'anglais_directions' },
    { id: 'm07b-ch1-qcm-9', lesson_id: ch1.id, type: 'qcm', ordre: 9,
      question: 'What does "Keep the change" mean?',
      choices: ['Changez d\'itinéraire', 'Gardez la monnaie', 'Attendez ici', 'Passez au péage'],
      correct_answer: 'Gardez la monnaie',
      explanation: '"Keep the change" = gardez la monnaie. Un pourboire courant en anglais. "Change" dans ce contexte = la monnaie rendue, pas le fait de changer quelque chose.',
      difficulty: 'medium', exam_tag: 'anglais_paiement' },
    { id: 'm07b-ch1-qcm-10', lesson_id: ch1.id, type: 'qcm', ordre: 10,
      question: 'How do you say "Le trajet durera environ 15 minutes" in English?',
      choices: [
        '"The journey is 15 kilometres."',
        '"The journey will take about 15 minutes."',
        '"We arrive in 15 seconds."',
        '"The traffic is 15 minutes."',
      ],
      correct_answer: '"The journey will take about 15 minutes."',
      explanation: '"The journey will take about X minutes" est l\'expression standard pour estimer la durée d\'un trajet. "About" = environ. "Will take" = durera (futur).',
      difficulty: 'medium', exam_tag: 'anglais_accueil' },
  ]);

  await upsertFlashcards([
    { id: 'm07b-ch1-fc-1', lesson_id: ch1.id, ordre: 1,
      front: 'Where would you like to go?', back: 'Où souhaitez-vous aller ? (Question standard pour demander la destination d\'un passager)' },
    { id: 'm07b-ch1-fc-2', lesson_id: ch1.id, ordre: 2,
      front: 'The fare is X euros.', back: 'La course est de X euros. (Fare = prix d\'un trajet en transport)' },
    { id: 'm07b-ch1-fc-3', lesson_id: ch1.id, ordre: 3,
      front: 'Turn left / Turn right / Go straight ahead', back: 'Tournez à gauche / Tournez à droite / Continuez tout droit' },
  ]);

  await upsertMedia({ id: 'm07b-ch1-img-1', lesson_id: ch1.id, type: 'image',
    prompt: 'Conducteur T3P souriant accueillant un passager anglophone, dialogue en bulles bilingue. Style moderne et professionnel.',
    alt_text: 'Accueil d\'un client anglophone dans un véhicule T3P', status: 'draft' });

  // Ch2 — Conversations & Situations
  const ch2 = await upsertLesson({
    id: 'm07b-ch2-situations', module_id: 'm07b-anglais',
    titre: 'Conversations & Situations courantes',
    objectif: 'Gérer des situations courantes en anglais : réclamations, indications, urgences et petite conversation professionnelle.',
    duration_seconds: 420, interaction_type: 'quiz',
    media_prompt: 'Illustration pédagogique : deux conducteurs T3P dans une formation, avec des bulles de dialogue en anglais et en français. Style dynamique, ambiance formation professionnelle.',
    content_blocks: [
      { type: 'heading', level: 1, text: 'Conversations & Situations courantes' },
      { type: 'paragraph', text: 'Au-delà des formules de base, vous serez confronté à des **situations plus complexes** : réclamations, pannes, informations touristiques, gestion des bagages.' },
      { type: 'section', heading: '😟 Réclamations (Complaints)', items: [
        '"I\'m sorry for the delay." — Je suis désolé pour le retard.',
        '"There is a lot of traffic today." — Il y a beaucoup de circulation aujourd\'hui.',
        '"I will find an alternative route." — Je vais trouver un itinéraire alternatif.',
        '"I apologise for the inconvenience." — Je vous présente mes excuses pour le désagrément.',
      ]},
      { type: 'section', heading: '🚗 Situations de conduite', items: [
        '"I need to stop for petrol." — Je dois m\'arrêter pour faire le plein.',
        '"There is a roadblock ahead." — Il y a un barrage routier devant.',
        '"We are almost there." — Nous approchons.',
        '"Could you confirm the address?" — Pourriez-vous confirmer l\'adresse ?',
      ]},
      { type: 'section', heading: '📱 Numéros d\'urgence en anglais', items: [
        '"Call 112, it\'s the emergency number." — Appelez le 112, c\'est le numéro d\'urgence.',
        '"Police: 17, Fire: 18, Medical: 15." — Police : 17, Pompiers : 18, SAMU : 15.',
        '"Are you injured?" — Êtes-vous blessé ?',
        '"Help is on the way." — Les secours arrivent.',
      ]},
      { type: 'voix_off', text: 'Les situations courantes en anglais : gérer un retard, c\'est "I\'m sorry for the delay, there is a lot of traffic." Pour une réclamation, "I apologise for the inconvenience." Côté urgences, rappelez-vous les numéros : 112 pour toute urgence, 15 pour le SAMU, 18 pour les pompiers, 17 pour la police. "Are you injured?" signifie êtes-vous blessé. Entraînez-vous à ces phrases de façon régulière pour les automatiser.' },
    ],
  });

  await upsertQCMs([
    { id: 'm07b-ch2-qcm-1', lesson_id: ch2.id, type: 'qcm', ordre: 1,
      question: 'How do you apologise for a delay in English?',
      choices: [
        '"I don\'t care about the delay."',
        '"I\'m sorry for the delay."',
        '"The delay is your fault."',
        '"There is no delay."',
      ],
      correct_answer: '"I\'m sorry for the delay."',
      explanation: '"I\'m sorry for the delay" est l\'expression standard pour s\'excuser d\'un retard. "I\'m sorry" = je suis désolé, "for the delay" = pour le retard.',
      difficulty: 'easy', exam_tag: 'anglais_situations' },
    { id: 'm07b-ch2-qcm-2', lesson_id: ch2.id, type: 'qcm', ordre: 2,
      question: 'Que signifie "There is a lot of traffic today" ?',
      choices: ['Il y a beaucoup de taxis aujourd\'hui', 'Il y a beaucoup de circulation aujourd\'hui', 'Il y a un accident aujourd\'hui', 'Le trajet est gratuit aujourd\'hui'],
      correct_answer: 'Il y a beaucoup de circulation aujourd\'hui',
      explanation: '"Traffic" = la circulation, le trafic routier. "There is a lot of traffic" = il y a beaucoup de circulation / embouteillages. C\'est une phrase utile pour expliquer un retard.',
      difficulty: 'easy', exam_tag: 'anglais_situations' },
    { id: 'm07b-ch2-qcm-3', lesson_id: ch2.id, type: 'qcm', ordre: 3,
      question: 'What is the emergency number to give to an English-speaking passenger?',
      choices: ['999', '112', '911', '08'],
      correct_answer: '112',
      explanation: '112 est le numéro d\'urgence européen, utilisable dans toute l\'UE. C\'est le numéro à communiquer à tout passager en cas d\'urgence. En France : 15 (SAMU), 17 (police), 18 (pompiers), 112 (universel).',
      difficulty: 'easy', exam_tag: 'anglais_urgences' },
    { id: 'm07b-ch2-qcm-4', lesson_id: ch2.id, type: 'qcm', ordre: 4,
      question: 'Comment dit-on "Pourriez-vous confirmer l\'adresse ?" en anglais ?',
      choices: [
        '"Could you confirm the address?"',
        '"Can you find the address?"',
        '"Do you have an address?"',
        '"The address is wrong."',
      ],
      correct_answer: '"Could you confirm the address?"',
      explanation: '"Could you confirm the address?" est la formule polie pour demander la confirmation de l\'adresse. "Could you" = pourriez-vous (plus poli que "can you").',
      difficulty: 'medium', exam_tag: 'anglais_situations' },
    { id: 'm07b-ch2-qcm-5', lesson_id: ch2.id, type: 'qcm', ordre: 5,
      question: 'Que signifie "We are almost there" ?',
      choices: ['Nous sommes perdus', 'Nous approchons de la destination', 'Nous faisons un détour', 'Nous repartons'],
      correct_answer: 'Nous approchons de la destination',
      explanation: '"Almost" = presque. "We are almost there" = Nous y sommes presque / Nous approchons. Phrase utile pour rassurer un passager impatient.',
      difficulty: 'easy', exam_tag: 'anglais_situations' },
    { id: 'm07b-ch2-qcm-6', lesson_id: ch2.id, type: 'qcm', ordre: 6,
      question: 'How do you say "Je vais trouver un itinéraire alternatif" in English?',
      choices: [
        '"I will find an alternative route."',
        '"I will find another taxi."',
        '"I will stop here."',
        '"I will call the police."',
      ],
      correct_answer: '"I will find an alternative route."',
      explanation: '"Alternative route" = itinéraire alternatif / autre chemin. "I will find" = je vais trouver (futur simple). Utile quand il y a des embouteillages ou un barrage.',
      difficulty: 'medium', exam_tag: 'anglais_situations' },
    { id: 'm07b-ch2-qcm-7', lesson_id: ch2.id, type: 'qcm', ordre: 7,
      question: 'What does "Are you injured?" mean?',
      choices: ['Êtes-vous en retard ?', 'Êtes-vous blessé ?', 'Êtes-vous fatigué ?', 'Êtes-vous perdu ?'],
      correct_answer: 'Êtes-vous blessé ?',
      explanation: '"Injured" = blessé. "Are you injured?" = Êtes-vous blessé ? Cette question est essentielle en cas d\'accident pour évaluer l\'état des passagers.',
      difficulty: 'easy', exam_tag: 'anglais_urgences' },
    { id: 'm07b-ch2-qcm-8', lesson_id: ch2.id, type: 'qcm', ordre: 8,
      question: 'Que signifie "I need to stop for petrol" ?',
      choices: ['Je dois m\'arrêter pour le client', 'Je dois m\'arrêter pour faire le plein', 'Je dois m\'arrêter à la police', 'Je dois m\'arrêter pour un café'],
      correct_answer: 'Je dois m\'arrêter pour faire le plein',
      explanation: '"Petrol" (UK) = carburant / essence. "Stop for petrol" = s\'arrêter pour faire le plein. Aux États-Unis on dit "gas" au lieu de "petrol".',
      difficulty: 'medium', exam_tag: 'anglais_situations' },
    { id: 'm07b-ch2-qcm-9', lesson_id: ch2.id, type: 'qcm', ordre: 9,
      question: 'How do you say "Les secours arrivent" in English?',
      choices: ['"The police are late."', '"Help is on the way."', '"The ambulance left."', '"Call for help."'],
      correct_answer: '"Help is on the way."',
      explanation: '"Help is on the way" = Les secours arrivent / L\'aide est en route. Cette phrase rassure une victime en attendant les secours. "On the way" = en chemin, en route.',
      difficulty: 'medium', exam_tag: 'anglais_urgences' },
    { id: 'm07b-ch2-qcm-10', lesson_id: ch2.id, type: 'qcm', ordre: 10,
      question: 'What does "I apologise for the inconvenience" mean?',
      choices: [
        'Je ne peux pas vous aider',
        'Je vous présente mes excuses pour le désagrément',
        'L\'inconvénient est de votre faute',
        'Voici votre reçu',
      ],
      correct_answer: 'Je vous présente mes excuses pour le désagrément',
      explanation: '"I apologise" = je m\'excuse / je présente mes excuses (plus formel que "I\'m sorry"). "Inconvenience" = désagrément, gêne. Formule très professionnelle pour les réclamations.',
      difficulty: 'medium', exam_tag: 'anglais_situations' },
  ]);

  await upsertFlashcards([
    { id: 'm07b-ch2-fc-1', lesson_id: ch2.id, ordre: 1,
      front: 'I\'m sorry for the delay.', back: 'Je suis désolé pour le retard. (Formule d\'excuse pour un retard de trajet)' },
    { id: 'm07b-ch2-fc-2', lesson_id: ch2.id, ordre: 2,
      front: 'Emergency numbers (English)', back: '112 = European emergency. 15 = SAMU (medical). 17 = Police. 18 = Fire (pompiers).' },
    { id: 'm07b-ch2-fc-3', lesson_id: ch2.id, ordre: 3,
      front: 'We are almost there.', back: 'Nous approchons / Nous y sommes presque. (Pour rassurer un passager impatient)' },
  ]);

  await upsertMedia({ id: 'm07b-ch2-img-1', lesson_id: ch2.id, type: 'image',
    prompt: 'Conducteurs T3P en formation avec des bulles de dialogue bilingues anglais-français. Style dynamique, ambiance professionnelle.',
    alt_text: 'Formation anglais professionnel pour conducteurs T3P', status: 'draft' });
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeder LMS Lot 1 — Tronc commun M01→M07b\n');

  console.log('📦 M01 — Ch2 (carte professionnelle, 7 QCM)');
  await seedM01Ch2();

  console.log('\n📦 M03 — Gestion (2 chapitres, 16 QCM)');
  await seedM03();

  console.log('\n📦 M05 — Sécurité routière (2 chapitres, 20 QCM)');
  await seedM05();

  console.log('\n📦 M07a — Français (2 chapitres, 10 QCM)');
  await seedM07a();

  console.log('\n📦 M07b — Anglais (2 chapitres, 20 QCM)');
  await seedM07b();

  console.log('\n🎉 Seed Lot 1 terminé avec succès.');
  console.log('   M01: 2 chapitres (3 + 7 = 10 QCM épreuve A)');
  console.log('   M03: 2 chapitres (8 + 8 = 16 QCM épreuve B)');
  console.log('   M05: 2 chapitres (10 + 10 = 20 QCM épreuve C)');
  console.log('   M07a: 2 chapitres (5 + 5 = 10 QCM épreuve D)');
  console.log('   M07b: 2 chapitres (10 + 10 = 20 QCM épreuve E)');
}

main()
  .catch((e) => { console.error('❌ Erreur seed Lot 1 :', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
