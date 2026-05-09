'use strict';

/**
 * Migration 002 — Lot 0 : clarification entités Lead / Apprenant / Dossier
 *
 * Additive uniquement — aucune colonne existante supprimée.
 * Reprend le contenu de 001_lot0_entities.sql (SQL brut remplacé par cette migration).
 *
 * Nouveautés :
 *   - leads.badge_pre_dossier
 *   - Table apprenants
 *   - Dossiers : apprenant_id, id_lead_origine, type_financement,
 *                reference_financeur, numero_cma
 *   - Table pre_dossiers
 *   - Table journal_dossier
 *   - sessions_formation.type_session étendu (theorie / pratique)
 */

exports.up = async function (knex) {
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0');

  // 1. leads.badge_pre_dossier
  await knex.raw(`
    ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS badge_pre_dossier TINYINT(1) NOT NULL DEFAULT 0
  `);

  // 2. Table apprenants
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS apprenants (
      id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      id_lead_origine INT UNSIGNED          NULL,
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
  `);

  // 3. dossiers — nouvelles colonnes entité cible
  await knex.raw(`
    ALTER TABLE dossiers
      ADD COLUMN IF NOT EXISTS apprenant_id        INT UNSIGNED NULL AFTER lead_id,
      ADD COLUMN IF NOT EXISTS id_lead_origine     INT UNSIGNED NULL AFTER apprenant_id,
      ADD COLUMN IF NOT EXISTS type_financement    ENUM('cpf','opco','perso','employeur','autre') NULL,
      ADD COLUMN IF NOT EXISTS reference_financeur VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS numero_cma          VARCHAR(50)  NULL
  `);

  // Contraintes FK (ignorées si déjà présentes)
  try {
    await knex.raw(`
      ALTER TABLE dossiers
        ADD CONSTRAINT fk_dossiers_apprenant
          FOREIGN KEY (apprenant_id) REFERENCES apprenants(id)
    `);
  } catch (_) { /* contrainte déjà présente */ }

  try {
    await knex.raw(`
      ALTER TABLE dossiers
        ADD CONSTRAINT fk_dossiers_lead_origine
          FOREIGN KEY (id_lead_origine) REFERENCES leads(id)
    `);
  } catch (_) { /* contrainte déjà présente */ }

  // 4. Table pre_dossiers
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS pre_dossiers (
      id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      id_lead               INT UNSIGNED NOT NULL,
      statut_bloc_admin     ENUM('en_attente','valide','rejete') NOT NULL DEFAULT 'en_attente',
      statut_bloc_financier ENUM('en_attente','valide','rejete') NOT NULL DEFAULT 'en_attente',
      apprenant_id          INT UNSIGNED NULL,
      created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at            DATETIME              NULL,
      FOREIGN KEY (id_lead)      REFERENCES leads(id),
      FOREIGN KEY (apprenant_id) REFERENCES apprenants(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 5. Table journal_dossier
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS journal_dossier (
      id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      dossier_id   INT UNSIGNED NOT NULL,
      action       VARCHAR(80)  NOT NULL,
      champ        VARCHAR(80)          NULL,
      valeur_avant TEXT                 NULL,
      valeur_apres TEXT                 NULL,
      user_id      INT UNSIGNED         NULL,
      created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dossier_id) REFERENCES dossiers(id),
      FOREIGN KEY (user_id)    REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 6. sessions_formation.type_session étendu
  await knex.raw(`
    ALTER TABLE sessions_formation
      MODIFY COLUMN type_session
        ENUM('cours','edof','examen','theorie','pratique')
        NOT NULL DEFAULT 'cours'
  `);

  await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
};

exports.down = async function (knex) {
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0');

  await knex.raw('DROP TABLE IF EXISTS journal_dossier');
  await knex.raw('DROP TABLE IF EXISTS pre_dossiers');

  // Supprimer les colonnes ajoutées à dossiers
  const dossiersColumns = [
    'apprenant_id', 'id_lead_origine', 'type_financement',
    'reference_financeur', 'numero_cma',
  ];
  for (const col of dossiersColumns) {
    await knex.raw(`ALTER TABLE dossiers DROP COLUMN IF EXISTS \`${col}\``).catch(() => {});
  }

  await knex.raw('DROP TABLE IF EXISTS apprenants');

  await knex.raw(`
    ALTER TABLE leads DROP COLUMN IF EXISTS badge_pre_dossier
  `).catch(() => {});

  // Restaurer l'ENUM original de sessions_formation
  await knex.raw(`
    ALTER TABLE sessions_formation
      MODIFY COLUMN type_session
        ENUM('cours','edof','examen')
        NOT NULL DEFAULT 'cours'
  `).catch(() => {});

  await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
};
