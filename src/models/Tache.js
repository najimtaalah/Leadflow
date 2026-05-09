'use strict';

const db = require('../config/database');

const TACHE_TITRES = {
  affecter_session_edof:  'Affecter session EDOF',
  affecter_session_cours: 'Affecter session cours',
  affecter_examen:        'Affecter session examen',
  creation_espace_cma:    'Créer espace CMA',
  depot_dossier_cma:      'Déposer dossier CMA',
  paiement_examen_cma:    "Paiement frais d'examen",
};

const TACHES_PAR_DOSSIER = [
  'affecter_session_edof',
  'affecter_session_cours',
  'affecter_examen',
  'creation_espace_cma',
  'depot_dossier_cma',
  'paiement_examen_cma',
];

const TacheModel = {

  /** Génère les tâches standard pour un nouveau dossier */
  async createForDossier(dossierId) {
    const rows = TACHES_PAR_DOSSIER.map(type => [
      dossierId, type, TACHE_TITRES[type], 'en_attente',
    ]);
    for (const [did, type, titre, statut] of rows) {
      // Check si déjà existante (idempotence)
      const [[ex]] = await db.query(
        'SELECT id FROM taches WHERE dossier_id = ? AND type = ?', [did, type]
      );
      if (!ex) {
        await db.query(
          `INSERT INTO taches (dossier_id, type, titre, statut, created_at, updated_at)
           VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [did, type, titre, statut]
        );
      }
    }
  },

  /** Liste des tâches (filtrée selon le rôle) */
  async findAll({ dossier_id, statut, assigned_to, agence_id, vendeur_id, limit = 100, offset = 0 } = {}) {
    let where = 'WHERE 1=1';
    const params = [];

    if (dossier_id)   { where += ' AND t.dossier_id = ?';    params.push(dossier_id); }
    if (statut)       { where += ' AND t.statut = ?';         params.push(statut); }
    if (assigned_to)  { where += ' AND t.assigned_to = ?';    params.push(assigned_to); }
    if (agence_id)    { where += ' AND d.agence_id = ?';      params.push(agence_id); }
    if (vendeur_id)   { where += ' AND d.vendeur_id = ?';     params.push(vendeur_id); }

    const [rows] = await db.query(`
      SELECT
        t.*,
        d.nom AS dossier_nom, d.prenom AS dossier_prenom, d.reference,
        CONCAT(u.prenom,' ',u.nom) AS assigned_nom
      FROM taches t
      LEFT JOIN dossiers d ON d.id = t.dossier_id
      LEFT JOIN users u    ON u.id = t.assigned_to
      ${where}
      ORDER BY t.created_at ASC
      LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM taches t LEFT JOIN dossiers d ON d.id = t.dossier_id ${where}`,
      params
    );

    return { taches: rows, total };
  },

  /** Met à jour le statut / champs d'une tâche */
  async update(id, { statut, assigned_to, notes }) {
    await ensureTable();
    const sets = ['updated_at = NOW()'];
    const vals = [];
    if (statut      !== undefined) { sets.push('statut = ?');       vals.push(statut); }
    if (assigned_to !== undefined) { sets.push('assigned_to = ?');  vals.push(assigned_to); }
    if (notes       !== undefined) { sets.push('notes = ?');         vals.push(notes); }
    vals.push(id);
    await db.query(`UPDATE taches SET ${sets.join(', ')} WHERE id = ?`, vals);
  },
};

module.exports = TacheModel;
