'use strict';

require('dotenv').config();

const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const morgan   = require('morgan');
const path     = require('path');
const logger   = require('./utils/logger');
const { globalLimiter } = require('./middleware/rateLimiter');

const app = express();

// ── Fichiers statiques (frontend React buildé) ────────────────────────────────
// En production : `cd frontend && npm run build` génère les fichiers dans public/dist/
const DIST_DIR = path.join(__dirname, '../public/dist');
app.use(express.static(DIST_DIR));

// ── Sécurité ────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ── Rate limiting global ─────────────────────────────────────────────────────
app.use('/api/', globalLimiter);

// ── Parsing ──────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logs HTTP ────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/leads',    require('./routes/leads'));
app.use('/api/dossiers',  require('./routes/dossiers'));
app.use('/api/pedagogie', require('./routes/pedagogie'));
app.use('/api/finance',   require('./routes/finance'));
app.use('/api/agenda',       require('./routes/agenda'));
app.use('/api/commissions',  require('./routes/commissions'));
app.use('/api/reporting',    require('./routes/reporting'));
app.use('/api/parametrage',  require('./routes/parametrage'));
app.use('/api/imports',      require('./routes/imports'));
app.use('/api/prelevements', require('./routes/prelevements'));
app.use('/api/agent',       require('./routes/agent'));
app.use('/api/taches',      require('./routes/taches'));
app.use('/api/apprenants',  require('./routes/apprenants'));
app.use('/api/predossiers', require('./routes/predossiers'));
app.use('/api/facturation', require('./routes/facturation'));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ── SPA Fallback (React Router) ───────────────────────────────────────────────
// Toutes les routes non-API renvoient index.html pour que React Router gère la navigation
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
    return next();
  }
  res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
    if (err) next(); // fichier non trouvé → passer au 404
  });
});

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    code:    'NOT_FOUND',
    message: `Route ${req.method} ${req.path} introuvable.`,
  });
});

// ── Gestionnaire d'erreurs global ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Erreur non gérée', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    code:    'SERVER_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'Erreur interne du serveur.'
      : err.message,
  });
});

module.exports = app;
