-- Migration 005 — Logs système, résultats CMA, config commissions, imports, équipes

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS logs_systeme (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    action      VARCHAR(80) NOT NULL,
    user_id     INT UNSIGNED,
    details     JSON,
    ip_address  VARCHAR(45),
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resultats_cma (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dossier_id    INT UNSIGNED NOT NULL,
    session_code  VARCHAR(50) NOT NULL,
    type_epreuve  ENUM('theorie','pratique') NOT NULL,
    note          DECIMAL(4,2),
    resultat      ENUM('admis','echec','en_attente') NOT NULL DEFAULT 'en_attente',
    action_auto   VARCHAR(200),
    sync_source   VARCHAR(20) DEFAULT 'auto',
    synced_at     DATETIME,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME,
    UNIQUE KEY uk_resultat_cma (dossier_id, session_code, type_epreuve),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS config_sync_cma (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actif               TINYINT(1) NOT NULL DEFAULT 1,
    frequence           ENUM('nuit_06h','toutes_12h','toutes_6h') NOT NULL DEFAULT 'nuit_06h',
    derniere_sync       DATETIME,
    nb_trouves          INT UNSIGNED DEFAULT 0,
    nb_en_attente       INT UNSIGNED DEFAULT 0,
    nb_messages_envoyes INT UNSIGNED DEFAULT 0,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS config_commissions (
    id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_nom                VARCHAR(50) NOT NULL UNIQUE,
    taux_base               DECIMAL(5,2) NOT NULL DEFAULT 6.50,
    taux_supplement_equipe  DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    actif                   TINYINT(1) NOT NULL DEFAULT 1,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Taux par défaut
INSERT IGNORE INTO config_commissions (role_nom, taux_base, taux_supplement_equipe) VALUES
  ('commercial', 6.50, 0.00),
  ('manager',    6.50, 1.50);

CREATE TABLE IF NOT EXISTS imports_jobs (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type         ENUM('gestion','edof') NOT NULL,
    mode         VARCHAR(30),
    lues         INT UNSIGNED DEFAULT 0,
    crees        INT UNSIGNED DEFAULT 0,
    mises_a_jour INT UNSIGNED DEFAULT 0,
    rejetees     INT UNSIGNED DEFAULT 0,
    user_id      INT UNSIGNED,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS imports_rejets (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_id     INT UNSIGNED NOT NULL,
    ligne      INT UNSIGNED,
    donnees    JSON,
    raison     TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES imports_jobs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rapports_config (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type        VARCHAR(80) NOT NULL,
    params      JSON,
    created_by  INT UNSIGNED,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS equipes (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom        VARCHAR(100) NOT NULL,
    agence_id  INT UNSIGNED,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agence_id) REFERENCES agences(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS equipe_membres (
    equipe_id INT UNSIGNED NOT NULL,
    user_id   INT UNSIGNED NOT NULL,
    PRIMARY KEY (equipe_id, user_id),
    FOREIGN KEY (equipe_id) REFERENCES equipes(id),
    FOREIGN KEY (user_id)   REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
