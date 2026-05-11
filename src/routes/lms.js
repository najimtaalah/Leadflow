'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  getLesson,
  getQuiz,
  submitQuiz,
  getFlashcards,
  reviewFlashcard,
  getMyProgress,
} = require('../controllers/lmsController');

const router = express.Router();

// Toutes les routes LMS requièrent un JWT valide
router.use(authenticate);

// ── Leçons ────────────────────────────────────────────────────────────────────
router.get('/lessons/:id', getLesson);

// ── Quiz ──────────────────────────────────────────────────────────────────────
router.get('/quiz/:id',    getQuiz);
router.post('/quiz/:id',   submitQuiz);

// ── Flashcards ────────────────────────────────────────────────────────────────
router.get('/flashcards',          getFlashcards);
router.patch('/flashcards/:id',    reviewFlashcard);

// ── Progression ───────────────────────────────────────────────────────────────
router.get('/progress', getMyProgress);

module.exports = router;
