'use strict';

const XLSX      = require('xlsx');
const multer    = require('multer');
const path      = require('path');
const db        = require('../config/database');
const ImportModel = require('../models/Import');
const logger    = require('../utils/logger');

// ── Multer config ──────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Accepté : xlsx, xls, csv'));
    }
  },
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Convert column letter(s) to 0-based index: A→0, B→1, Z→25, AA→26 */
function colLetterToIndex(letter) {
  if (!letter) return -1;
  const s = String(letter).toUpperCase().trim();
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    n = n * 26 + (s.charCodeAt(i) - 64);
  }
  return n - 1;
}

/** Parse a file buffer into an array-of-arrays (first row = headers) */
function parseFileToRows(file) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ext === '.csv') {
    const text = file.buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    // Auto-detect separator: prefer ';' if more occurrences in first line
    const firstLine = lines[0] || '';
    const sep = (firstLine.split(';').length >= firstLine.split(',').length) ? ';' : ',';
    return lines.map((line) => line.split(sep));
  }

  // xlsx / xls
  const wb = XLSX.read(file.buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

/** Get statut_id for 'Actif' (or first statut found) */
async function getStatutActifId() {
  try {
    const [[row]] = await db.query(
      "SELECT id FROM statuts_dossier WHERE nom = 'Actif' LIMIT 1"
    );
    if (row) return row.id;
    const [[first]] = await db.query('SELECT id FROM statuts_dossier LIMIT 1');
    return first ? first.id : null;
  } catch {
    return null;
  }
}

/** Ensure historique_imports table exists */
async function ensureHistoriqueTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS historique_imports (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      type         VARCHAR(20)  NOT NULL,
      fichier      VARCHAR(255),
      nb_lignes    INT          DEFAULT 0,
      nb_importes  INT          DEFAULT 0,
      nb_maj       INT          DEFAULT 0,
      nb_erreurs   INT          DEFAULT 0,
      user_id      INT,
      created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

/** Save import to historique_imports (uses existing imports_jobs if available) */
async function saveHistorique({ type, fichier, nb_lignes, nb_importes, nb_maj, nb_erreurs, user_id }) {
  try {
    // Try historique_imports first
    await ensureHistoriqueTable();
    await db.query(
      `INSERT INTO historique_imports (type, fichier, nb_lignes, nb_importes, nb_maj, nb_erreurs, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [type, fichier, nb_lignes, nb_importes, nb_maj || 0, nb_erreurs, user_id]
    );
  } catch (err) {
    // Fall back to imports_jobs model if table creation failed
    try {
      const jobId = await ImportModel.createJob({
        type,
        mode: 'upsert',
        fichier_nom: fichier,
        user_id,
      });
      await ImportModel.updateJob(jobId, {
        nb_lus: nb_lignes,
        nb_crees: nb_importes,
        nb_maj: nb_maj || 0,
        nb_rejetes: nb_erreurs,
        statut: 'termine',
      });
    } catch (e2) {
      logger.error('[ImportsController] Erreur sauvegarde historique', { error: e2.message });
    }
  }
}

// ── Controller ─────────────────────────────────────────────────────────────────

const ImportsController = {

  upload,

  // ── POST /api/imports/preview ──────────────────────────────────────────────
  async previewFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Aucun fichier fourni.' });
      }

      const rows = parseFileToRows(req.file);

      if (!rows.length) {
        return res.status(400).json({ success: false, message: 'Fichier vide.' });
      }

      const colonnes = rows[0].map((c) => String(c));
      const apercu   = rows.slice(1, 6).map((r) => r.map((c) => String(c)));

      return res.json({
        success: true,
        data: {
          colonnes,
          apercu,
          total_lignes: Math.max(0, rows.length - 1),
        },
      });
    } catch (err) {
      logger.error('[ImportsController] previewFile', { error: err.message });
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // ── POST /api/imports/gestion ──────────────────────────────────────────────
  async importGestion(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Aucun fichier fourni.' });
      }

      // mapping: { nom: 'A', prenom: 'B', ... }  — values are column letters
      const mapping    = req.body.mapping ? JSON.parse(req.body.mapping) : {};
      const mode       = req.body.mode || 'upsert'; // creer_seulement | mettre_a_jour | upsert
      const agence_id  = req.body.agence_id ? parseInt(req.body.agence_id) : null;

      const rows = parseFileToRows(req.file);
      if (rows.length <= 1) {
        return res.status(400).json({ success: false, message: 'Fichier vide ou sans données.' });
      }

      const dataRows = rows.slice(1); // skip header

      const statut_id = await getStatutActifId();

      const stats = { importes: 0, mis_a_jour: 0, ignores: 0, erreurs: [] };

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        try {
          // Extract each field using column-letter → index mapping
          function cellVal(fieldName) {
            const letter = mapping[fieldName];
            if (!letter) return null;
            const idx = colLetterToIndex(letter);
            if (idx < 0 || idx >= row.length) return null;
            return String(row[idx] || '').trim() || null;
          }

          const nom               = cellVal('nom');
          const prenom            = cellVal('prenom');
          const telephone         = cellVal('telephone');
          const email             = cellVal('email');
          const formation         = cellVal('formation_souhaitee');
          const reference         = cellVal('reference');
          const cout_raw          = cellVal('cout_total_formation');
          const part_raw          = cellVal('part_financeur');
          const frais_raw         = cellVal('frais_cma');

          const cout_total_formation = cout_raw  ? parseFloat(cout_raw.replace(',', '.'))  || null : null;
          const part_financeur       = part_raw  ? parseFloat(part_raw.replace(',', '.'))  || null : null;
          const frais_cma            = frais_raw ? parseFloat(frais_raw.replace(',', '.')) || null : null;

          if (!nom && !telephone) {
            stats.ignores++;
            continue;
          }

          // Check existence by reference or telephone
          let existingId = null;
          if (reference) {
            const [[found]] = await db.query('SELECT id FROM dossiers WHERE reference = ?', [reference]);
            if (found) existingId = found.id;
          }
          if (!existingId && telephone) {
            const [[found]] = await db.query('SELECT id FROM dossiers WHERE telephone = ?', [telephone]);
            if (found) existingId = found.id;
          }

          if (existingId) {
            if (mode === 'creer_seulement') {
              stats.ignores++;
              continue;
            }
            // Update
            const sets = ['updated_at = NOW()'];
            const vals = [];
            if (nom)                     { sets.push('nom = ?');                     vals.push(nom); }
            if (prenom)                  { sets.push('prenom = ?');                  vals.push(prenom); }
            if (telephone)               { sets.push('telephone = ?');               vals.push(telephone); }
            if (email)                   { sets.push('email = ?');                   vals.push(email); }
            if (formation)               { sets.push('formation_souhaitee = ?');     vals.push(formation); }
            if (reference)               { sets.push('reference = ?');              vals.push(reference); }
            if (cout_total_formation !== null) { sets.push('cout_total_formation = ?'); vals.push(cout_total_formation); }
            if (part_financeur !== null)       { sets.push('part_financeur = ?');       vals.push(part_financeur); }
            if (frais_cma !== null)            { sets.push('frais_cma = ?');             vals.push(frais_cma); }
            vals.push(existingId);
            await db.query(`UPDATE dossiers SET ${sets.join(', ')} WHERE id = ?`, vals);
            stats.mis_a_jour++;
          } else {
            if (mode === 'mettre_a_jour') {
              stats.ignores++;
              continue;
            }
            // Insert
            await db.query(
              `INSERT INTO dossiers
                 (nom, prenom, telephone, email, formation_souhaitee, reference,
                  cout_total_formation, part_financeur, frais_cma, statut_id,
                  agence_id, frais_cma_paye, archived, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW(), NOW())`,
              [
                nom || '', prenom || '', telephone || '', email || '',
                formation || '', reference || '',
                cout_total_formation, part_financeur, frais_cma,
                statut_id, agence_id,
              ]
            );
            stats.importes++;
          }
        } catch (err) {
          stats.erreurs.push({ ligne: i + 2, message: err.message });
        }
      }

      // Save historique
      await saveHistorique({
        type:        'gestion',
        fichier:     req.file.originalname,
        nb_lignes:   dataRows.length,
        nb_importes: stats.importes,
        nb_maj:      stats.mis_a_jour,
        nb_erreurs:  stats.erreurs.length,
        user_id:     req.user?.id,
      });

      return res.json({ success: true, data: stats });
    } catch (err) {
      logger.error('[ImportsController] importGestion', { error: err.message });
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // ── POST /api/imports/edof ────────────────────────────────────────────────
  async importEdof(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Aucun fichier fourni.' });
      }

      // Optional column mapping override; defaults to standard EDOF column names
      const mappingRaw = req.body.mapping ? JSON.parse(req.body.mapping) : null;
      const mode       = req.body.mode || 'upsert';

      const rows = parseFileToRows(req.file);
      if (rows.length <= 1) {
        return res.status(400).json({ success: false, message: 'Fichier vide ou sans données.' });
      }

      // Build header→index map from first row
      const headers = rows[0].map((h) => String(h).trim().toUpperCase());
      const headerIdx = {};
      headers.forEach((h, i) => { headerIdx[h] = i; });

      const dataRows  = rows.slice(1);
      const statut_id = await getStatutActifId();

      // Standard EDOF column aliases
      const EDOF_MAP = {
        numero_dossier:       ['NUMERO_DOSSIER', 'NUMERO DOSSIER', 'N° DOSSIER', 'NDOSSIER'],
        nom:                  ['NOM', 'NOM_STAGIAIRE'],
        prenom:               ['PRENOM', 'PRENOM_STAGIAIRE', 'PRÉNOM'],
        telephone:            ['TELEPHONE', 'TEL', 'TÉLÉPHONE'],
        email:                ['EMAIL', 'MAIL', 'E-MAIL'],
        formation_souhaitee:  ['INTITULE_FORMATION', 'FORMATION', 'INTITULE FORMATION', 'INTITULÉ FORMATION'],
        cout_total_formation: ['COUT_FORMATION', 'COUT FORMATION', 'COÛT FORMATION', 'MONTANT_FORMATION'],
        part_financeur:       ['MONTANT_EDOF', 'PART_FINANCEUR', 'PART FINANCEUR'],
      };

      function getVal(row, fieldName) {
        // Check if mapping override provided (column letters)
        if (mappingRaw && mappingRaw[fieldName]) {
          const idx = colLetterToIndex(mappingRaw[fieldName]);
          return String(row[idx] || '').trim() || null;
        }
        // Use header name lookup
        const aliases = EDOF_MAP[fieldName] || [];
        for (const alias of aliases) {
          if (headerIdx[alias] !== undefined) {
            const val = String(row[headerIdx[alias]] || '').trim();
            return val || null;
          }
        }
        return null;
      }

      const stats = { importes: 0, mis_a_jour: 0, liens_leads: 0, ignores: 0, erreurs: [] };

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        try {
          const numero   = getVal(row, 'numero_dossier');
          const nom      = getVal(row, 'nom');
          const prenom   = getVal(row, 'prenom');
          const tel      = getVal(row, 'telephone');
          const email    = getVal(row, 'email')?.toLowerCase() || null;
          const formation = getVal(row, 'formation_souhaitee');
          const coutRaw  = getVal(row, 'cout_total_formation');
          const partRaw  = getVal(row, 'part_financeur');

          const cout_total_formation = coutRaw ? parseFloat(coutRaw.replace(',', '.')) || null : null;
          const part_financeur       = partRaw ? parseFloat(partRaw.replace(',', '.')) || null : null;

          if (!numero) {
            stats.ignores++;
            continue;
          }

          // ── Étape 1 : dossier existant ? ──────────────────────────────────
          const [[existing]] = await db.query(
            'SELECT id, lead_id FROM dossiers WHERE numero_dossier_edof = ? OR reference = ? LIMIT 1',
            [numero, numero]
          );

          let dossierId;

          if (existing) {
            if (mode === 'creer_seulement') {
              stats.ignores++;
              continue;
            }
            const sets = ['numero_dossier_edof = ?', 'reference = ?', 'updated_at = NOW()'];
            const vals = [numero, numero];
            if (nom)                           { sets.push('nom = ?');                      vals.push(nom); }
            if (prenom)                        { sets.push('prenom = ?');                   vals.push(prenom); }
            if (tel)                           { sets.push('telephone = ?');                vals.push(tel); }
            if (email)                         { sets.push('email = ?');                    vals.push(email); }
            if (formation)                     { sets.push('formation_souhaitee = ?');      vals.push(formation); }
            if (cout_total_formation !== null)  { sets.push('cout_total_formation = ?');    vals.push(cout_total_formation); }
            if (part_financeur !== null)        { sets.push('part_financeur = ?');          vals.push(part_financeur); }
            vals.push(existing.id);
            await db.query(`UPDATE dossiers SET ${sets.join(', ')} WHERE id = ?`, vals);
            dossierId = existing.id;
            stats.mis_a_jour++;
          } else {
            if (mode === 'mettre_a_jour') {
              stats.ignores++;
              continue;
            }
            const [ins] = await db.query(
              `INSERT INTO dossiers
                 (numero_dossier_edof, reference, nom, prenom, telephone, email,
                  formation_souhaitee, cout_total_formation, part_financeur,
                  statut_id, frais_cma_paye, archived, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW(), NOW())`,
              [
                numero, numero, nom || '', prenom || '', tel || '',
                email || '', formation || '',
                cout_total_formation, part_financeur, statut_id,
              ]
            );
            dossierId = ins.insertId;
            stats.importes++;
          }

          // ── Étape 2 : lier au lead correspondant (email OU téléphone) ─────
          // Skip if already linked
          if (existing?.lead_id) continue;

          let leadId = null;
          if (email) {
            const [[byEmail]] = await db.query(
              'SELECT id FROM leads WHERE email = ? LIMIT 1', [email]
            );
            if (byEmail) leadId = byEmail.id;
          }
          if (!leadId && tel) {
            const [[byTel]] = await db.query(
              'SELECT id FROM leads WHERE telephone = ? LIMIT 1', [tel]
            );
            if (byTel) leadId = byTel.id;
          }
          if (leadId) {
            await db.query(
              'UPDATE dossiers SET lead_id = ?, updated_at = NOW() WHERE id = ?',
              [leadId, dossierId]
            );
            stats.liens_leads++;
          }

        } catch (err) {
          stats.erreurs.push({ ligne: i + 2, message: err.message });
        }
      }

      await saveHistorique({
        type:        'edof',
        fichier:     req.file.originalname,
        nb_lignes:   dataRows.length,
        nb_importes: stats.importes,
        nb_maj:      stats.mis_a_jour,
        nb_erreurs:  stats.erreurs.length,
        user_id:     req.user?.id,
      });

      return res.json({ success: true, data: stats });
    } catch (err) {
      logger.error('[ImportsController] importEdof', { error: err.message });
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // ── GET /api/imports/historique ────────────────────────────────────────────
  async getHistorique(req, res) {
    try {
      // Try historique_imports first
      try {
        await ensureHistoriqueTable();
        const [rows] = await db.query(`
          SELECT h.*, CONCAT(u.prenom, ' ', u.nom) AS importe_par
          FROM historique_imports h
          LEFT JOIN users u ON u.id = h.user_id
          ORDER BY h.created_at DESC
          LIMIT 20
        `);
        return res.json({ success: true, data: rows });
      } catch {
        // Fall back to imports_jobs
        const rows = await ImportModel.findAll({ limit: 20 });
        return res.json({ success: true, data: rows });
      }
    } catch (err) {
      logger.error('[ImportsController] getHistorique', { error: err.message });
      // Return empty rather than error
      return res.json({ success: true, data: [] });
    }
  },
};

module.exports = ImportsController;
