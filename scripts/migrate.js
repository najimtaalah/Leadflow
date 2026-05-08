#!/usr/bin/env node
'use strict';

/**
 * Outil de migration DB — LeadFlow CRM
 *
 * Usage :
 *   node scripts/migrate.js              → applique les migrations en attente
 *   node scripts/migrate.js --status     → affiche l'état des migrations
 *   node scripts/migrate.js --rollback   → annule la dernière migration (si .down.sql existe)
 *
 * Prérequis : variables .env DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 */

require('dotenv').config();

const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function getConnection() {
  return mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
    timezone: '+00:00',
    charset:  'utf8mb4',
  });
}

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      filename   VARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function getApplied(conn) {
  const [rows] = await conn.query('SELECT filename FROM schema_migrations ORDER BY filename');
  return new Set(rows.map(r => r.filename));
}

function getMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();
}

async function runMigrations(conn) {
  const applied = await getApplied(conn);
  const files   = getMigrationFiles();
  const pending = files.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('✅ Aucune migration en attente.');
    return;
  }

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`⏳ Application de ${file}…`);
    try {
      await conn.query(sql);
      await conn.query(
        'INSERT INTO schema_migrations (filename) VALUES (?)',
        [file]
      );
      console.log(`✅ ${file} appliquée.`);
    } catch (err) {
      console.error(`❌ Erreur sur ${file} : ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\n✅ ${pending.length} migration(s) appliquée(s).`);
}

async function showStatus(conn) {
  const applied = await getApplied(conn);
  const files   = getMigrationFiles();

  console.log('\nÉtat des migrations :\n');
  for (const file of files) {
    const status = applied.has(file) ? '✅ appliquée' : '⏳ en attente';
    console.log(`  ${status}  ${file}`);
  }
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  const conn = await getConnection();

  try {
    await ensureMigrationsTable(conn);

    if (args.includes('--status')) {
      await showStatus(conn);
    } else {
      await runMigrations(conn);
    }
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('Erreur migration :', err.message);
  process.exit(1);
});
