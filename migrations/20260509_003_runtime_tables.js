'use strict';

/**
 * Migration 003 — Consolidation des tables et colonnes créées en runtime
 *
 * Ces objets étaient auparavant créés par le code applicatif (ALTER TABLE /
 * CREATE TABLE IF NOT EXISTS dans les contrôleurs) sans traçabilité.
 * Cette migration les capture dans le système de versions.
 *
 * Tables consolidées :
 *   - taches             (Tache.js — ensureTable())
 *   - prelevements_log   (prelevementsController.js — ensureSepaColumns())
 *   - historique_imports (importsController.js — ensureTable())
 *
 * Colonnes consolidées sur dossiers (SEPA) :
 *   - iban, bic, mandat_ref, mandat_date, prelevement_actif,
 *     provider_customer_id, provider_mandate_id
 *
 * Colonne consolidée sur echeances :
 *   - prelevement_auto
 */

exports.up = async function (knex) {
  // ── TACHES ────────────────────────────────────────────────────────────────
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS taches (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      dossier_id  INT UNSIGNED NOT NULL,
      type        VARCHAR(50)  NOT NULL,
      titre       VARCHAR(150) NOT NULL,
      statut      ENUM('en_attente','en_cours','fait','incomplet') NOT NULL DEFAULT 'en_attente',
      assigned_to INT UNSIGNED NULL,
      notes       TEXT         NULL,
      created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── PRELEVEMENTS_LOG ──────────────────────────────────────────────────────
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS prelevements_log (
      id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      echeance_id  INT UNSIGNED NOT NULL,
      dossier_id   INT UNSIGNED NOT NULL,
      montant      DECIMAL(10,2) NOT NULL,
      mode         VARCHAR(20)   NOT NULL DEFAULT 'simulation',
      provider_ref VARCHAR(100)  NULL,
      statut       ENUM('succes','echec','en_cours') NOT NULL DEFAULT 'en_cours',
      message      TEXT          NULL,
      created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dossier_id) REFERENCES dossiers(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── HISTORIQUE_IMPORTS ────────────────────────────────────────────────────
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS historique_imports (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      type        VARCHAR(20)  NOT NULL,
      fichier     VARCHAR(255) NULL,
      nb_lignes   INT          DEFAULT 0,
      nb_importes INT          DEFAULT 0,
      nb_maj      INT          DEFAULT 0,
      nb_erreurs  INT          DEFAULT 0,
      user_id     INT          NULL,
      created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── COLONNES SEPA SUR DOSSIERS ─────────────────────────────────────────────
  await knex.raw(`
    ALTER TABLE dossiers
      ADD COLUMN IF NOT EXISTS iban                 VARCHAR(34)  NULL,
      ADD COLUMN IF NOT EXISTS bic                  VARCHAR(11)  NULL,
      ADD COLUMN IF NOT EXISTS mandat_ref           VARCHAR(60)  NULL,
      ADD COLUMN IF NOT EXISTS mandat_date          DATE         NULL,
      ADD COLUMN IF NOT EXISTS prelevement_actif    TINYINT(1)   NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS provider_customer_id VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS provider_mandate_id  VARCHAR(100) NULL
  `);

  // ── PRELEVEMENT_AUTO SUR ECHEANCES ─────────────────────────────────────────
  await knex.raw(`
    ALTER TABLE echeances
      ADD COLUMN IF NOT EXISTS prelevement_auto TINYINT(1) NOT NULL DEFAULT 0
  `);
};

exports.down = async function (knex) {
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0');

  await knex.raw('DROP TABLE IF EXISTS historique_imports');
  await knex.raw('DROP TABLE IF EXISTS prelevements_log');
  await knex.raw('DROP TABLE IF EXISTS taches');

  const sepaColumns = [
    'iban', 'bic', 'mandat_ref', 'mandat_date',
    'prelevement_actif', 'provider_customer_id', 'provider_mandate_id',
  ];
  for (const col of sepaColumns) {
    await knex.raw(`ALTER TABLE dossiers DROP COLUMN IF EXISTS \`${col}\``).catch(() => {});
  }

  await knex.raw(`ALTER TABLE echeances DROP COLUMN IF EXISTS prelevement_auto`).catch(() => {});

  await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
};
