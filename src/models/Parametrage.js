'use strict';

const db = require('../config/database');

const ParametrageModel = {

  // ══════════════════════════════════════════════════════════════
  // UC-45 — FORMATIONS
  // ══════════════════════════════════════════════════════════════

  async findAllFormations() {
    const [rows] = await db.query(
      `SELECT f.*,
         (SELECT COUNT(*) FROM sessions_formation s WHERE s.formation_id = f.id) AS nb_sessions,
         (SELECT COUNT(*) FROM dossiers d
          WHERE d.session_cours_id IN (SELECT id FROM sessions_formation WHERE formation_id = f.id)
             OR d.session_edof_id  IN (SELECT id FROM sessions_formation WHERE formation_id = f.id)
          ) AS nb_inscrits_actifs
       FROM formations f
       ORDER BY f.nom ASC`
    );
    return rows;
  },

  async findFormationById(id) {
    const [[row]] = await db.query(
      'SELECT * FROM formations WHERE id = ?', [id]
    );
    return row || null;
  },

  /**
   * Code formation = TYPE uniquement (3 lettres)
   * Ex: TAXI FULL → "TXF"  |  VTC PASSERELLE → "VTP"
   */
  computeCodeFormation(date_debut, type, format, lieu_code) {
    if (!type) return null;
    return type; // 3 lettres, sans lieu
  },

  /**
   * Code session : YYMM + TYPE(3) + J/S + LIEU(2)  → ex: 2603TXFJSD / 2603TXFSAY
   *              : YYMM + TYPE(3) + EL               → ex: 2603VTPEL
   * Le type (3 lettres) est extrait des 3 premiers caractères de code_formation.
   * Si doublon → ajoute suffixe 02, 03…
   */
  async computeCodeSession(date_debut, code_formation, format, lieu_code, moment) {
    const d    = new Date(date_debut);
    const yy   = String(d.getFullYear()).slice(2);
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const type3 = (code_formation || '').slice(0, 3); // ex: "VTF"
    const base  = format === 'D'
      ? `${yy}${mm}${type3}EL`
      : `${yy}${mm}${type3}${moment || 'J'}${lieu_code || ''}`;

    const [[{ cnt }]] = await db.query(
      'SELECT COUNT(*) AS cnt FROM sessions_formation WHERE code_session LIKE ?',
      [`${base}%`]
    );
    return cnt === 0 ? base : `${base}${String(cnt + 1).padStart(2, '0')}`;
  },

  async createFormation({ nom, description, duree_heures, cout_defaut, frais_cma_defaut,
                          config_pedagogique, date_debut, type, format, lieu_code }) {
    const CONFIG_VALIDES = ['theorie_seule', 'pratique_seule', 'theorie_et_pratique'];
    if (!CONFIG_VALIDES.includes(config_pedagogique)) {
      throw new Error(`config_pedagogique invalide. Valeurs : ${CONFIG_VALIDES.join(', ')}`);
    }

    // Code formation = 3 lettres du type (ex: TXF, VTP…)
    const code_formation = type ? ParametrageModel.computeCodeFormation(null, type, null, null) : null;

    const [result] = await db.query(
      `INSERT INTO formations
         (nom, description, duree_heures, cout_defaut, frais_cma_defaut,
          config_pedagogique, date_debut, type, format, lieu_code, code_formation,
          actif, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [nom, description || null, duree_heures || null,
       cout_defaut || null, frais_cma_defaut || null, config_pedagogique,
       date_debut || null, type || null, format || null, lieu_code || null, code_formation]
    );
    return result.insertId;
  },

  async updateFormation(id, fields) {
    // code_formation jamais modifié après création (règle de gestion)
    const allowed = ['nom', 'description', 'duree_heures', 'cout_defaut',
                     'frais_cma_defaut', 'config_pedagogique', 'actif'];
    const updates = []; const params = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); params.push(v); }
    }
    if (!updates.length) return false;
    params.push(id);
    await db.query(
      `UPDATE formations SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params
    );
    return true;
  },

  // ══════════════════════════════════════════════════════════════
  // UC-48 — SESSIONS DE FORMATION
  // ══════════════════════════════════════════════════════════════

  async findAllSessions({ formation_id, actif, type_session } = {}) {
    let sql = `
      SELECT s.*, f.nom AS formation_nom, f.config_pedagogique,
             (SELECT COUNT(*) FROM dossiers d
              WHERE d.session_cours_id = s.id
                 OR d.session_edof_id  = s.id
                 OR d.examen_id        = s.id) AS nb_inscrits
      FROM sessions_formation s
      JOIN formations f ON f.id = s.formation_id
      WHERE 1=1`;
    const params = [];
    if (formation_id)  { sql += ' AND s.formation_id = ?';   params.push(formation_id); }
    if (actif !== undefined) { sql += ' AND s.actif = ?';    params.push(actif ? 1 : 0); }
    if (type_session)  { sql += ' AND s.type_session = ?';   params.push(type_session); }
    sql += ' ORDER BY s.date_debut DESC';
    const [rows] = await db.query(sql, params);
    return rows;
  },

  async createSession({ formation_id, type_session, date_debut, date_fin, capacite_max, lieu, moment }) {
    // Récupérer la formation pour obtenir code_formation, format et lieu_code
    const [[formation]] = await db.query(
      'SELECT code_formation, format, lieu_code FROM formations WHERE id = ?', [formation_id]
    );
    if (!formation) throw new Error('Formation introuvable.');

    // Incrément automatique du numéro de session pour cette formation (suivi interne)
    const [[maxRow]] = await db.query(
      'SELECT COALESCE(MAX(numero_session), 0) AS max_num FROM sessions_formation WHERE formation_id = ?',
      [formation_id]
    );
    const numero_session = (maxRow.max_num || 0) + 1;

    // Code session : YYMM + Code + J/S + Lieu  ou  YYMM + Code + EL
    const codeFormation = formation.code_formation || `F${formation_id}`;
    const momentVal     = formation.format === 'D' ? null : (moment || 'J');
    const code_session  = await ParametrageModel.computeCodeSession(
      date_debut, codeFormation, formation.format, formation.lieu_code, momentVal
    );

    // Vérifier doublon (sécurité)
    const [[exist]] = await db.query(
      'SELECT id FROM sessions_formation WHERE code_session = ?', [code_session]
    );
    if (exist) throw new Error(`CODE_SESSION_EXISTS:${code_session}`);

    const typeVal = ['cours','edof','examen'].includes(type_session) ? type_session : 'cours';

    const [result] = await db.query(
      `INSERT INTO sessions_formation
         (formation_id, numero_session, code_session, type_session,
          date_debut, date_fin, capacite_max, lieu, moment, actif, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [formation_id, numero_session, code_session, typeVal,
       date_debut, date_fin, capacite_max || 30, lieu || null, momentVal]
    );
    return { id: result.insertId, code_session, numero_session };
  },

  async updateSession(id, fields) {
    const allowed = ['code_session', 'type_session', 'date_debut', 'date_fin', 'capacite_max', 'lieu', 'actif'];
    const updates = []; const params = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); params.push(v); }
    }
    if (!updates.length) return false;
    params.push(id);
    await db.query(
      `UPDATE sessions_formation SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params
    );
    return true;
  },

  async cloturerSession(id) {
    await db.query(
      "UPDATE sessions_formation SET actif = 0, updated_at = NOW() WHERE id = ?", [id]
    );
  },

  // ══════════════════════════════════════════════════════════════
  // UC-47 — AGENCES
  // ══════════════════════════════════════════════════════════════

  async findAllAgences({ actif } = {}) {
    let sql = `
      SELECT a.*,
        (SELECT COUNT(*) FROM users u WHERE u.agence_id = a.id AND u.actif = 1) AS nb_users,
        (SELECT COUNT(*) FROM dossiers d WHERE d.agence_id = a.id AND d.archived = 0) AS nb_dossiers
      FROM agences a WHERE 1=1`;
    const params = [];
    if (actif !== undefined) { sql += ' AND a.actif = ?'; params.push(actif ? 1 : 0); }
    sql += ' ORDER BY a.nom ASC';
    const [rows] = await db.query(sql, params);
    return rows;
  },

  async createAgence({ nom, ville, region, code }) {
    const [result] = await db.query(
      `INSERT INTO agences (nom, ville, region, code, actif, created_at)
       VALUES (?, ?, ?, ?, 1, NOW())`,
      [nom, ville || null, region || null, code || null]
    );
    return result.insertId;
  },

  async updateAgence(id, fields) {
    const allowed = ['nom', 'ville', 'region', 'code', 'actif'];
    const updates = []; const params = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); params.push(v); }
    }
    if (!updates.length) return false;
    params.push(id);
    await db.query(
      `UPDATE agences SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params
    );
    return true;
  },

  async findAgenceById(id) {
    const [[row]] = await db.query('SELECT * FROM agences WHERE id = ?', [id]);
    return row || null;
  },

  async getAgenceStats(id) {
    const [[stats]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE agence_id = ? AND actif = 1)   AS nb_users,
         (SELECT COUNT(*) FROM dossiers WHERE agence_id = ? AND archived = 0) AS nb_dossiers_actifs,
         (SELECT COUNT(*) FROM leads WHERE agence_id = ?)                  AS nb_leads_total
       FROM dual`,
      [id, id, id]
    );
    return stats;
  },

  // ══════════════════════════════════════════════════════════════
  // UC-46 — DISTRIBUTION DES LEADS
  // ══════════════════════════════════════════════════════════════

  async getDistributionConfig() {
    const [rows] = await db.query(
      `SELECT cd.*,
         a.nom AS agence_nom
       FROM config_distribution cd
       LEFT JOIN agences a ON a.id = cd.agence_id
       ORDER BY cd.agence_id IS NULL DESC, a.nom ASC`
    );
    return rows;
  },

  async updateDistributionConfig(id, fields) {
    const allowed = ['methode', 'agence_id', 'actif'];
    const updates = []; const params = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); params.push(v); }
    }
    if (!updates.length) return false;
    params.push(id);
    await db.query(
      `UPDATE config_distribution SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
    return true;
  },

  async getAgentLimites(agenceId = null) {
    let sql = `
      SELECT al.*, CONCAT(u.prenom,' ',u.nom) AS user_nom, u.agence_id
      FROM agent_limites al
      JOIN users u ON u.id = al.user_id
      WHERE 1=1`;
    const params = [];
    if (agenceId) { sql += ' AND u.agence_id = ?'; params.push(agenceId); }
    sql += ' ORDER BY u.prenom';
    const [rows] = await db.query(sql, params);
    return rows;
  },

  async upsertAgentLimite(userId, maxLeads) {
    await db.query(
      `INSERT INTO agent_limites (user_id, max_leads, created_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE max_leads = ?, updated_at = NOW()`,
      [userId, maxLeads, maxLeads]
    );
  },

  // ══════════════════════════════════════════════════════════════
  // UC-49 — CONFIGURATION IMPORTS
  // ══════════════════════════════════════════════════════════════

  async getConfigImports() {
    // Retourne la config depuis une table dédiée ou depuis rapports_config
    // En l'absence d'une table config_imports, on stocke dans la BDD comme JSON
    const [[row]] = await db.query(
      "SELECT params FROM rapports_config WHERE type = 'config_imports' ORDER BY id DESC LIMIT 1"
    ).catch(() => [[null]]);

    if (row?.params) {
      try { return JSON.parse(row.params); } catch { return null; }
    }
    // Valeurs par défaut
    return {
      gestion:  { colonne_cout: 'AU', colonne_financeur: 'AK', mode_defaut: 'mettre_a_jour' },
      edof:     { separateur_csv: ';', cle_upsert: 'NUMERO_DOSSIER', mode_defaut: 'upsert' },
    };
  },

  async saveConfigImports(config, userId) {
    await db.query(
      `INSERT INTO rapports_config (type, params, created_by, created_at)
       VALUES ('config_imports', ?, ?, NOW())`,
      [JSON.stringify(config), userId]
    );
  },

  async getHistoriqueImports(limit = 20) {
    const [rows] = await db.query(
      `SELECT * FROM imports_jobs ORDER BY created_at DESC LIMIT ?`, [limit]
    );
    return rows;
  },

  // ══════════════════════════════════════════════════════════════
  // UC-50 — MODÈLES DE MESSAGES SMS/EMAIL
  // ══════════════════════════════════════════════════════════════

  async findAllModeles({ actif } = {}) {
    let sql = 'SELECT * FROM sms_modeles WHERE 1=1';
    const params = [];
    if (actif !== undefined) { sql += ' AND actif = ?'; params.push(actif ? 1 : 0); }
    sql += ' ORDER BY type ASC';
    const [rows] = await db.query(sql, params);
    return rows;
  },

  async findModeleById(id) {
    const [[row]] = await db.query('SELECT * FROM sms_modeles WHERE id = ?', [id]);
    return row || null;
  },

  async createModele({ type, nom, sujet_email, contenu_email, contenu_sms }) {
    const [result] = await db.query(
      `INSERT INTO sms_modeles
         (type, nom, sujet_email, contenu_email, contenu_sms, actif, created_at)
       VALUES (?, ?, ?, ?, ?, 1, NOW())`,
      [type, nom, sujet_email || null, contenu_email || null, contenu_sms || null]
    );
    return result.insertId;
  },

  async updateModele(id, fields) {
    const allowed = ['nom', 'sujet_email', 'contenu_email', 'contenu_sms', 'actif'];
    const updates = []; const params = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); params.push(v); }
    }
    if (!updates.length) return false;
    params.push(id);
    await db.query(
      `UPDATE sms_modeles SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params
    );
    return true;
  },

  /**
   * Valide les variables d'un modèle (UC-50)
   * Variables autorisées : {NOM}, {PRENOM}, {FORMATION}, {DATE}, {EPREUVE}, {NOTE}
   */
  validateVariables(contenu) {
    if (!contenu) return { ok: true, variables: [] };
    const VARIABLES_AUTORISEES = new Set([
      'NOM','PRENOM','FORMATION','DATE','EPREUVE','NOTE','AGENCE'
    ]);
    const found = [...contenu.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
    const inconnues = found.filter(v => !VARIABLES_AUTORISEES.has(v));
    return {
      ok:         inconnues.length === 0,
      variables:  found,
      inconnues,
    };
  },
};

module.exports = ParametrageModel;
