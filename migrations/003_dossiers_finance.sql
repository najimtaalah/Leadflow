-- Migration 003 — Dossiers, encaissements, échéances + trigger référence

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS statuts_dossier (
    id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom  VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Données initiales statuts dossier
INSERT IGNORE INTO statuts_dossier (nom) VALUES
  ('Nouveau'), ('En cours'), ('Validé'), ('Inscrit'),
  ('En formation'), ('Terminé'), ('Abandonné'), ('Annulé');

CREATE TABLE IF NOT EXISTS dossiers (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reference             VARCHAR(20) UNIQUE,
    lead_id               INT UNSIGNED,
    nom                   VARCHAR(80) NOT NULL,
    prenom                VARCHAR(80) NOT NULL DEFAULT '',
    telephone             VARCHAR(20),
    email                 VARCHAR(150),
    formation_souhaitee   VARCHAR(150),
    numero_dossier_edof   VARCHAR(50),
    cout_total_formation  DECIMAL(10,2),
    part_financeur        DECIMAL(10,2),
    fp_manuel             DECIMAL(10,2),
    frais_cma             DECIMAL(10,2),
    frais_cma_paye        TINYINT(1) NOT NULL DEFAULT 0,
    statut_id             INT UNSIGNED,
    agence_id             INT UNSIGNED,
    vendeur_id            INT UNSIGNED,
    session_cours_id      INT UNSIGNED NULL,
    session_edof_id       INT UNSIGNED NULL,
    examen_id             INT UNSIGNED NULL,
    archived              TINYINT(1) NOT NULL DEFAULT 0,
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME,
    FOREIGN KEY (lead_id)          REFERENCES leads(id),
    FOREIGN KEY (statut_id)        REFERENCES statuts_dossier(id),
    FOREIGN KEY (agence_id)        REFERENCES agences(id),
    FOREIGN KEY (vendeur_id)       REFERENCES users(id),
    FOREIGN KEY (session_cours_id) REFERENCES sessions_formation(id),
    FOREIGN KEY (session_edof_id)  REFERENCES sessions_formation(id),
    FOREIGN KEY (examen_id)        REFERENCES sessions_formation(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TRIGGER IF EXISTS trg_dossier_reference;
CREATE TRIGGER trg_dossier_reference
BEFORE INSERT ON dossiers
FOR EACH ROW
BEGIN
    IF NEW.reference IS NULL THEN
        SET NEW.reference = CONCAT('ADM_', LPAD(
            (SELECT COALESCE(MAX(id),0)+1 FROM dossiers), 5, '0'
        ));
    END IF;
END;

CREATE TABLE IF NOT EXISTS encaissements (
    id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dossier_id        INT UNSIGNED NOT NULL,
    montant           DECIMAL(10,2) NOT NULL,
    date_encaissement DATE NOT NULL,
    mode_paiement     ENUM('virement','cb','cheque','especes','prelevement')
                      NOT NULL DEFAULT 'virement',
    user_id           INT UNSIGNED,
    notes             TEXT,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id),
    FOREIGN KEY (user_id)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS echeances (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dossier_id     INT UNSIGNED NOT NULL,
    montant        DECIMAL(10,2) NOT NULL,
    date_echeance  DATE NOT NULL,
    statut         ENUM('en_attente','payee') NOT NULL DEFAULT 'en_attente',
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME,
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
