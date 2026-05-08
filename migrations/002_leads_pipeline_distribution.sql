-- Migration 002 — Leads, sources, pipeline, distribution, limites agents, réassignations

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS sources_leads (
    id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom  VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leads (
    id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom                  VARCHAR(80) NOT NULL,
    prenom               VARCHAR(80) NOT NULL DEFAULT '',
    telephone            VARCHAR(20) NOT NULL,
    email                VARCHAR(150),
    source_id            INT UNSIGNED,
    formation_souhaitee  VARCHAR(150),
    agence_id            INT UNSIGNED,
    vendeur_id           INT UNSIGNED,
    statut               ENUM('entrant','contacte','qualifie','rdv_booke',
                              'gagne','perdu','annule','en_suspens','injoignable')
                         NOT NULL DEFAULT 'entrant',
    notes                TEXT,
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME,
    FOREIGN KEY (source_id)  REFERENCES sources_leads(id),
    FOREIGN KEY (agence_id)  REFERENCES agences(id),
    FOREIGN KEY (vendeur_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pipeline_historique (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lead_id      INT UNSIGNED NOT NULL,
    statut_avant VARCHAR(30),
    statut_apres VARCHAR(30) NOT NULL,
    user_id      INT UNSIGNED,
    notes        TEXT,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS config_distribution (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    methode    ENUM('round_robin','par_agence','par_formation') NOT NULL DEFAULT 'round_robin',
    agence_id  INT UNSIGNED,
    actif      TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (agence_id) REFERENCES agences(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_limites (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED NOT NULL UNIQUE,
    max_leads  INT UNSIGNED NOT NULL DEFAULT 50,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reassignations (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lead_id             INT UNSIGNED NOT NULL,
    ancien_vendeur_id   INT UNSIGNED,
    nouveau_vendeur_id  INT UNSIGNED,
    motif               VARCHAR(100),
    fait_par_id         INT UNSIGNED,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
