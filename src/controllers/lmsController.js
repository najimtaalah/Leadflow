'use strict';

const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// ── Leçon ─────────────────────────────────────────────────────────────────────

async function getLesson(req, res) {
  const { id } = req.params;
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        module:        true,
        media_assets:  { where: { type: 'image', status: { in: ['generated', 'approved'] } } },
      },
    });
    if (!lesson) return res.status(404).json({ success: false, message: 'Leçon introuvable.' });

    // Tracer la progression (upsert not_started → in_progress)
    await prisma.userProgress.upsert({
      where:  { user_id_lesson_id: { user_id: req.user.id, lesson_id: id } },
      update: { status: 'in_progress', last_seen_at: new Date() },
      create: { id: `up-${req.user.id}-${id}`, user_id: req.user.id, lesson_id: id, status: 'in_progress', last_seen_at: new Date() },
    });

    res.json({ success: true, data: lesson });
  } catch (err) {
    logger.error('LMS getLesson', { error: err.message, id });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ── Quiz ──────────────────────────────────────────────────────────────────────

async function getQuiz(req, res) {
  const { id } = req.params;
  try {
    const lesson = await prisma.lesson.findUnique({
      where:   { id },
      include: { quiz_questions: { orderBy: { ordre: 'asc' } } },
    });
    if (!lesson) return res.status(404).json({ success: false, message: 'Leçon introuvable.' });

    // Masquer correct_answer et explanation côté client (envoyées au moment du submit)
    const questions = lesson.quiz_questions.map(({ correct_answer, explanation, ...q }) => q);
    res.json({ success: true, data: { lesson_id: id, titre: lesson.titre, questions } });
  } catch (err) {
    logger.error('LMS getQuiz', { error: err.message, id });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function submitQuiz(req, res) {
  const { id }      = req.params;
  const { answers } = req.body; // { [questionId]: "choix sélectionné" }

  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ success: false, message: 'answers requis.' });
  }

  try {
    const questions = await prisma.quizQuestion.findMany({
      where:   { lesson_id: id },
      orderBy: { ordre: 'asc' },
    });

    const results = questions.map((q) => {
      const given   = answers[q.id] ?? null;
      const correct = given === q.correct_answer;
      return {
        id:             q.id,
        question:       q.question,
        given,
        correct_answer: q.correct_answer,
        correct,
        explanation:    q.explanation,
      };
    });

    const score = Math.round((results.filter((r) => r.correct).length / questions.length) * 100);

    // Mettre à jour la progression
    const progress = await prisma.userProgress.upsert({
      where:  { user_id_lesson_id: { user_id: req.user.id, lesson_id: id } },
      update: { status: score >= 60 ? 'done' : 'in_progress', score, attempts: { increment: 1 }, last_seen_at: new Date() },
      create: { id: `up-${req.user.id}-${id}`, user_id: req.user.id, lesson_id: id, status: score >= 60 ? 'done' : 'in_progress', score, attempts: 1, last_seen_at: new Date() },
    });

    res.json({ success: true, data: { score, results, status: progress.status } });
  } catch (err) {
    logger.error('LMS submitQuiz', { error: err.message, id });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ── Flashcards ────────────────────────────────────────────────────────────────

async function getFlashcards(req, res) {
  const { lesson_id } = req.query;
  try {
    const where = lesson_id ? { lesson_id } : {};
    const flashcards = await prisma.flashcard.findMany({
      where,
      orderBy: { ordre: 'asc' },
      include: { lesson: { select: { titre: true, module: { select: { filiere: true } } } } },
    });
    res.json({ success: true, data: flashcards });
  } catch (err) {
    logger.error('LMS getFlashcards', { error: err.message });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function reviewFlashcard(req, res) {
  const { id }        = req.params;
  const { difficulty } = req.body; // 'easy' | 'hard'

  if (!['easy', 'hard'].includes(difficulty)) {
    return res.status(400).json({ success: false, message: 'difficulty doit être "easy" ou "hard".' });
  }

  try {
    const card = await prisma.flashcard.findUnique({ where: { id } });
    if (!card) return res.status(404).json({ success: false, message: 'Flashcard introuvable.' });

    // Algorithme SRS simplifié (SM-2 light)
    const easeFactor   = difficulty === 'easy' ? Math.min(card.ease_factor + 0.1, 3.0) : Math.max(card.ease_factor - 0.2, 1.3);
    const daysUntilNext = difficulty === 'easy' ? Math.ceil(easeFactor) : 1;
    const next_review_at = new Date(Date.now() + daysUntilNext * 86_400_000);

    const updated = await prisma.flashcard.update({
      where:  { id },
      data:   { ease_factor: easeFactor, next_review_at },
    });

    res.json({ success: true, data: { id, next_review_at: updated.next_review_at, ease_factor: updated.ease_factor } });
  } catch (err) {
    logger.error('LMS reviewFlashcard', { error: err.message, id });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ── Modules ───────────────────────────────────────────────────────────────────

async function getModules(req, res) {
  try {
    const modules = await prisma.module.findMany({
      orderBy: { ordre: 'asc' },
      include: {
        lessons: {
          orderBy: { titre: 'asc' },
          select: {
            id: true, titre: true, objectif: true, duration_seconds: true, interaction_type: true,
            _count: { select: { quiz_questions: true, flashcards: true } },
            user_progress: { where: { user_id: req.user.id }, select: { status: true, score: true } },
          },
        },
      },
    });
    res.json({ success: true, data: modules });
  } catch (err) {
    logger.error('LMS getModules', { error: err.message });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

async function getModule(req, res) {
  const { id } = req.params;
  try {
    const module = await prisma.module.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: { titre: 'asc' },
          select: {
            id: true, titre: true, objectif: true, duration_seconds: true, interaction_type: true,
            _count: { select: { quiz_questions: true, flashcards: true } },
            user_progress: { where: { user_id: req.user.id }, select: { status: true, score: true } },
          },
        },
      },
    });
    if (!module) return res.status(404).json({ success: false, message: 'Module introuvable.' });
    res.json({ success: true, data: module });
  } catch (err) {
    logger.error('LMS getModule', { error: err.message, id });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ── Progression apprenant ─────────────────────────────────────────────────────

async function getMyProgress(req, res) {
  try {
    const progress = await prisma.userProgress.findMany({
      where:   { user_id: req.user.id },
      include: { lesson: { select: { titre: true, module: { select: { titre: true, filiere: true } } } } },
    });
    res.json({ success: true, data: progress });
  } catch (err) {
    logger.error('LMS getMyProgress', { error: err.message });
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

module.exports = { getModules, getModule, getLesson, getQuiz, submitQuiz, getFlashcards, reviewFlashcard, getMyProgress };
