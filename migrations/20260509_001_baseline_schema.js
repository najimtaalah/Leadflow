'use strict';

/**
 * Migration 001 — Schéma de base LeadFlow v4
 *
 * Consolide le contenu de schema_v4_complet.sql en migrations versionnées.
 * 27 tables + 3 vues. Toutes les tables déjà créées sont ignorées (IF NOT EXISTS).
 *
 * Ce fichier remplace l'initialisation ad-hoc via setup-dev-db.sh.
 */

exports.up = async function (knex) {
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0');

  // 1. ROLES
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS roles (
      id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      nom  ENUM('super_admin','role_admin','commercial','role_administratif',
                'agent_accueil','manager') NOT NULL UNIQUE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 2. AGENCES
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS agences (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      nom        VARCHAR(100) NOT NULL,
      ville      VARCHAR(100),
      region     VARCHAR(100),
      code       VARCHAR(20),
      actif      TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 3. USERS
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS users (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      prenom        VARCHAR(80)  NOT NULL,
      nom           VARCHAR(80)  NOT NULL,
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 4. FORMATIONS
  await knex.raw(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 5. SESSIONS DE FORMATION
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS sessions_formation (
      id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      formation_id INT UNSIGNED NOT NULL,
      code_session VARCHAR(50) NOT NULL UNIQUE,
      type_session ENUM('cours','edof','examen') NOT NULL DEFAULT 'cours',
      date_debut   DATE NOT NULL,
      date_fin     DATE NOT NULL,
      capacite_max INT UNSIGNED NOT NULL DEFAULT 30,
      lieu         VARCHAR(150),
      actif        TINYINT(1) NOT NULL DEFAULT 1,
      created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME,
      FOREIGN KEY (formation_id) REFERENCES formations(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 6. SOURCES LEADS
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS sources_leads (
      id  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      nom VARCHAR(100) NOT NULL UNIQUE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 7. LEADS
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS leads (
      id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      nom                 VARCHAR(80) NOT NULL,
      prenom              VARCHAR(80) NOT NULL DEFAULT '',
      telephone           VARCHAR(20) NOT NULL,
      email               VARCHAR(150),
      source_id           INT UNSIGNED,
      formation_souhaitee VARCHAR(150),
      agence_id           INT UNSIGNED,
      vendeur_id          INT UNSIGNED,
      statut              ENUM('entrant','contacte','qualifie','rdv_booke',
                               'gagne','perdu','annule','en_suspens','injoignable')
                          NOT NULL DEFAULT 'entrant',
      notes               TEXT,
      created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME,
      FOREIGN KEY (source_id)  REFERENCES sources_leads(id),
      FOREIGN KEY (agence_id)  REFERENCES agences(id),
      FOREIGN KEY (vendeur_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 8. PIPELINE HISTORIQUE
  await knex.raw(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 9. CONFIG DISTRIBUTION
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS config_distribution (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      methode    ENUM('round_robin','par_agence','par_formation') NOT NULL DEFAULT 'round_robin',
      agence_id  INT UNSIGNED,
      actif      TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      FOREIGN KEY (agence_id) REFERENCES agences(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 10. AGENT LIMITES
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS agent_limites (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id    INT UNSIGNED NOT NULL UNIQUE,
      max_leads  INT UNSIGNED NOT NULL DEFAULT 50,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 11. REASSIGNATIONS
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS reassignations (
      id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      lead_id            INT UNSIGNED NOT NULL,
      ancien_vendeur_id  INT UNSIGNED,
      nouveau_vendeur_id INT UNSIGNED,
      motif              VARCHAR(100),
      fait_par_id        INT UNSIGNED,
      created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 12. STATUTS DOSSIER
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS statuts_dossier (
      id  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      nom VARCHAR(80) NOT NULL UNIQUE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 13. DOSSIERS
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS dossiers (
      id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      reference            VARCHAR(20) UNIQUE,
      lead_id              INT UNSIGNED,
      nom                  VARCHAR(80) NOT NULL,
      prenom               VARCHAR(80) NOT NULL DEFAULT '',
      telephone            VARCHAR(20),
      email                VARCHAR(150),
      formation_souhaitee  VARCHAR(150),
      numero_dossier_edof  VARCHAR(50),
      cout_total_formation DECIMAL(10,2),
      part_financeur       DECIMAL(10,2),
      fp_manuel            DECIMAL(10,2),
      frais_cma            DECIMAL(10,2),
      frais_cma_paye       TINYINT(1) NOT NULL DEFAULT 0,
      statut_id            INT UNSIGNED,
      agence_id            INT UNSIGNED,
      vendeur_id           INT UNSIGNED,
      session_cours_id     INT UNSIGNED NULL,
      session_edof_id      INT UNSIGNED NULL,
      examen_id            INT UNSIGNED NULL,
      archived             TINYINT(1) NOT NULL DEFAULT 0,
      created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at           DATETIME,
      FOREIGN KEY (lead_id)          REFERENCES leads(id),
      FOREIGN KEY (statut_id)        REFERENCES statuts_dossier(id),
      FOREIGN KEY (agence_id)        REFERENCES agences(id),
      FOREIGN KEY (vendeur_id)       REFERENCES users(id),
      FOREIGN KEY (session_cours_id) REFERENCES sessions_formation(id),
      FOREIGN KEY (session_edof_id)  REFERENCES sessions_formation(id),
      FOREIGN KEY (examen_id)        REFERENCES sessions_formation(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Trigger référence dossier (CREATE OR REPLACE non supporté en knex.raw sans DELIMITER)
  await knex.raw('DROP TRIGGER IF EXISTS trg_dossier_reference');
  await knex.raw(`
    CREATE TRIGGER trg_dossier_reference
    BEFORE INSERT ON dossiers
    FOR EACH ROW
    BEGIN
      IF NEW.reference IS NULL THEN
        SET NEW.reference = CONCAT('ADM_', LPAD(
          (SELECT COALESCE(MAX(id),0)+1 FROM dossiers), 5, '0'
        ));
      END IF;
    END
  `);

  // 14. INSCRIPTIONS
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS inscriptions (
      id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      dossier_id       INT UNSIGNED NOT NULL,
      session_id       INT UNSIGNED NOT NULL,
      type_partie      ENUM('cours','pratique','examen') NOT NULL DEFAULT 'cours',
      statut           ENUM('inscrit','present','absent','annule') NOT NULL DEFAULT 'inscrit',
      date_inscription DATETIME,
      created_by       INT UNSIGNED,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME,
      UNIQUE KEY uk_inscription (dossier_id, session_id, type_partie),
      FOREIGN KEY (dossier_id) REFERENCES dossiers(id),
      FOREIGN KEY (session_id) REFERENCES sessions_formation(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 15. ENCAISSEMENTS
  await knex.raw(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 16. ECHEANCES
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS echeances (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      dossier_id    INT UNSIGNED NOT NULL,
      montant       DECIMAL(10,2) NOT NULL,
      date_echeance DATE NOT NULL,
      statut        ENUM('en_attente','payee') NOT NULL DEFAULT 'en_attente',
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME,
      FOREIGN KEY (dossier_id) REFERENCES dossiers(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 17. INTERACTIONS
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS interactions (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      lead_id    INT UNSIGNED,
      dossier_id INT UNSIGNED,
      type       ENUM('appel','sms','email','rdv','note') NOT NULL,
      contenu    TEXT,
      duree      INT,
      user_id    INT UNSIGNED,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id)    REFERENCES leads(id),
      FOREIGN KEY (dossier_id) REFERENCES dossiers(id),
      FOREIGN KEY (user_id)    REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 18. AGENDA RDV
  await knex.raw(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 19. SMS MODELES
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS sms_modeles (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      type          VARCHAR(80)  NOT NULL,
      nom           VARCHAR(150) NOT NULL,
      sujet_email   VARCHAR(200),
      contenu_email TEXT,
      contenu_sms   VARCHAR(500),
      actif         TINYINT(1) NOT NULL DEFAULT 1,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 20. LOGS SYSTEME
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS logs_systeme (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      action     VARCHAR(80) NOT NULL,
      user_id    INT UNSIGNED,
      details    JSON,
      ip_address VARCHAR(45),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 21. RESULTATS CMA
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS resultats_cma (
      id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      dossier_id   INT UNSIGNED NOT NULL,
      session_code VARCHAR(50)  NOT NULL,
      type_epreuve ENUM('theorie','pratique') NOT NULL,
      note         DECIMAL(4,2),
      resultat     ENUM('admis','echec','en_attente') NOT NULL DEFAULT 'en_attente',
      action_auto  VARCHAR(200),
      sync_source  VARCHAR(20) DEFAULT 'auto',
      synced_at    DATETIME,
      created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME,
      UNIQUE KEY uk_resultat_cma (dossier_id, session_code, type_epreuve),
      FOREIGN KEY (dossier_id) REFERENCES dossiers(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 22. CONFIG SYNC CMA
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS config_sync_cma (
      id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      actif               TINYINT(1) NOT NULL DEFAULT 1,
      frequence           ENUM('nuit_06h','toutes_12h','toutes_6h') NOT NULL DEFAULT 'nuit_06h',
      derniere_sync       DATETIME,
      nb_trouves          INT UNSIGNED DEFAULT 0,
      nb_en_attente       INT UNSIGNED DEFAULT 0,
      nb_messages_envoyes INT UNSIGNED DEFAULT 0,
      created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 23. CONFIG COMMISSIONS
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS config_commissions (
      id                     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      role_nom               VARCHAR(50) NOT NULL UNIQUE,
      taux_base              DECIMAL(5,2) NOT NULL DEFAULT 6.50,
      taux_supplement_equipe DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      actif                  TINYINT(1) NOT NULL DEFAULT 1,
      created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at             DATETIME
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 24. IMPORTS JOBS
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS imports_jobs (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      type        ENUM('gestion','edof') NOT NULL,
      mode        VARCHAR(30),
      lues        INT UNSIGNED DEFAULT 0,
      crees       INT UNSIGNED DEFAULT 0,
      mises_a_jour INT UNSIGNED DEFAULT 0,
      rejetees    INT UNSIGNED DEFAULT 0,
      user_id     INT UNSIGNED,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 25. IMPORTS REJETS
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS imports_rejets (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      job_id     INT UNSIGNED NOT NULL,
      ligne      INT UNSIGNED,
      donnees    JSON,
      raison     TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES imports_jobs(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 26. RAPPORTS CONFIG
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS rapports_config (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      type       VARCHAR(80) NOT NULL,
      params     JSON,
      created_by INT UNSIGNED,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 27. EQUIPES
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS equipes (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      nom        VARCHAR(100) NOT NULL,
      agence_id  INT UNSIGNED,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agence_id) REFERENCES agences(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS equipe_membres (
      equipe_id INT UNSIGNED NOT NULL,
      user_id   INT UNSIGNED NOT NULL,
      PRIMARY KEY (equipe_id, user_id),
      FOREIGN KEY (equipe_id) REFERENCES equipes(id),
      FOREIGN KEY (user_id)   REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // VUES
  await knex.raw(`
    CREATE OR REPLACE VIEW vue_soldes AS
    SELECT
      d.id AS dossier_id,
      d.reference,
      GREATEST(
        COALESCE(d.cout_total_formation, d.fp_manuel, 0)
        - COALESCE(d.part_financeur, 0), 0
      ) AS financement_personnel,
      COALESCE(SUM(e.montant), 0) AS total_encaisse,
      GREATEST(
        GREATEST(
          COALESCE(d.cout_total_formation, d.fp_manuel, 0)
          - COALESCE(d.part_financeur, 0), 0
        ) - COALESCE(SUM(e.montant), 0), 0
      ) AS reste_a_payer
    FROM dossiers d
    LEFT JOIN encaissements e ON e.dossier_id = d.id
    GROUP BY d.id
  `);

  await knex.raw(`
    CREATE OR REPLACE VIEW vue_commissions AS
    SELECT
      u.id                                AS vendeur_id,
      CONCAT(u.prenom,' ',u.nom)          AS vendeur_nom,
      r.nom                               AS role_nom,
      a.id                                AS agence_id,
      a.nom                               AS agence_nom,
      COUNT(d.id)                         AS nb_dossiers,
      COALESCE(SUM(d.cout_total_formation), 0) AS base_calcul,
      cc.taux_base,
      ROUND(COALESCE(SUM(d.cout_total_formation), 0) * cc.taux_base / 100, 2) AS commission_base,
      0.00                                AS supplement_equipe,
      ROUND(COALESCE(SUM(d.cout_total_formation), 0) * cc.taux_base / 100, 2) AS commission_totale
    FROM users u
    JOIN roles r ON r.id = u.role_id
      AND r.nom IN ('commercial','manager')
    JOIN config_commissions cc ON cc.role_nom = r.nom
    LEFT JOIN agences a  ON a.id = u.agence_id
    LEFT JOIN dossiers d ON d.vendeur_id = u.id
      AND d.archived = 0
      AND d.cout_total_formation > 0
    WHERE u.actif = 1
    GROUP BY u.id, u.prenom, u.nom, r.nom, a.id, a.nom, cc.taux_base
  `);

  await knex.raw(`
    CREATE OR REPLACE VIEW vue_finances_dossier AS
    SELECT
      d.id, d.reference, d.nom, d.prenom,
      GREATEST(
        COALESCE(d.cout_total_formation, d.fp_manuel, 0)
        - COALESCE(d.part_financeur, 0), 0
      ) AS financement_personnel,
      COALESCE(enc.total, 0) AS total_encaisse,
      d.frais_cma,
      d.frais_cma_paye
    FROM dossiers d
    LEFT JOIN (
      SELECT dossier_id, SUM(montant) AS total
      FROM encaissements GROUP BY dossier_id
    ) enc ON enc.dossier_id = d.id
  `);

  await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
};

exports.down = async function (knex) {
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0');
  await knex.raw('DROP VIEW IF EXISTS vue_finances_dossier');
  await knex.raw('DROP VIEW IF EXISTS vue_commissions');
  await knex.raw('DROP VIEW IF EXISTS vue_soldes');
  await knex.raw('DROP TRIGGER IF EXISTS trg_dossier_reference');

  const tables = [
    'equipe_membres', 'equipes', 'rapports_config', 'imports_rejets', 'imports_jobs',
    'config_commissions', 'config_sync_cma', 'resultats_cma', 'logs_systeme',
    'sms_modeles', 'agenda_rdv', 'interactions', 'echeances', 'encaissements',
    'inscriptions', 'dossiers', 'statuts_dossier', 'reassignations', 'agent_limites',
    'config_distribution', 'pipeline_historique', 'leads', 'sources_leads',
    'sessions_formation', 'formations', 'users', 'agences', 'roles',
  ];
  for (const t of tables) {
    await knex.raw(`DROP TABLE IF EXISTS \`${t}\``);
  }
  await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
};
