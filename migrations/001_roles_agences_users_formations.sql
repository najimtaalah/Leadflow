-- Migration 001 — Tables de base : rôles, agences, utilisateurs, formations, sessions
-- Compatible MySQL 8.0+

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS roles (
    id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom  ENUM('super_admin','role_admin','commercial','role_administratif',
              'agent_accueil','manager') NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agences (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom         VARCHAR(100) NOT NULL,
    ville       VARCHAR(100),
    region      VARCHAR(100),
    code        VARCHAR(20),
    actif       TINYINT(1) NOT NULL DEFAULT 1,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    prenom        VARCHAR(80) NOT NULL,
    nom           VARCHAR(80) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id       INT UNSIGNED NOT NULL,
    agence_id     INT UNSIGNED,
    actif         TINYINT(1) NOT NULL DEFAULT 1,
    last_login    DATETIME,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME,
    FOREIGN KEY (role_id)   REFERENCES roles(id),
    FOREIGN KEY (agence_id) REFERENCES agences(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS formations (
    id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom                VARCHAR(150) NOT NULL,
    description        TEXT,
    duree_heures       INT UNSIGNED,
    cout_defaut        DECIMAL(10,2),
    frais_cma_defaut   DECIMAL(10,2),
    config_pedagogique ENUM('theorie_seule','pratique_seule','theorie_et_pratique')
                       NOT NULL DEFAULT 'theorie_et_pratique',
    actif              TINYINT(1) NOT NULL DEFAULT 1,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions_formation (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    formation_id   INT UNSIGNED NOT NULL,
    code_session   VARCHAR(50) NOT NULL UNIQUE,
    type_session   ENUM('cours','edof','examen') NOT NULL DEFAULT 'cours',
    date_debut     DATE NOT NULL,
    date_fin       DATE NOT NULL,
    capacite_max   INT UNSIGNED NOT NULL DEFAULT 30,
    lieu           VARCHAR(150),
    actif          TINYINT(1) NOT NULL DEFAULT 1,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME,
    FOREIGN KEY (formation_id) REFERENCES formations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
