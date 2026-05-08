'use strict';

const PDFDocument = require('pdfkit');

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function header(doc, title, subtitle) {
  doc
    .fontSize(18).font('Helvetica-Bold').text('France Conseil & Formations', { align: 'center' })
    .fontSize(11).font('Helvetica').fillColor('#555')
    .text('Organisme de formation certifié Qualiopi', { align: 'center' })
    .moveDown(0.4)
    .fontSize(16).font('Helvetica-Bold').fillColor('#1a1a1a')
    .text(title, { align: 'center' })
    .moveDown(0.2);
  if (subtitle) {
    doc.fontSize(11).font('Helvetica').fillColor('#555').text(subtitle, { align: 'center' });
  }
  doc
    .moveDown(0.8)
    .moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').lineWidth(1).stroke()
    .moveDown(0.8)
    .fillColor('#1a1a1a');
}

function kv(doc, label, value) {
  doc.font('Helvetica-Bold').fontSize(10).text(`${label} :`, { continued: true, width: 200 })
     .font('Helvetica').text(` ${value || '—'}`);
}

function tableHeader(doc, cols, y) {
  doc.save().rect(50, y, 495, 18).fillColor('#e8e8e8').fill().restore();
  let x = 50;
  cols.forEach(({ label, width }) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a1a1a')
       .text(label, x + 3, y + 4, { width: width - 6, ellipsis: true });
    x += width;
  });
  return y + 18;
}

// ── Feuille d'émargement ──────────────────────────────────────────────────────

function generateFeuilleEmargement({ session, apprenants, dates }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    header(
      doc,
      'Feuille d\'émargement',
      `Session ${session.code_session} — ${session.formation_nom}`
    );

    kv(doc, 'Dates de formation', `${formatDate(session.date_debut)} au ${formatDate(session.date_fin)}`);
    kv(doc, 'Lieu', session.lieu || '—');
    kv(doc, 'Document généré le', formatDate(new Date()));
    doc.moveDown(0.8);

    // Colonnes : Apprenant + une colonne par date de séance
    const NOM_W = 160;
    const DATE_W = Math.min(70, Math.floor(335 / Math.max(dates.length, 1)));
    const cols = [
      { label: 'Apprenant', width: NOM_W },
      ...dates.map(d => ({ label: formatDate(d), width: DATE_W })),
    ];

    let y = doc.y;
    y = tableHeader(doc, cols, y);

    apprenants.forEach((apprenant, idx) => {
      const rowH = 22;
      if (y + rowH > 760) {
        doc.addPage();
        y = 50;
        y = tableHeader(doc, cols, y);
      }
      if (idx % 2 === 0) {
        doc.save().rect(50, y, 495, rowH).fillColor('#f9f9f9').fill().restore();
      }
      doc.font('Helvetica').fontSize(9).fillColor('#1a1a1a')
         .text(`${apprenant.nom} ${apprenant.prenom}`, 53, y + 6, { width: NOM_W - 6 });

      let x = 50 + NOM_W;
      dates.forEach(d => {
        const eDateStr = new Date(d).toISOString().slice(0, 10);
        const em = (apprenant.emargements || []).find(e => e.date_seance?.slice(0, 10) === eDateStr);
        const label = em?.present ? '✓' : (em?.motif_absence ? 'A' : '');
        doc.text(label, x + DATE_W / 2 - 5, y + 6, { width: DATE_W });
        x += DATE_W;
      });
      y += rowH;
    });

    doc.moveDown(2);
    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#777')
       .text('✓ = Présent   A = Absent (motif renseigné)', 50);

    doc.end();
  });
}

// ── Attestation de fin de formation ──────────────────────────────────────────

function generateAttestation({ dossier, session, formation }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    header(doc, 'Attestation de fin de formation');

    doc.font('Helvetica').fontSize(12)
       .text('Nous soussignés, France Conseil & Formations, certifions que :')
       .moveDown(1);

    doc.fontSize(16).font('Helvetica-Bold').text(
      `${(dossier.prenom || '').toUpperCase()} ${(dossier.nom || '').toUpperCase()}`,
      { align: 'center' }
    ).moveDown(0.5);

    doc.font('Helvetica').fontSize(12)
       .text('a suivi et validé la formation :', { align: 'center' })
       .moveDown(0.5)
       .fontSize(14).font('Helvetica-Bold')
       .text(formation.nom || session.formation_nom, { align: 'center' })
       .moveDown(1);

    doc.font('Helvetica').fontSize(11);
    kv(doc, 'Durée', formation.duree_heures ? `${formation.duree_heures} heures` : '—');
    kv(doc, 'Session', session.code_session);
    kv(doc, 'Dates', `du ${formatDate(session.date_debut)} au ${formatDate(session.date_fin)}`);
    kv(doc, 'Lieu', session.lieu || '—');

    doc.moveDown(2)
       .font('Helvetica').fontSize(11)
       .text('Fait pour valoir ce que de droit.', { align: 'right' })
       .moveDown(0.5)
       .text(`Le ${formatDate(new Date())}`, { align: 'right' })
       .moveDown(2)
       .text('Signature et cachet :')
       .moveDown(2)
       .moveTo(350, doc.y).lineTo(545, doc.y).strokeColor('#333').lineWidth(1).stroke();

    doc.end();
  });
}

// ── Convention de formation ───────────────────────────────────────────────────

function generateConvention({ dossier, session, formation }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    header(doc, 'Convention de formation professionnelle',
      `Article L.6353-1 du Code du Travail`);

    doc.font('Helvetica-Bold').fontSize(12).text('ENTRE LES SOUSSIGNÉS :').moveDown(0.5);
    doc.font('Helvetica').fontSize(11);
    kv(doc, 'Organisme de formation', 'France Conseil & Formations');
    kv(doc, 'N° de déclaration d\'activité', '—');
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(11).text('ET :').moveDown(0.3);
    doc.font('Helvetica').fontSize(11);
    kv(doc, 'Stagiaire', `${dossier.prenom} ${dossier.nom}`);
    kv(doc, 'Email', dossier.email || '—');
    kv(doc, 'Téléphone', dossier.telephone || '—');

    doc.moveDown(1)
       .font('Helvetica-Bold').fontSize(12).text('IL A ÉTÉ CONVENU CE QUI SUIT :')
       .moveDown(0.5);

    doc.font('Helvetica').fontSize(11);
    kv(doc, 'Intitulé de la formation', formation.nom || session.formation_nom);
    kv(doc, 'Durée totale', formation.duree_heures ? `${formation.duree_heures} heures` : '—');
    kv(doc, 'Session', session.code_session);
    kv(doc, 'Date de début', formatDate(session.date_debut));
    kv(doc, 'Date de fin', formatDate(session.date_fin));
    kv(doc, 'Lieu', session.lieu || '—');
    kv(doc, 'Prix de la formation', dossier.cout_total_formation ? `${dossier.cout_total_formation} €` : '—');

    doc.moveDown(2)
       .font('Helvetica-Oblique').fontSize(10).fillColor('#555')
       .text('La présente convention est établie en deux exemplaires originaux.')
       .moveDown(1.5)
       .fillColor('#1a1a1a').font('Helvetica').fontSize(11);

    doc.text(`Fait le ${formatDate(new Date())}`)
       .moveDown(2);

    const sigY = doc.y;
    doc.text('Pour l\'organisme de formation :', 50, sigY)
       .text('Le stagiaire :', 300, sigY)
       .moveDown(2.5)
       .moveTo(50, doc.y).lineTo(200, doc.y).strokeColor('#333').lineWidth(1).stroke()
       .moveTo(300, doc.y).lineTo(450, doc.y).stroke();

    doc.end();
  });
}

// ── Convocation ───────────────────────────────────────────────────────────────

function generateConvocation({ dossier, session, formation }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    header(doc, 'Convocation', `Formation : ${formation.nom || session.formation_nom}`);

    doc.font('Helvetica').fontSize(12)
       .text(`${dossier.prenom} ${dossier.nom},`)
       .moveDown(0.5)
       .text('Nous avons le plaisir de vous convoquer à la formation ci-dessous :')
       .moveDown(1);

    doc.fontSize(11);
    kv(doc, 'Formation', formation.nom || session.formation_nom);
    kv(doc, 'Session', session.code_session);
    kv(doc, 'Début', formatDate(session.date_debut));
    kv(doc, 'Fin', formatDate(session.date_fin));
    kv(doc, 'Lieu', session.lieu || 'À préciser');
    kv(doc, 'Durée', formation.duree_heures ? `${formation.duree_heures} heures` : '—');

    doc.moveDown(1.5)
       .font('Helvetica').fontSize(11)
       .text('Merci de vous présenter 15 minutes avant le début de la session.')
       .moveDown(0.5)
       .text('En cas d\'empêchement, merci de nous contacter dans les meilleurs délais.')
       .moveDown(2)
       .text(`Le ${formatDate(new Date())}`, { align: 'right' })
       .moveDown(1)
       .text('France Conseil & Formations', { align: 'right' });

    doc.end();
  });
}

module.exports = {
  generateFeuilleEmargement,
  generateAttestation,
  generateConvention,
  generateConvocation,
};
