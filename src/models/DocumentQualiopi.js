'use strict';

const db = require('../config/database');

const DocumentQualiopiModel = {

  async findByDossier(dossierId) {
    const [rows] = await db.query(
      `SELECT dq.id, dq.dossier_id, dq.session_id, dq.type_document,
              dq.titre, dq.chemin_fichier, dq.genere_at, dq.archived,
              CONCAT(u.prenom,' ',u.nom) AS genere_par_nom,
              sf.code_session
       FROM documents_qualiopi dq
       LEFT JOIN users u             ON u.id  = dq.genere_par
       LEFT JOIN sessions_formation sf ON sf.id = dq.session_id
       WHERE dq.dossier_id = ? AND dq.archived = 0
       ORDER BY dq.genere_at DESC`,
      [dossierId]
    );
    return rows;
  },

  async findById(id) {
    const [[row]] = await db.query(
      `SELECT dq.*, CONCAT(u.prenom,' ',u.nom) AS genere_par_nom
       FROM documents_qualiopi dq
       LEFT JOIN users u ON u.id = dq.genere_par
       WHERE dq.id = ?`,
      [id]
    );
    return row || null;
  },

  async create({ dossier_id, session_id, type_document, titre, chemin_fichier, genere_par }) {
    const [result] = await db.query(
      `INSERT INTO documents_qualiopi
         (dossier_id, session_id, type_document, titre, chemin_fichier, genere_par, genere_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [dossier_id, session_id || null, type_document, titre, chemin_fichier || null, genere_par || null]
    );
    return result.insertId;
  },

  async archive(id) {
    await db.query('UPDATE documents_qualiopi SET archived = 1 WHERE id = ?', [id]);
  },

  async findBySession(sessionId, typeDocument) {
    let sql = `
      SELECT dq.*, d.nom AS apprenant_nom, d.prenom AS apprenant_prenom
      FROM documents_qualiopi dq
      JOIN dossiers d ON d.id = dq.dossier_id
      WHERE dq.session_id = ? AND dq.archived = 0`;
    const params = [sessionId];
    if (typeDocument) { sql += ' AND dq.type_document = ?'; params.push(typeDocument); }
    sql += ' ORDER BY d.nom, d.prenom';
    const [rows] = await db.query(sql, params);
    return rows;
  },
};

module.exports = DocumentQualiopiModel;
