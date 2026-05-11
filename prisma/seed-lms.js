'use strict';

/**
 * Seeder LMS — M01 Chapitre 1 : Les trois métiers du T3P
 * Crée : 1 module, 1 leçon, 3 QCM, 3 flashcards, 1 media asset
 *
 * Usage : node prisma/seed-lms.js
 */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding LMS — M01/Ch1…');

  // ── Module M01 ─────────────────────────────────────────────────────────────
  const module = await prisma.module.upsert({
    where: { id: 'm01-t3p-intro' },
    update: {},
    create: {
      id:            'm01-t3p-intro',
      titre:         'M01 — Introduction aux métiers du T3P',
      ordre:         1,
      filiere:       'commun',
      objectif:      'Comprendre les distinctions réglementaires entre les trois métiers du transport de personnes à titre onéreux (T3P) : Taxi, VTC et VMDTR.',
      duree_estimee: 45,
    },
  });
  console.log(`  ✅ Module : ${module.titre}`);

  // ── Leçon Ch1 ──────────────────────────────────────────────────────────────
  const lesson = await prisma.lesson.upsert({
    where: { id: 'm01-ch1-trois-metiers' },
    update: {},
    create: {
      id:               'm01-ch1-trois-metiers',
      module_id:        module.id,
      titre:            'Les trois métiers du T3P',
      objectif:         'Distinguer Taxi, VTC et VMDTR selon leurs droits de prise en charge, leur mode de tarification et leurs obligations de réservation.',
      duration_seconds: 360,
      interaction_type: 'quiz',
      media_prompt:     'Illustration pédagogique : trois véhicules côte à côte sur une route urbaine. À gauche, un taxi avec une enseigne lumineuse jaune et un compteur horokilométrique visible, une flèche indique "Maraude autorisée". Au centre, une berline VTC sombre avec une étiquette "Réservation préalable obligatoire" et "Prix libre". À droite, un véhicule VMDTR (Mercedes ou Renault grand espace) avec "9 places max" et "Groupe uniquement". Style réaliste, palette sobre bleu nuit et blanc, annotations claires en français.',
      content_blocks: [
        {
          type:  'heading',
          level: 1,
          text:  'Les trois métiers du T3P',
        },
        {
          type: 'paragraph',
          text: 'En France, le transport de personnes à titre onéreux (T3P) regroupe trois catégories bien distinctes, chacune avec ses propres règles : le Taxi, le VTC et le VMDTR. Connaître ces distinctions est fondamental avant de passer l\'examen.',
        },
        {
          type:    'section',
          heading: '🚕 Le Taxi',
          items: [
            'Seul métier autorisé à prendre en charge un client sur la voie publique sans réservation préalable : c\'est la **maraude**.',
            'Le tarif est **réglementé** par arrêté préfectoral et affiché via un **compteur horokilométrique** homologué.',
            'Le taxi est rattaché à une commune ou une zone géographique déterminée.',
          ],
        },
        {
          type:    'section',
          heading: '🚗 Le VTC (Véhicule de Tourisme avec Chauffeur)',
          items: [
            'La **réservation préalable est obligatoire** — il est interdit de prendre en charge un client sans commande (ni maraude, ni station).',
            'Le prix est **librement fixé** par le prestataire (négocié avant la course).',
            'Le VTC ne peut pas utiliser de compteur horokilométrique.',
          ],
        },
        {
          type:    'section',
          heading: '🚐 Le VMDTR (Véhicule Motorisé à Deux ou Trois Roues / Véhicule avec 4 à 9 places)',
          items: [
            'Transporte des **groupes constitués** dans un véhicule de 4 à 9 places (conducteur compris).',
            'Comme le VTC : **réservation préalable obligatoire**, **tarification libre**, **pas de compteur horokilométrique**.',
            'Les conducteurs VMDTR ne peuvent transporter qu\'un groupe ayant réservé ensemble — pas de clients individuels séparés.',
          ],
        },
        {
          type:    'callout',
          variant: 'info',
          text:    '💡 Le point clé à retenir : seul le Taxi peut maraude. VTC et VMDTR travaillent exclusivement sur réservation préalable.',
        },
        {
          type: 'voix_off',
          text: 'Dans cette leçon, vous allez apprendre à distinguer les trois grands métiers du transport de personnes : le Taxi, le VTC, et le VMDTR. Ces trois métiers partagent un point commun : ils transportent des personnes contre rémunération. Mais leurs règles sont très différentes. Le Taxi est le seul à pouvoir prendre en charge un client spontanément sur la voie publique : c\'est ce qu\'on appelle la maraude. Son tarif est réglementé et affiché par un compteur homologué. Le VTC et le VMDTR, eux, travaillent exclusivement sur réservation préalable. Impossible de s\'arrêter pour prendre un client dans la rue. En contrepartie, ils fixent librement leurs prix, négociés avec le client avant la course. Le VMDTR se distingue du VTC par le type de véhicule : il transporte des groupes dans des véhicules pouvant accueillir jusqu\'à 9 personnes. Retenez bien ces distinctions : elles sont au cœur des questions d\'examen.',
        },
      ],
    },
  });
  console.log(`  ✅ Leçon : ${lesson.titre}`);

  // ── 3 QCM ──────────────────────────────────────────────────────────────────
  const qcmData = [
    {
      id:             'm01-ch1-qcm-1',
      lesson_id:      lesson.id,
      type:           'qcm',
      question:       'Quel métier peut prendre en charge un client sur la voie publique sans réservation préalable ?',
      choices:        ['Taxi', 'VTC', 'VMDTR', 'Tous les trois'],
      correct_answer: 'Taxi',
      explanation:    'Seul le Taxi est autorisé à maraude, c\'est-à-dire à circuler sur la voie publique et s\'arrêter pour prendre des clients sans commande préalable. Le VTC et le VMDTR ne peuvent travailler que sur réservation.',
      difficulty:     'easy',
      exam_tag:       'maraude',
      ordre:          1,
    },
    {
      id:             'm01-ch1-qcm-2',
      lesson_id:      lesson.id,
      type:           'qcm',
      question:       'Le VMDTR peut-il utiliser un compteur horokilométrique ?',
      choices:        ['Oui, comme le taxi', 'Non, c\'est réservé aux taxis', 'Oui, si le client l\'accepte', 'Seulement pour les trajets longue distance'],
      correct_answer: 'Non, c\'est réservé aux taxis',
      explanation:    'Le compteur horokilométrique homologué est une obligation exclusive du Taxi. Le VTC et le VMDTR pratiquent une tarification libre, négociée avant la course — ils ne peuvent pas installer ni utiliser un compteur.',
      difficulty:     'medium',
      exam_tag:       'compteur',
      ordre:          2,
    },
    {
      id:             'm01-ch1-qcm-3',
      lesson_id:      lesson.id,
      type:           'qcm',
      question:       'Qui fixe librement le prix de sa course ?',
      choices:        ['Le Taxi uniquement', 'Le VTC uniquement', 'Le VTC et le VMDTR', 'Les trois métiers'],
      correct_answer: 'Le VTC et le VMDTR',
      explanation:    'Le Taxi a un tarif réglementé par arrêté préfectoral, affiché sur son compteur. En revanche, le VTC et le VMDTR peuvent fixer librement leurs tarifs, qui doivent être communiqués au client avant la course.',
      difficulty:     'easy',
      exam_tag:       'tarification',
      ordre:          3,
    },
  ];

  for (const qcm of qcmData) {
    await prisma.quizQuestion.upsert({
      where: { id: qcm.id },
      update: {},
      create: qcm,
    });
  }
  console.log(`  ✅ 3 QCM créés`);

  // ── 3 Flashcards ──────────────────────────────────────────────────────────
  const flashcardsData = [
    {
      id:        'm01-ch1-fc-1',
      lesson_id: lesson.id,
      front:     'Maraude',
      back:      'Prise en charge d\'un client sur la voie publique sans réservation préalable — droit exclusif du Taxi.',
      ordre:     1,
    },
    {
      id:        'm01-ch1-fc-2',
      lesson_id: lesson.id,
      front:     'Réservation préalable',
      back:      'Obligation du VTC et du VMDTR : il est interdit de prendre un client sans commande passée avant la prise en charge.',
      ordre:     2,
    },
    {
      id:        'm01-ch1-fc-3',
      lesson_id: lesson.id,
      front:     'Tarification libre',
      back:      'Prix fixé librement par le conducteur VTC / VMDTR avant la course (≠ Taxi dont le tarif est réglementé par compteur horokilométrique).',
      ordre:     3,
    },
  ];

  for (const fc of flashcardsData) {
    await prisma.flashcard.upsert({
      where: { id: fc.id },
      update: {},
      create: fc,
    });
  }
  console.log(`  ✅ 3 Flashcards créées`);

  // ── Media Asset (image à générer) ─────────────────────────────────────────
  await prisma.mediaAsset.upsert({
    where: { id: 'm01-ch1-img-1' },
    update: {},
    create: {
      id:        'm01-ch1-img-1',
      lesson_id: lesson.id,
      type:      'image',
      prompt:    'Illustration pédagogique : trois véhicules côte à côte sur une route urbaine. À gauche, un taxi avec une enseigne lumineuse jaune et un compteur horokilométrique visible, une flèche indique "Maraude autorisée". Au centre, une berline VTC sombre avec une étiquette "Réservation préalable obligatoire" et "Prix libre". À droite, un véhicule VMDTR (Mercedes ou Renault grand espace) avec "9 places max" et "Groupe uniquement". Style réaliste, palette sobre bleu nuit et blanc, annotations claires en français.',
      alt_text:  'Les trois métiers du T3P : Taxi (maraude), VTC (réservation, prix libre), VMDTR (groupe, réservation, prix libre)',
      status:    'draft',
    },
  });
  console.log(`  ✅ Media asset (image draft) créé`);

  console.log('\n🎉 Seed LMS M01/Ch1 terminé avec succès.');
}

main()
  .catch((e) => {
    console.error('❌ Erreur seed LMS :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
