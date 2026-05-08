-- Migration 004 — Interactions, agenda RDV, modèles SMS

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS interactions (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lead_id     INT UNSIGNED,
    dossier_id  INT UNSIGNED,
    type        ENUM('appel','sms','email','rdv','note') NOT NULL,
    contenu     TEXT,
    duree       INT,
    user_id     INT UNSIGNED,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id)    REFERENCES leads(id),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id),
    FOREIGN KEY (user_id)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agenda_rdv (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type_rdv         ENUM('commercial','administratif','interne') NOT NULL,
    titre            VARCHAR(200) NOT NULL,
    description      TEXT,
    date_rdv         DATE NOT NULL,
    heure_debut      TIME NOT NULL,
    heure_fin        TIME NOT NULL,
    statut           ENUM('planifie','confirme','effectue','annule','en_attente')
                     NOT NULL DEFAULT 'planifie',
    responsable_id   INT UNSIGNED NOT NULL,
    lead_id          INT UNSIGNED,
    dossier_id       INT UNSIGNED,
    notif_email      TINYINT(1) NOT NULL DEFAULT 1,
    notif_sms        TINYINT(1) NOT NULL DEFAULT 1,
    notif_rappel_24h TINYINT(1) NOT NULL DEFAULT 0,
    created_by       INT UNSIGNED,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME,
    FOREIGN KEY (responsable_id) REFERENCES users(id),
    FOREIGN KEY (lead_id)        REFERENCES leads(id),
    FOREIGN KEY (dossier_id)     REFERENCES dossiers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sms_modeles (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type           VARCHAR(80) NOT NULL,
    nom            VARCHAR(150) NOT NULL,
    sujet_email    VARCHAR(200),
    contenu_email  TEXT,
    contenu_sms    VARCHAR(500),
    actif          TINYINT(1) NOT NULL DEFAULT 1,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
