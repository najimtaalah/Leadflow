-- ============================================================
-- Migration Lot 0 — Clarification entités Lead / Apprenant / Dossier
-- Additive uniquement : aucune colonne existante supprimée.
-- Compatible MySQL 5.7+ / MySQL 8.0+
-- NB : les ALTER TABLE conditionnels sont gérés par le script
--      migrations/run.js qui vérifie information_schema avant exécution.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ─────────────────────────────────────────────────────────────
-- 1. APPRENANTS (nouvelle entité)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS apprenants (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_lead_origine INT UNSIGNED          NULL COMMENT 'Lead source de cet apprenant',
    nom             VARCHAR(80)  NOT NULL,
    prenom          VARCHAR(80)  NOT NULL DEFAULT '',
    date_naissance  DATE                  NULL,
    telephone       VARCHAR(20)           NULL,
    email           VARCHAR(150)          NULL,
    adresse         TEXT                  NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME              NULL,
    FOREIGN KEY (id_lead_origine) REFERENCES leads(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Personnes physiques qualifiées comme apprenants';

-- ─────────────────────────────────────────────────────────────
-- 2. PRÉ-DOSSIERS (nouvelle entité)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pre_dossiers (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_lead               INT UNSIGNED NOT NULL COMMENT 'Lead associé',
    statut_bloc_admin     ENUM('en_attente','valide','rejete') NOT NULL DEFAULT 'en_attente',
    statut_bloc_financier ENUM('en_attente','valide','rejete') NOT NULL DEFAULT 'en_attente',
    apprenant_id          INT UNSIGNED NULL COMMENT 'Renseigné lors de l activation',
    created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME              NULL,
    FOREIGN KEY (id_lead)      REFERENCES leads(id),
    FOREIGN KEY (apprenant_id) REFERENCES apprenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Pré-dossiers : blocs admin + financier avant dossier officiel';

-- ─────────────────────────────────────────────────────────────
-- 3. JOURNAL DOSSIER (audit trail)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_dossier (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dossier_id   INT UNSIGNED NOT NULL,
    action       VARCHAR(80)  NOT NULL COMMENT 'Ex. created, updated, statut_changed',
    champ        VARCHAR(80)          NULL COMMENT 'Champ modifié',
    valeur_avant TEXT                 NULL,
    valeur_apres TEXT                 NULL,
    user_id      INT UNSIGNED         NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id),
    FOREIGN KEY (user_id)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Journal d audit des modifications de dossiers';

SET FOREIGN_KEY_CHECKS = 1;
