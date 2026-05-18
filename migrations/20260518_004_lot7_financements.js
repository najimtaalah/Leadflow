'use strict';

/**
 * Migration 004 — Lot 7 : Facturation & Financeurs
 *
 * Crée la table `financements` (1 ligne par dossier) avec :
 *  - type de financement et identifiant financeur
 *  - montants (total, pris en charge, reste à charge)
 *  - statuts et dates de facturation
 *  - traçabilité Qualiopi (journal d'audit existant)
 */

exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS financements (
      id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      dossier_id              INT UNSIGNED NOT NULL,

      -- Identifiant financeur (7a)
      type_financement        ENUM('CPF','FRANCE_TRAVAIL','OPCO','PERSONNEL') NOT NULL,
      identifiant_financeur   VARCHAR(50)    NULL COMMENT 'EDOF / FT / OPCO ref',
      nom_organisme           VARCHAR(100)   NULL COMMENT 'Nom OPCO si type=OPCO',
      date_accord             DATE           NULL COMMENT 'Date accord de financement',
      notes_financeur         TEXT           NULL,

      -- Montants (7b)
      montant_total           DECIMAL(10,2)  NOT NULL,
      montant_pris_en_charge  DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
      reste_a_charge          DECIMAL(10,2)  AS (montant_total - montant_pris_en_charge) STORED,

      -- Statut facturation (7b)
      statut_facturation      ENUM('a_facturer','facture','paye','litige','rembourse','annule') NULL,
      date_facturation        DATE           NULL,
      date_paiement           DATE           NULL,
      reference_facture       VARCHAR(50)    NULL,
      document_facture_id     INT UNSIGNED   NULL COMMENT 'FK vers documents_dossier (Lot 6)',

      -- Avoir (7b)
      montant_avoir           DECIMAL(10,2)  NULL,
      motif_avoir             TEXT           NULL,

      -- Notes comptables
      notes_comptables        TEXT           NULL,

      -- Validation bloc financier
      validated_at            DATETIME       NULL,
      validated_by            INT UNSIGNED   NULL,

      -- Audit
      created_at              DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at              DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by              INT UNSIGNED   NOT NULL,
      updated_by              INT UNSIGNED   NULL,

      UNIQUE KEY uq_financement_dossier (dossier_id),
      FOREIGN KEY (dossier_id)   REFERENCES dossiers(id) ON DELETE CASCADE,
      FOREIGN KEY (validated_by) REFERENCES users(id),
      FOREIGN KEY (created_by)   REFERENCES users(id),
      FOREIGN KEY (updated_by)   REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Lot 7 — Facturation & Financeurs'
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS financements');
};
