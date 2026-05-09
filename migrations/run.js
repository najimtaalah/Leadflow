#!/usr/bin/env node
'use strict';

/**
 * Exécute la migration Lot 0 de manière idempotente.
 * Vérifie information_schema avant chaque ALTER TABLE.
 */

require('dotenv').config();
const mysql2 = require('mysql2/promise');
const fs     = require('fs');
const path   = require('path');

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  return rows[0].cnt > 0;
}

async function indexExists(conn, table, indexName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, indexName]
  );
  return rows[0].cnt > 0;
}

async function main() {
  const conn = await mysql2.createConnection({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  console.log('==> Connexion DB OK');

  // ── 1. Tables nouvelles (CREATE TABLE IF NOT EXISTS) ─────────────────────
  const ddlPath = path.join(__dirname, '001_lot0_entities.sql');
  const ddl = fs.readFileSync(ddlPath, 'utf8');
  await conn.query(ddl);
  console.log('==> Tables apprenants / pre_dossiers / journal_dossier créées (ou déjà existantes)');

  // ── 2. ALTER TABLE leads ─────────────────────────────────────────────────
  if (!(await columnExists(conn, 'leads', 'badge_pre_dossier'))) {
    await conn.query(
      `ALTER TABLE leads ADD COLUMN badge_pre_dossier TINYINT(1) NOT NULL DEFAULT 0
       COMMENT 'Indique qu un pre-dossier a été créé depuis ce lead'`
    );
    console.log('  + leads.badge_pre_dossier');
  } else { console.log('  ~ leads.badge_pre_dossier déjà présent'); }

  // ── 3. ALTER TABLE dossiers ──────────────────────────────────────────────
  const dossierCols = [
    { col: 'apprenant_id',      ddl: `ADD COLUMN apprenant_id INT UNSIGNED NULL COMMENT 'Apprenant rattaché au dossier' AFTER lead_id` },
    { col: 'id_lead_origine',   ddl: `ADD COLUMN id_lead_origine INT UNSIGNED NULL COMMENT 'Lead d origine' AFTER apprenant_id` },
    { col: 'type_financement',  ddl: `ADD COLUMN type_financement ENUM('cpf','opco','perso','employeur','autre') NULL` },
    { col: 'reference_financeur', ddl: `ADD COLUMN reference_financeur VARCHAR(100) NULL COMMENT 'Référence dossier chez le financeur'` },
    { col: 'numero_cma',        ddl: `ADD COLUMN numero_cma VARCHAR(50) NULL COMMENT 'Numéro CMA'` },
  ];
  for (const { col, ddl } of dossierCols) {
    if (!(await columnExists(conn, 'dossiers', col))) {
      await conn.query(`ALTER TABLE dossiers ${ddl}`);
      console.log(`  + dossiers.${col}`);
    } else { console.log(`  ~ dossiers.${col} déjà présent`); }
  }

  // FK dossiers → apprenants
  if (!(await indexExists(conn, 'dossiers', 'fk_dossiers_apprenant'))) {
    await conn.query(
      `ALTER TABLE dossiers ADD CONSTRAINT fk_dossiers_apprenant
       FOREIGN KEY (apprenant_id) REFERENCES apprenants(id)`
    );
    console.log('  + FK dossiers.apprenant_id');
  }
  // FK dossiers → leads (id_lead_origine)
  if (!(await indexExists(conn, 'dossiers', 'fk_dossiers_lead_origine'))) {
    await conn.query(
      `ALTER TABLE dossiers ADD CONSTRAINT fk_dossiers_lead_origine
       FOREIGN KEY (id_lead_origine) REFERENCES leads(id)`
    );
    console.log('  + FK dossiers.id_lead_origine');
  }

  // ── 4. sessions_formation — type_session étendu ───────────────────────────
  const [[col]] = await conn.query(
    `SELECT COLUMN_TYPE FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'sessions_formation'
       AND column_name = 'type_session'`
  );
  if (col && !col.COLUMN_TYPE.includes('theorie')) {
    await conn.query(
      `ALTER TABLE sessions_formation
       MODIFY COLUMN type_session
         ENUM('cours','edof','examen','theorie','pratique')
         NOT NULL DEFAULT 'cours'
       COMMENT 'Type discriminant de la session'`
    );
    console.log('  + sessions_formation.type_session étendu (theorie/pratique)');
  } else { console.log('  ~ sessions_formation.type_session déjà étendu'); }

  console.log('==> Migration Lot 0 terminée.');
  await conn.end();
}

main().catch(err => {
  console.error('ERREUR migration :', err.message);
  process.exit(1);
});
