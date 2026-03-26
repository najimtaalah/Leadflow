'use strict';

const db     = require('../config/database');
const logger = require('../utils/logger');

const ImportService = {

  /**
   * Import Gestion (.xlsx) — colonnes AU + AK
   * UC-16 : 3 modes : remplacer | ajouter | mettre_a_jour
   */
  async processGestion(rows, mode, userId) {
    const rapport = { type: 'gestion', mode, lues: rows.length,
                      crees: 0, mises_a_jour: 0, rejetees: 0, rejets: [] };

    if (mode === 'remplacer') {
      await db.query('DELETE FROM dossiers WHERE lead_id IS NULL AND archived = 0');
    }

    for (let i = 0; i < rows.length; i++) {
      try {
        const row       = rows[i];
        const cout_total = parseFloat(row['AU'] || row['cout_total_formation'] || 0) || null;
        const part_fin   = parseFloat(row['AK'] || row['part_financeur'] || 0)       || null;
        const nom        = (row['NOM']       || row['nom']       || '').trim();
        const prenom     = (row['PRENOM']    || row['prenom']    || '').trim();
        const telephone  = (row['TELEPHONE'] || row['telephone'] || '').trim();
        const ref        = (row['REFERENCE'] || row['reference'] || '').trim();

        if (!nom || !telephone) throw new Error('NOM et TELEPHONE requis');

        let existing = null;
        if (ref) {
          const [[f]] = await db.query('SELECT id FROM dossiers WHERE reference = ?', [ref]);
          existing = f;
        }
        if (!existing) {
          const [[f]] = await db.query('SELECT id FROM dossiers WHERE telephone = ?', [telephone]);
          existing = f;
        }

        if (existing) {
          if (mode === 'ajouter') throw new Error('Dossier existant ignoré (mode AJOUTER)');
          await db.query(
            'UPDATE dossiers SET cout_total_formation=?, part_financeur=?, updated_at=NOW() WHERE id=?',
            [cout_total, part_fin, existing.id]
          );
          rapport.mises_a_jour++;
        } else {
          if (mode === 'mettre_a_jour') throw new Error('Dossier introuvable (mode MAJ uniquement)');
          await db.query(
            `INSERT INTO dossiers (nom, prenom, telephone, cout_total_formation, part_financeur,
               frais_cma_paye, archived, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 0, 0, NOW(), NOW())`,
            [nom, prenom, telephone, cout_total, part_fin]
          );
          rapport.crees++;
        }
      } catch (err) {
        rapport.rejetees++;
        rapport.rejets.push({ ligne: i + 1, raison: err.message });
      }
    }

    await this._saveJob(rapport, userId);
    return rapport;
  },

  /**
   * Import EDOF (.xls / .csv)
   * Clé upsert : NUMERO_DOSSIER — séparateur CSV prioritaire : ';'
   * UC-16 : modes upsert | ajouter
   *
   * Logique cross-check :
   *   1. Chercher dossier par numero_dossier_edof
   *      → existe  : mettre à jour (CPF + champs)
   *      → n'existe pas : créer le dossier
   *   2. Chercher lead par email OU téléphone
   *      → trouvé  : lier dossier.lead_id = lead.id
   *      → introuvable : dossier sans lien lead (normal)
   */
  async processEDOF(rows, mode, userId) {
    const rapport = { type: 'edof', mode, lues: rows.length,
                      crees: 0, mises_a_jour: 0, liens_leads: 0, rejetees: 0, rejets: [] };

    for (let i = 0; i < rows.length; i++) {
      try {
        const row       = rows[i];
        const numero    = (row['NUMERO_DOSSIER']    || row['numero_dossier']    || '').trim();
        const nom       = (row['NOM']               || row['nom']               || '').trim();
        const prenom    = (row['PRENOM']            || row['prenom']            || '').trim();
        const tel       = (row['TELEPHONE']         || row['telephone']         || '').trim();
        const email     = (row['EMAIL']             || row['email']             || '').trim().toLowerCase() || null;
        const formation = (row['FORMATION']         || row['formation']         || row['INTITULE'] || '').trim() || null;
        const cpf       = parseFloat(row['MONTANT_CPF'] || row['montant_cpf'] || row['MONTANT'] || 0) || null;

        if (!numero) throw new Error('NUMERO_DOSSIER requis (clé upsert)');

        // ── Étape 1 : dossier existant ? ─────────────────────────────────────
        const [[existing]] = await db.query(
          'SELECT id, lead_id FROM dossiers WHERE numero_dossier_edof = ?', [numero]
        );

        let dossierId;

        if (existing) {
          if (mode === 'ajouter') throw new Error(`NUMERO_DOSSIER ${numero} existe déjà`);

          const sets = ['updated_at = NOW()'];
          const vals = [];
          if (cpf  !== null)     { sets.push('part_financeur = ?');         vals.push(cpf); }
          if (nom)               { sets.push('nom = ?');                     vals.push(nom); }
          if (prenom)            { sets.push('prenom = ?');                  vals.push(prenom); }
          if (tel)               { sets.push('telephone = ?');               vals.push(tel); }
          if (email)             { sets.push('email = ?');                   vals.push(email); }
          if (formation)         { sets.push('formation_souhaitee = ?');     vals.push(formation); }
          vals.push(existing.id);
          await db.query(`UPDATE dossiers SET ${sets.join(', ')} WHERE id = ?`, vals);
          dossierId = existing.id;
          rapport.mises_a_jour++;
        } else {
          if (!nom || !tel) throw new Error('NOM et TELEPHONE requis pour la création');

          // Générer une référence DOS-YYYY-NNNN
          const year   = new Date().getFullYear();
          const prefix = `DOS-${year}-`;
          const [[lastRef]] = await db.query(
            `SELECT MAX(CAST(SUBSTRING(reference, ?) AS UNSIGNED)) AS last_num
             FROM dossiers WHERE reference LIKE ?`,
            [prefix.length + 1, `${prefix}%`]
          );
          const nextNum = (lastRef.last_num || 0) + 1;
          const reference = `${prefix}${String(nextNum).padStart(4, '0')}`;

          const [ins] = await db.query(
            `INSERT INTO dossiers
               (reference, numero_dossier_edof, nom, prenom, telephone, email,
                formation_souhaitee, part_financeur,
                frais_cma_paye, archived, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW(), NOW())`,
            [reference, numero, nom, prenom, tel, email, formation, cpf]
          );
          dossierId = ins.insertId;
          rapport.crees++;
        }

        // ── Étape 2 : chercher un lead correspondant (email OU téléphone) ────
        if (existing?.lead_id) {
          // Déjà lié, pas besoin de rechercher
          continue;
        }

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
          rapport.liens_leads++;
        }

      } catch (err) {
        rapport.rejetees++;
        rapport.rejets.push({ ligne: i + 1, raison: err.message });
      }
    }

    await this._saveJob(rapport, userId);
    return rapport;
  },

  async _saveJob(rapport, userId) {
    try {
      const [res] = await db.query(
        `INSERT INTO imports_jobs (type, mode, lignes_lues, lignes_crees,
           lignes_mises_a_jour, lignes_rejetees, user_id, statut, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'termine', NOW())`,
        [rapport.type, rapport.mode, rapport.lues,
         rapport.crees, rapport.mises_a_jour, rapport.rejetees, userId]
      );
      if (rapport.rejets.length) {
        for (const r of rapport.rejets) {
          await db.query(
            'INSERT INTO imports_rejets (job_id, ligne, raison, created_at) VALUES (?, ?, ?, NOW())',
            [res.insertId, r.ligne, r.raison]
          );
        }
      }
    } catch (err) {
      logger.error('Erreur sauvegarde import job', { error: err.message });
    }
  },

  async getHistory(limit = 20) {
    const [rows] = await db.query(
      `SELECT ij.*, CONCAT(u.prenom,' ',u.nom) AS importe_par
       FROM imports_jobs ij LEFT JOIN users u ON u.id = ij.user_id
       ORDER BY ij.created_at DESC LIMIT ?`,
      [limit]
    );
    return rows;
  },
};

module.exports = ImportService;
