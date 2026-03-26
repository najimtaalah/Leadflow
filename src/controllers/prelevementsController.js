'use strict';

const db          = require('../config/database');
const LogModel    = require('../models/Log');
const logger      = require('../utils/logger');
const sepaService = require('../services/sepaService');

/**
 * Ajoute les colonnes SEPA à dossiers si elles n'existent pas encore
 */
async function ensureSepaColumns() {
  const cols = [
    `ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS iban              VARCHAR(34)  NULL`,
    `ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS bic               VARCHAR(11)  NULL`,
    `ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS mandat_ref        VARCHAR(60)  NULL`,
    `ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS mandat_date       DATE         NULL`,
    `ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS prelevement_actif TINYINT(1)   NOT NULL DEFAULT 0`,
    `ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS provider_customer_id  VARCHAR(100) NULL`,
    `ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS provider_mandate_id   VARCHAR(100) NULL`,
  ];
  for (const sql of cols) {
    try { await db.query(sql); } catch (_) { /* colonne déjà présente */ }
  }
  // Table log prélèvements
  await db.query(`
    CREATE TABLE IF NOT EXISTS prelevements_log (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      echeance_id   INT UNSIGNED NOT NULL,
      dossier_id    INT UNSIGNED NOT NULL,
      montant       DECIMAL(10,2) NOT NULL,
      mode          VARCHAR(20)  NOT NULL DEFAULT 'simulation',
      provider_ref  VARCHAR(100) NULL,
      statut        ENUM('succes','echec','en_cours') NOT NULL DEFAULT 'en_cours',
      message       TEXT NULL,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dossier_id) REFERENCES dossiers(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});
}

/* ── initialisation au démarrage ── */
ensureSepaColumns().catch(err => logger.warn('ensureSepaColumns', { err: err.message }));

/* ──────────────────────────────────────────────────────────
   GET /api/prelevements/status
   Retourne le mode actif + les stats des prélèvements
   ────────────────────────────────────────────────────────── */
async function getStatus(req, res) {
  try {
    const mode = sepaService.getMode();

    const [[stats]] = await db.query(`
      SELECT
        COUNT(*)                                                   AS total_echeances_auto,
        SUM(e.statut = 'en_attente' AND e.date_echeance <= CURDATE()) AS dues_aujourd_hui,
        SUM(e.statut = 'en_attente')                              AS en_attente,
        SUM(e.statut = 'payee')                                   AS payees
      FROM echeances e
      JOIN dossiers d ON d.id = e.dossier_id
      WHERE e.prelevement_auto = 1 AND d.prelevement_actif = 1
    `).catch(() => [[{ total_echeances_auto: 0, dues_aujourd_hui: 0, en_attente: 0, payees: 0 }]]);

    const [[logStats]] = await db.query(`
      SELECT
        COUNT(*) AS total_traites,
        SUM(statut='succes') AS succes,
        SUM(statut='echec')  AS echecs
      FROM prelevements_log
      WHERE DATE(created_at) = CURDATE()
    `).catch(() => [[{ total_traites: 0, succes: 0, echecs: 0 }]]);

    return res.json({
      success: true,
      data: {
        mode,
        mode_label: { simulation: 'Mode simulation', gocardless: 'GoCardless SEPA', stripe: 'Stripe SEPA Debit' }[mode] || mode,
        is_simulation: mode === 'simulation',
        configuration: {
          gocardless: !!process.env.GOCARDLESS_ACCESS_TOKEN,
          stripe:     !!process.env.STRIPE_SECRET_KEY,
        },
        stats: { ...stats, ...logStats },
      },
    });
  } catch (err) {
    logger.error('getStatus prelevements', { err: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

/* ──────────────────────────────────────────────────────────
   GET /api/prelevements/echeances-dues
   Liste les échéances à prélever (dues + prelevement_auto=1)
   ────────────────────────────────────────────────────────── */
async function getEcheancesDues(req, res) {
  try {
    const { date_limite, tous } = req.query;
    const limitDate = date_limite || new Date().toISOString().split('T')[0];

    const [rows] = await db.query(`
      SELECT
        e.id            AS echeance_id,
        e.dossier_id,
        e.montant,
        e.date_echeance,
        e.statut,
        e.prelevement_auto,
        d.nom,
        d.prenom,
        d.email,
        d.telephone,
        d.reference,
        d.iban,
        d.bic,
        d.mandat_ref,
        d.mandat_date,
        d.prelevement_actif,
        d.provider_mandate_id,
        d.provider_customer_id,
        (SELECT pl.statut FROM prelevements_log pl WHERE pl.echeance_id = e.id ORDER BY pl.id DESC LIMIT 1) AS dernier_statut_prel,
        (SELECT pl.provider_ref FROM prelevements_log pl WHERE pl.echeance_id = e.id ORDER BY pl.id DESC LIMIT 1) AS dernier_ref_prel
      FROM echeances e
      JOIN dossiers d ON d.id = e.dossier_id
      WHERE e.prelevement_auto = 1
        AND d.prelevement_actif = 1
        AND e.statut = 'en_attente'
        ${tous ? '' : `AND e.date_echeance <= '${limitDate}'`}
      ORDER BY e.date_echeance ASC
    `);

    return res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    logger.error('getEcheancesDues', { err: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

/* ──────────────────────────────────────────────────────────
   POST /api/prelevements/lancer/:echeanceId
   Traite UN prélèvement
   ────────────────────────────────────────────────────────── */
async function lancerPrelevement(req, res) {
  const echeanceId = parseInt(req.params.echeanceId);
  try {
    // Récupérer l'échéance + dossier
    const [[row]] = await db.query(`
      SELECT e.*, d.nom, d.prenom, d.email, d.iban, d.bic,
             d.mandat_ref, d.provider_mandate_id, d.provider_customer_id, d.prelevement_actif
      FROM echeances e
      JOIN dossiers d ON d.id = e.dossier_id
      WHERE e.id = ?
    `, [echeanceId]);

    if (!row) return res.status(404).json({ success: false, message: 'Échéance introuvable.' });
    if (row.statut === 'payee') return res.status(409).json({ success: false, message: 'Échéance déjà payée.' });
    if (!row.prelevement_actif) return res.status(409).json({ success: false, message: 'Prélèvement non activé pour ce dossier.' });
    if (!row.iban && sepaService.getMode() !== 'simulation') {
      return res.status(400).json({ success: false, message: 'IBAN manquant.' });
    }

    // Enregistrer en cours
    const [logRes] = await db.query(
      `INSERT INTO prelevements_log (echeance_id, dossier_id, montant, mode, statut) VALUES (?, ?, ?, ?, 'en_cours')`,
      [echeanceId, row.dossier_id, row.montant, sepaService.getMode()]
    );
    const logId = logRes.insertId;

    // Lancer le prélèvement
    const result = await sepaService.processPrelevement({ dossier: row, echeance: row });

    if (result.success) {
      // Créer l'encaissement correspondant
      await db.query(
        `INSERT INTO encaissements_paiement
           (dossier_id, montant, date_encaissement, mode_paiement, notes, created_by, created_at)
         VALUES (?, ?, CURDATE(), 'prelevement', ?, ?, NOW())`,
        [row.dossier_id, row.montant,
         `Prélèvement SEPA automatique — ${result.provider_ref || 'simulation'} — Éch. ${row.date_echeance}`,
         req.user.id]
      ).catch(() => {
        // Fallback si encaissements_paiement n'existe pas
        db.query(
          `INSERT INTO encaissements (dossier_id, montant, date_encaissement, mode_paiement, notes, created_by, created_at)
           VALUES (?, ?, CURDATE(), 'prelevement', ?, ?, NOW())`,
          [row.dossier_id, row.montant,
           `Prélèvement SEPA — ${result.provider_ref || 'simulation'}`,
           req.user.id]
        ).catch(() => {});
      });

      // Marquer l'échéance comme payée
      await db.query(
        `UPDATE echeances SET statut = 'payee', updated_at = NOW() WHERE id = ?`,
        [echeanceId]
      );

      // Mettre à jour le log
      await db.query(
        `UPDATE prelevements_log SET statut = 'succes', provider_ref = ?, message = ? WHERE id = ?`,
        [result.provider_ref || '', result.message, logId]
      );

      await LogModel.create({
        action: 'prelevement_succes', user_id: req.user.id,
        details: { echeance_id: echeanceId, montant: row.montant, provider_ref: result.provider_ref, mode: result.mode },
        ip_address: req.ip,
      });

      return res.json({
        success: true,
        message: result.message,
        data:    { provider_ref: result.provider_ref, mode: result.mode, montant: row.montant },
      });

    } else {
      await db.query(
        `UPDATE prelevements_log SET statut = 'echec', message = ? WHERE id = ?`,
        [result.message, logId]
      );
      return res.status(422).json({ success: false, message: result.message, mode: result.mode });
    }

  } catch (err) {
    logger.error('lancerPrelevement', { err: err.message, echeanceId });
    return res.status(500).json({ success: false, message: err.message || 'Erreur serveur.' });
  }
}

/* ──────────────────────────────────────────────────────────
   POST /api/prelevements/lancer-tous
   Traite TOUS les prélèvements dus aujourd'hui
   ────────────────────────────────────────────────────────── */
async function lancerTous(req, res) {
  try {
    const [echeances] = await db.query(`
      SELECT e.id AS echeance_id
      FROM echeances e
      JOIN dossiers d ON d.id = e.dossier_id
      WHERE e.prelevement_auto = 1
        AND d.prelevement_actif = 1
        AND e.statut = 'en_attente'
        AND e.date_echeance <= CURDATE()
    `);

    if (echeances.length === 0) {
      return res.json({ success: true, message: 'Aucun prélèvement à traiter aujourd\'hui.', data: { traites: 0, succes: 0, echecs: 0 } });
    }

    let succes = 0, echecs = 0;
    const details = [];

    for (const { echeance_id } of echeances) {
      try {
        // Réutiliser la logique de lancerPrelevement en interne
        const [[row]] = await db.query(`
          SELECT e.*, d.nom, d.prenom, d.email, d.iban, d.bic,
                 d.mandat_ref, d.provider_mandate_id, d.provider_customer_id
          FROM echeances e JOIN dossiers d ON d.id = e.dossier_id
          WHERE e.id = ?`, [echeance_id]);

        if (!row || row.statut === 'payee') continue;

        const result = await sepaService.processPrelevement({ dossier: row, echeance: row });

        if (result.success) {
          await db.query(`UPDATE echeances SET statut='payee', updated_at=NOW() WHERE id=?`, [echeance_id]);
          await db.query(
            `INSERT INTO prelevements_log (echeance_id, dossier_id, montant, mode, statut, provider_ref, message)
             VALUES (?, ?, ?, ?, 'succes', ?, ?)`,
            [echeance_id, row.dossier_id, row.montant, result.mode, result.provider_ref || '', result.message]
          );
          succes++;
          details.push({ echeance_id, statut: 'succes', montant: row.montant, ref: result.provider_ref });
        } else {
          await db.query(
            `INSERT INTO prelevements_log (echeance_id, dossier_id, montant, mode, statut, message)
             VALUES (?, ?, ?, ?, 'echec', ?)`,
            [echeance_id, row.dossier_id, row.montant, result.mode, result.message]
          );
          echecs++;
          details.push({ echeance_id, statut: 'echec', montant: row.montant, message: result.message });
        }
      } catch (err) {
        echecs++;
        details.push({ echeance_id, statut: 'echec', message: err.message });
      }
    }

    await LogModel.create({
      action: 'prelevements_batch', user_id: req.user.id,
      details: { traites: echeances.length, succes, echecs },
      ip_address: req.ip,
    });

    return res.json({
      success: true,
      message: `${echeances.length} prélèvement(s) traités — ${succes} succès, ${echecs} échec(s)`,
      data: { traites: echeances.length, succes, echecs, details },
    });

  } catch (err) {
    logger.error('lancerTous', { err: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

/* ──────────────────────────────────────────────────────────
   GET /api/prelevements/log
   Historique des prélèvements
   ────────────────────────────────────────────────────────── */
async function getLog(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const [rows] = await db.query(`
      SELECT pl.*, d.nom, d.prenom, d.reference, e.date_echeance
      FROM prelevements_log pl
      JOIN dossiers d  ON d.id  = pl.dossier_id
      JOIN echeances e ON e.id  = pl.echeance_id
      ORDER BY pl.created_at DESC
      LIMIT ?
    `, [limit]).catch(() => [[]]);

    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

/* ──────────────────────────────────────────────────────────
   PATCH /api/prelevements/dossiers/:dossierId/sepa
   Configure l'IBAN + crée le mandat pour un dossier
   ────────────────────────────────────────────────────────── */
async function configurerSepa(req, res) {
  const dossierId = parseInt(req.params.dossierId);
  const { iban, bic, prelevement_actif } = req.body;

  try {
    if (!iban) return res.status(400).json({ success: false, message: 'IBAN requis.' });

    const ibanClean = iban.replace(/\s/g, '').toUpperCase();
    if (!sepaService.validateIBAN(ibanClean)) {
      return res.status(400).json({ success: false, message: 'IBAN invalide.' });
    }

    // Récupérer le dossier
    const [[dossier]] = await db.query(`SELECT * FROM dossiers WHERE id = ?`, [dossierId]);
    if (!dossier) return res.status(404).json({ success: false, message: 'Dossier introuvable.' });

    let mandatInfo = {
      mandat_ref:  dossier.mandat_ref,
      mandat_date: dossier.mandat_date,
      provider_customer_id: dossier.provider_customer_id,
      provider_mandate_id:  dossier.provider_mandate_id,
    };

    // Créer un nouveau mandat si IBAN change ou pas encore de mandat
    const ibanChanged = ibanClean !== (dossier.iban || '').replace(/\s/g, '');
    if (!mandatInfo.mandat_ref || ibanChanged) {
      mandatInfo = await sepaService.createMandat({ ...dossier, iban: ibanClean, bic });
    }

    await db.query(`
      UPDATE dossiers SET
        iban                 = ?,
        bic                  = ?,
        mandat_ref           = ?,
        mandat_date          = ?,
        provider_customer_id = ?,
        provider_mandate_id  = ?,
        prelevement_actif    = ?,
        updated_at           = NOW()
      WHERE id = ?
    `, [
      ibanClean, bic || null,
      mandatInfo.mandat_ref, mandatInfo.mandat_date,
      mandatInfo.provider_customer_id || null,
      mandatInfo.provider_mandate_id  || null,
      prelevement_actif !== false ? 1 : 0,
      dossierId,
    ]);

    await LogModel.create({
      action: 'sepa_configure', user_id: req.user.id,
      details: { dossier_id: dossierId, iban: ibanClean.slice(0, 4) + '****', mandat_ref: mandatInfo.mandat_ref },
      ip_address: req.ip,
    });

    return res.json({
      success: true,
      message: `Prélèvement SEPA configuré (${sepaService.getMode()}).`,
      data: {
        mandat_ref:  mandatInfo.mandat_ref,
        mandat_date: mandatInfo.mandat_date,
        mode:        sepaService.getMode(),
        note:        mandatInfo.note || null,
      },
    });

  } catch (err) {
    logger.error('configurerSepa', { err: err.message, dossierId });
    return res.status(500).json({ success: false, message: err.message || 'Erreur serveur.' });
  }
}

module.exports = { getStatus, getEcheancesDues, lancerPrelevement, lancerTous, getLog, configurerSepa };
