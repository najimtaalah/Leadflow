-- Migration 007 — Module Qualiopi : émargement, évaluations, satisfaction, documents réglementaires
-- Couvre : Indicateur 3 (présences), Indicateur 5 (évaluation acquis), Indicateur 6 (satisfaction)
--          Indicateur 2 (documents réglementaires)
-- Compatible MySQL 8.0+

SET FOREIGN_KEY_CHECKS = 0;

-- ── Indicateur 3 : Traçabilité des présences ─────────────────────────────────
-- Émargement numérique par dossier (apprenant) et session
-- Un enregistrement = une journée de présence signée
CREATE TABLE IF NOT EXISTS emargements (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dossier_id       INT UNSIGNED NOT NULL,
    session_id       INT UNSIGNED NOT NULL,
    date_seance      DATE NOT NULL,
    heure_debut      TIME NOT NULL DEFAULT '09:00:00',
    heure_fin        TIME NOT NULL DEFAULT '17:00:00',
    present          TINYINT(1) NOT NULL DEFAULT 0,
    signature_hash   VARCHAR(64) NULL COMMENT 'SHA-256 de la signature numérique',
    signe_par_user   INT UNSIGNED NULL COMMENT 'User qui a validé (formateur/admif)',
    motif_absence    VARCHAR(255) NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NULL,
    UNIQUE KEY uq_emargement (dossier_id, session_id, date_seance),
    FOREIGN KEY (dossier_id)     REFERENCES dossiers(id)           ON DELETE CASCADE,
    FOREIGN KEY (session_id)     REFERENCES sessions_formation(id) ON DELETE CASCADE,
    FOREIGN KEY (signe_par_user) REFERENCES users(id)              ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Indicateur 5 : Évaluation des acquis ─────────────────────────────────────
-- Questionnaires positionnement pré-formation et évaluation post-formation
CREATE TABLE IF NOT EXISTS evaluations_qualiopi (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dossier_id       INT UNSIGNED NOT NULL,
    session_id       INT UNSIGNED NOT NULL,
    type_eval        ENUM('positionnement','post_formation') NOT NULL,
    reponses         JSON NOT NULL COMMENT 'Tableau de {question, reponse, note}',
    score_total      DECIMAL(5,2) NULL COMMENT 'Score en pourcentage 0–100',
    commentaire      TEXT NULL,
    completed_at     DATETIME NULL,
    created_by       INT UNSIGNED NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NULL,
    UNIQUE KEY uq_evaluation (dossier_id, session_id, type_eval),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id)           ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions_formation(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)              ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Indicateur 6 : Satisfaction ──────────────────────────────────────────────
-- Questionnaire de satisfaction apprenant en fin de formation
CREATE TABLE IF NOT EXISTS satisfactions_qualiopi (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dossier_id       INT UNSIGNED NOT NULL,
    session_id       INT UNSIGNED NOT NULL,
    -- Items du questionnaire (note 1–5)
    note_contenu     TINYINT UNSIGNED NULL CHECK (note_contenu BETWEEN 1 AND 5),
    note_formateur   TINYINT UNSIGNED NULL CHECK (note_formateur BETWEEN 1 AND 5),
    note_organisation TINYINT UNSIGNED NULL CHECK (note_organisation BETWEEN 1 AND 5),
    note_locaux      TINYINT UNSIGNED NULL CHECK (note_locaux BETWEEN 1 AND 5),
    note_globale     TINYINT UNSIGNED NULL CHECK (note_globale BETWEEN 1 AND 5),
    commentaire_libre TEXT NULL,
    recommande       TINYINT(1) NULL COMMENT 'Recommanderait la formation (oui/non)',
    completed_at     DATETIME NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NULL,
    UNIQUE KEY uq_satisfaction (dossier_id, session_id),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id)           ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions_formation(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Indicateur 2 : Documents réglementaires ──────────────────────────────────
-- Attestations de fin de formation, conventions, convocations, programmes
CREATE TABLE IF NOT EXISTS documents_qualiopi (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dossier_id       INT UNSIGNED NOT NULL,
    session_id       INT UNSIGNED NULL COMMENT 'NULL pour docs non liés à une session',
    type_document    ENUM('attestation','convention','convocation','programme','feuille_emargement')
                     NOT NULL,
    titre            VARCHAR(200) NOT NULL,
    chemin_fichier   VARCHAR(500) NULL COMMENT 'Chemin relatif ou URL du PDF généré',
    genere_par       INT UNSIGNED NULL,
    genere_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived         TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id)           ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions_formation(id) ON DELETE SET NULL,
    FOREIGN KEY (genere_par) REFERENCES users(id)              ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Vue agrégée satisfaction par session ─────────────────────────────────────
CREATE OR REPLACE VIEW v_satisfaction_session AS
SELECT
    sq.session_id,
    sf.code_session,
    f.nom                                   AS formation_nom,
    COUNT(sq.id)                            AS nb_repondants,
    ROUND(AVG(sq.note_contenu),2)           AS avg_contenu,
    ROUND(AVG(sq.note_formateur),2)         AS avg_formateur,
    ROUND(AVG(sq.note_organisation),2)      AS avg_organisation,
    ROUND(AVG(sq.note_locaux),2)            AS avg_locaux,
    ROUND(AVG(sq.note_globale),2)           AS avg_globale,
    ROUND(
        (AVG(sq.note_contenu) + AVG(sq.note_formateur) +
         AVG(sq.note_organisation) + AVG(sq.note_locaux) +
         AVG(sq.note_globale)) / 5 * 20, 1
    )                                       AS taux_satisfaction_pct,
    SUM(sq.recommande)                      AS nb_recommande
FROM satisfactions_qualiopi sq
JOIN sessions_formation sf ON sf.id = sq.session_id
JOIN formations f          ON f.id  = sf.formation_id
WHERE sq.completed_at IS NOT NULL
GROUP BY sq.session_id, sf.code_session, f.nom;

-- ── Vue taux présence par session ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_presence_session AS
SELECT
    e.session_id,
    sf.code_session,
    f.nom                                       AS formation_nom,
    COUNT(DISTINCT e.dossier_id)                AS nb_apprenants,
    COUNT(*)                                    AS nb_seances_planifiees,
    SUM(e.present)                              AS nb_presences,
    ROUND(SUM(e.present) / COUNT(*) * 100, 1)  AS taux_presence_pct
FROM emargements e
JOIN sessions_formation sf ON sf.id = e.session_id
JOIN formations f          ON f.id  = sf.formation_id
GROUP BY e.session_id, sf.code_session, f.nom;

SET FOREIGN_KEY_CHECKS = 1;
