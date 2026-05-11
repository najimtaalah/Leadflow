-- Migration 008 — LMS T3P : 6 nouvelles tables pour le module pédagogique
-- Module, Lesson, QuizQuestion, Flashcard, UserProgress, MediaAsset
-- Les tables existantes LeadFlow+ ne sont PAS modifiées.
-- Compatible MySQL 8.0+

SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. Modules pédagogiques ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lms_modules (
    id             VARCHAR(30)  NOT NULL PRIMARY KEY,
    titre          VARCHAR(255) NOT NULL,
    ordre          INT UNSIGNED NOT NULL DEFAULT 0,
    filiere        ENUM('taxi','vtc','vmdtr','commun') NOT NULL DEFAULT 'commun',
    objectif       TEXT         NOT NULL,
    duree_estimee  INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Durée estimée en minutes',
    createdAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lms_modules_filiere (filiere),
    INDEX idx_lms_modules_ordre   (ordre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. Leçons ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lms_lessons (
    id               VARCHAR(30)  NOT NULL PRIMARY KEY,
    module_id        VARCHAR(30)  NOT NULL,
    titre            VARCHAR(255) NOT NULL,
    objectif         TEXT         NOT NULL,
    duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    content_blocks   JSON         NOT NULL,
    media_prompt     TEXT         NULL,
    interaction_type ENUM('lecture','quiz','flashcard') NOT NULL DEFAULT 'lecture',
    createdAt        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lms_lessons_module (module_id),
    CONSTRAINT fk_lms_lessons_module FOREIGN KEY (module_id)
        REFERENCES lms_modules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. Questions de quiz ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lms_quiz_questions (
    id             VARCHAR(30)  NOT NULL PRIMARY KEY,
    lesson_id      VARCHAR(30)  NOT NULL,
    type           ENUM('qcm','qrc') NOT NULL DEFAULT 'qcm',
    question       TEXT         NOT NULL,
    choices        JSON         NOT NULL COMMENT 'Array de strings pour QCM',
    correct_answer VARCHAR(500) NOT NULL,
    explanation    TEXT         NOT NULL,
    difficulty     ENUM('easy','medium','hard') NOT NULL DEFAULT 'medium',
    exam_tag       VARCHAR(100) NULL,
    ordre          INT UNSIGNED NOT NULL DEFAULT 0,
    createdAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lms_quiz_lesson  (lesson_id),
    INDEX idx_lms_quiz_ordre   (ordre),
    CONSTRAINT fk_lms_quiz_lesson FOREIGN KEY (lesson_id)
        REFERENCES lms_lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. Flashcards (SRS — Spaced Repetition) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS lms_flashcards (
    id             VARCHAR(30)  NOT NULL PRIMARY KEY,
    lesson_id      VARCHAR(30)  NOT NULL,
    front          TEXT         NOT NULL,
    back           TEXT         NOT NULL,
    next_review_at DATETIME     NULL,
    ease_factor    FLOAT        NOT NULL DEFAULT 2.5,
    ordre          INT UNSIGNED NOT NULL DEFAULT 0,
    createdAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lms_flashcards_lesson (lesson_id),
    CONSTRAINT fk_lms_flashcards_lesson FOREIGN KEY (lesson_id)
        REFERENCES lms_lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 5. Progression apprenant ──────────────────────────────────────────────────
-- user_id référence users.id de LeadFlow+ (via FK logique, pas FK physique pour découplage)
CREATE TABLE IF NOT EXISTS lms_user_progress (
    id             VARCHAR(30)  NOT NULL PRIMARY KEY,
    user_id        INT UNSIGNED NOT NULL COMMENT 'Référence users.id LeadFlow+',
    lesson_id      VARCHAR(30)  NOT NULL,
    status         ENUM('not_started','in_progress','done') NOT NULL DEFAULT 'not_started',
    score          INT UNSIGNED NULL COMMENT 'Score quiz en %',
    attempts       INT UNSIGNED NOT NULL DEFAULT 0,
    last_seen_at   DATETIME     NULL,
    next_review_at DATETIME     NULL,
    createdAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_lms_progress (user_id, lesson_id),
    INDEX idx_lms_progress_lesson (lesson_id),
    CONSTRAINT fk_lms_progress_lesson FOREIGN KEY (lesson_id)
        REFERENCES lms_lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 6. Assets médias (images, audios à générer) ───────────────────────────────
CREATE TABLE IF NOT EXISTS lms_media_assets (
    id        VARCHAR(30)  NOT NULL PRIMARY KEY,
    lesson_id VARCHAR(30)  NOT NULL,
    type      ENUM('image','audio') NOT NULL,
    prompt    TEXT         NOT NULL,
    alt_text  VARCHAR(500) NULL,
    status    ENUM('draft','generated','approved') NOT NULL DEFAULT 'draft',
    url       VARCHAR(1000) NULL,
    createdAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lms_media_lesson (lesson_id),
    CONSTRAINT fk_lms_media_lesson FOREIGN KEY (lesson_id)
        REFERENCES lms_lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
