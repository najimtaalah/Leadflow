'use strict';

require('dotenv').config();

module.exports = {
  development: {
    client: 'mysql2',
    connection: {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT) || 3306,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset:  'utf8mb4',
    },
    migrations: {
      directory: './migrations',
      tableName:  'knex_migrations',
    },
  },

  production: {
    client: 'mysql2',
    connection: {
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT) || 3306,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset:  'utf8mb4',
      ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    migrations: {
      directory: './migrations',
      tableName:  'knex_migrations',
    },
  },

  test: {
    client: 'mysql2',
    connection: {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT) || 3306,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'leadflow_test',
      charset:  'utf8mb4',
    },
    migrations: {
      directory: './migrations',
      tableName:  'knex_migrations',
    },
  },
};
