'use strict';

/**
 * Middleware de parsing fichiers import (xlsx, csv)
 * Injecte req.parsedRows avec les lignes parsées
 *
 * Dépendances à installer : npm install multer xlsx
 */

const path   = require('path');
const logger = require('../utils/logger');

// Parsing inline sans multer pour les tests (données JSON directes)
// En production, utiliser multer + xlsx

/**
 * Middleware pour import Gestion (.xlsx)
 * Accepte soit un fichier multipart/form-data soit req.body.rows (JSON pour tests)
 */
function parseXlsx(req, res, next) {
  // Mode test : données JSON directement dans req.body.rows
  if (req.body && Array.isArray(req.body.rows)) {
    req.parsedRows = req.body.rows;
    return next();
  }

  // Mode production : parsing du fichier uploadé via multer
  // (multer middleware à ajouter en amont dans la route)
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Fichier .xlsx requis (champ "file") ou tableau rows[] en JSON.',
    });
  }

  try {
    const XLSX = require('xlsx');
    const workbook  = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet     = workbook.Sheets[sheetName];
    const rows      = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'Fichier vide.' });
    }

    req.parsedRows = rows;
    logger.info('Fichier xlsx parsé', { rows: rows.length, sheet: sheetName });
    next();
  } catch (err) {
    logger.error('Erreur parsing xlsx', { error: err.message });
    return res.status(400).json({ success: false, message: 'Fichier xlsx invalide.' });
  }
}

/**
 * Middleware pour import EDOF (.csv ou .xls)
 * Séparateur CSV prioritaire : ';'
 */
function parseCSV(req, res, next) {
  if (req.body && Array.isArray(req.body.rows)) {
    req.parsedRows = req.body.rows;
    return next();
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Fichier .csv/.xls requis (champ "file") ou tableau rows[] en JSON.',
    });
  }

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === '.csv') {
      const content = req.file.buffer.toString('utf-8');
      const lines   = content.split('\n').filter(l => l.trim());
      if (!lines.length) {
        return res.status(400).json({ success: false, message: 'Fichier CSV vide.' });
      }

      // Détection séparateur : ';' prioritaire (UC-16)
      const firstLine = lines[0];
      const sep = firstLine.includes(';') ? ';' : ',';
      const headers = firstLine.split(sep).map(h => h.trim().replace(/"/g, ''));

      const rows = lines.slice(1).map(line => {
        const vals = line.split(sep).map(v => v.trim().replace(/"/g, ''));
        const obj  = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
        return obj;
      });

      req.parsedRows = rows;
    } else {
      // .xls via xlsx
      const XLSX     = require('xlsx');
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      req.parsedRows = XLSX.utils.sheet_to_json(
        workbook.Sheets[workbook.SheetNames[0]], { defval: '' }
      );
    }

    logger.info('Fichier EDOF parsé', { rows: req.parsedRows.length, ext });
    next();
  } catch (err) {
    logger.error('Erreur parsing EDOF', { error: err.message });
    return res.status(400).json({ success: false, message: 'Fichier EDOF invalide.' });
  }
}

module.exports = { parseXlsx, parseCSV };
