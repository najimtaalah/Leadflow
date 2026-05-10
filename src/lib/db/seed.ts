import { v4 as uuidv4 } from 'uuid';
import { getDb } from './index';

export function seedIfEmpty(): void {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n;
  if (count > 0) return;

  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();
  const tomorrow = new Date(Date.now() + 86400000).toISOString();

  // Users
  const users = [
    { id: 'u-commercial-1', prenom: 'Thomas', nom: 'Durand', email: 'thomas@leadflow.fr', role: 'commercial' },
    { id: 'u-commercial-2', prenom: 'Léa', nom: 'Bernard', email: 'lea@leadflow.fr', role: 'commercial' },
    { id: 'u-closer-1', prenom: 'Marc', nom: 'Petit', email: 'marc@leadflow.fr', role: 'closer_habilite' },
    { id: 'u-gestionnaire-1', prenom: 'Sophie', nom: 'Martin', email: 'sophie@leadflow.fr', role: 'gestionnaire' },
    { id: 'u-admin-1', prenom: 'Paul', nom: 'Leclerc', email: 'paul@leadflow.fr', role: 'admin' },
    { id: 'u-superadmin-1', prenom: 'Alice', nom: 'Moreau', email: 'alice@leadflow.fr', role: 'super_admin' },
  ];

  const insertUser = db.prepare(
    'INSERT INTO users (id, prenom, nom, email, role, created_at) VALUES (?,?,?,?,?,?)'
  );
  for (const u of users) {
    insertUser.run(u.id, u.prenom, u.nom, u.email, u.role, now);
  }

  // Leads
  const leads = [
    { id: 'l-1', commercial_id: 'u-commercial-1', prenom: 'Karim', nom: 'Benali', email: 'karim@test.fr', telephone: '0612345678', source: 'formulaire_web', formation_visee: 'VTC', statut: 'en_cours', badge_pre_dossier: 0, notes: null, date_creation: lastWeek, updated_at: yesterday },
    { id: 'l-2', commercial_id: 'u-commercial-1', prenom: 'Fatima', nom: 'Zidane', email: 'fatima@test.fr', telephone: '0623456789', source: 'telephone', formation_visee: 'Taxi', statut: 'qualifie', badge_pre_dossier: 0, notes: 'Intéressée par formation accélérée', date_creation: lastWeek, updated_at: now },
    { id: 'l-3', commercial_id: 'u-commercial-1', prenom: 'Jean', nom: 'Dupont', email: 'jean@test.fr', telephone: '0634567890', source: 'recommandation', formation_visee: 'VTC', statut: 'nouveau', badge_pre_dossier: 0, notes: null, date_creation: now, updated_at: now },
    { id: 'l-4', commercial_id: 'u-commercial-2', prenom: 'Marie', nom: 'Curie', email: 'marie@test.fr', telephone: '0645678901', source: 'formulaire_web', formation_visee: 'Taxi', statut: 'en_cours', badge_pre_dossier: 1, notes: null, date_creation: lastWeek, updated_at: yesterday },
    { id: 'l-5', commercial_id: 'u-commercial-2', prenom: 'Ahmed', nom: 'Hassan', email: 'ahmed@test.fr', telephone: '0656789012', source: 'autre', formation_visee: 'VMDTR', statut: 'perdu', badge_pre_dossier: 0, notes: 'Pas disponible avant 6 mois', date_creation: lastWeek, updated_at: lastWeek },
    { id: 'l-6', commercial_id: 'u-commercial-1', prenom: 'Nadia', nom: 'Rezig', email: 'nadia@test.fr', telephone: '0667890123', source: 'telephone', formation_visee: 'VTC', statut: 'gagne', badge_pre_dossier: 1, notes: null, date_creation: lastWeek, updated_at: yesterday },
  ];

  const insertLead = db.prepare(
    'INSERT INTO leads (id, commercial_id, prenom, nom, email, telephone, source, formation_visee, statut, badge_pre_dossier, notes, date_creation, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  for (const l of leads) {
    insertLead.run(l.id, l.commercial_id, l.prenom, l.nom, l.email, l.telephone, l.source, l.formation_visee, l.statut, l.badge_pre_dossier, l.notes, l.date_creation, l.updated_at);
  }

  // Commissions
  const commissions = [
    { id: uuidv4(), lead_id: 'l-1', commercial_id: 'u-commercial-1', montant: 800, statut: 'libre', date_figement: null },
    { id: uuidv4(), lead_id: 'l-6', commercial_id: 'u-commercial-1', montant: 1200, statut: 'figee', date_figement: yesterday },
    { id: uuidv4(), lead_id: 'l-4', commercial_id: 'u-commercial-2', montant: 950, statut: 'libre', date_figement: null },
  ];
  const insertComm = db.prepare(
    'INSERT INTO commissions (id, lead_id, commercial_id, montant, statut, date_figement, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)'
  );
  for (const c of commissions) {
    insertComm.run(c.id, c.lead_id, c.commercial_id, c.montant, c.statut, c.date_figement, now, now);
  }

  // Relances
  const relances = [
    { id: uuidv4(), lead_id: 'l-1', commercial_id: 'u-commercial-1', type: 'appel', date_prevue: tomorrow, statut: 'a_faire', notes: 'Rappeler pour devis' },
    { id: uuidv4(), lead_id: 'l-2', commercial_id: 'u-commercial-1', type: 'email', date_prevue: yesterday, statut: 'en_retard', notes: null },
    { id: uuidv4(), lead_id: 'l-3', commercial_id: 'u-commercial-1', type: 'rdv', date_prevue: tomorrow, statut: 'a_faire', notes: 'RDV téléphonique' },
  ];
  const insertRelance = db.prepare(
    'INSERT INTO relances (id, lead_id, commercial_id, type, date_prevue, statut, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
  );
  for (const r of relances) {
    insertRelance.run(r.id, r.lead_id, r.commercial_id, r.type, r.date_prevue, r.statut, r.notes, now, now);
  }

  // Timeline activites
  const timelines = [
    { id: uuidv4(), lead_id: 'l-1', type: 'appel', description: 'Premier contact', auteur_id: 'u-commercial-1', created_at: lastWeek },
    { id: uuidv4(), lead_id: 'l-1', type: 'changement_statut', description: 'Nouveau → En cours', auteur_id: null, created_at: yesterday },
    { id: uuidv4(), lead_id: 'l-4', type: 'pre_dossier_ouvert', description: 'Pré-dossier ouvert', auteur_id: null, created_at: yesterday },
    { id: uuidv4(), lead_id: 'l-6', type: 'pre_dossier_ouvert', description: 'Pré-dossier ouvert', auteur_id: null, created_at: lastWeek },
    { id: uuidv4(), lead_id: 'l-6', type: 'changement_statut', description: 'Activation apprenant — lead → Gagné', auteur_id: null, created_at: yesterday },
  ];
  const insertTimeline = db.prepare(
    'INSERT INTO timeline_activites (id, lead_id, type, description, auteur_id, created_at) VALUES (?,?,?,?,?,?)'
  );
  for (const t of timelines) {
    insertTimeline.run(t.id, t.lead_id, t.type, t.description, t.auteur_id, t.created_at);
  }

  // Apprenant pour l-4 et l-6
  const apprenants = [
    { id: 'a-1', id_lead_origine: 'l-4', prenom: 'Marie', nom: 'Curie', date_naissance: '1985-03-15', lieu_naissance: 'Paris', nationalite: 'Française', email: 'marie@test.fr', telephone: '0645678901', adresse: '12 rue de la Paix', code_postal: '75001', ville: 'Paris', statut: 'pre_actif' },
    { id: 'a-2', id_lead_origine: 'l-6', prenom: 'Nadia', nom: 'Rezig', date_naissance: '1990-07-22', lieu_naissance: 'Lyon', nationalite: 'Française', email: 'nadia@test.fr', telephone: '0667890123', adresse: '5 allée des Roses', code_postal: '69001', ville: 'Lyon', statut: 'actif' },
  ];
  const insertApprenant = db.prepare(
    'INSERT INTO apprenants (id, id_lead_origine, prenom, nom, date_naissance, lieu_naissance, nationalite, email, telephone, adresse, code_postal, ville, statut, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  for (const a of apprenants) {
    insertApprenant.run(a.id, a.id_lead_origine, a.prenom, a.nom, a.date_naissance, a.lieu_naissance, a.nationalite, a.email, a.telephone, a.adresse, a.code_postal, a.ville, a.statut, now, now);
  }

  // Dossiers
  const dossiers = [
    { id: 'd-1', id_apprenant: 'a-1', id_lead_origine: 'l-4', formation_type: 'taxi', formule: 'standard', type_financement: 'cpf', reference_financeur: '12345678', montant_vendu: 3500, apport_personnel: 0, montant_prise_en_charge: 3500, commercial_id: 'u-commercial-2', gestionnaire_id: 'u-gestionnaire-1', statut: 'en_cours', statut_bloc_admin: 'soumis', statut_bloc_financier: 'en_cours' },
    { id: 'd-2', id_apprenant: 'a-2', id_lead_origine: 'l-6', formation_type: 'vtc', formule: 'accelere', type_financement: 'personnel', reference_financeur: null, montant_vendu: 2800, apport_personnel: 2800, montant_prise_en_charge: 0, commercial_id: 'u-commercial-1', gestionnaire_id: 'u-gestionnaire-1', statut: 'non_planifie', statut_bloc_admin: 'valide', statut_bloc_financier: 'valide' },
  ];
  const insertDossier = db.prepare(
    'INSERT INTO dossiers (id, id_apprenant, id_lead_origine, formation_type, formule, type_financement, reference_financeur, montant_vendu, apport_personnel, montant_prise_en_charge, commercial_id, gestionnaire_id, statut, statut_bloc_admin, statut_bloc_financier, date_creation, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  for (const d of dossiers) {
    insertDossier.run(d.id, d.id_apprenant, d.id_lead_origine, d.formation_type, d.formule, d.type_financement, d.reference_financeur, d.montant_vendu, d.apport_personnel, d.montant_prise_en_charge, d.commercial_id, d.gestionnaire_id, d.statut, d.statut_bloc_admin, d.statut_bloc_financier, now, now);
  }

  // Pieces pour d-1 (dossier Marie Curie)
  const pieces = [
    { id: uuidv4(), dossier_id: 'd-1', type_piece: 'piece_identite', fichier_nom: 'CNI_marie.pdf', statut: 'fournie' },
    { id: uuidv4(), dossier_id: 'd-1', type_piece: 'justif_domicile', fichier_nom: null, statut: 'a_fournir' },
    { id: uuidv4(), dossier_id: 'd-1', type_piece: 'photo_identite', fichier_nom: 'photo.jpg', statut: 'fournie' },
    { id: uuidv4(), dossier_id: 'd-1', type_piece: 'permis_conduire', fichier_nom: 'permis.pdf', statut: 'fournie' },
    { id: uuidv4(), dossier_id: 'd-1', type_piece: 'casier_judiciaire', fichier_nom: null, statut: 'a_fournir' },
  ];
  const insertPiece = db.prepare(
    'INSERT INTO pieces_justificatives (id, dossier_id, type_piece, fichier_nom, statut, created_at, updated_at) VALUES (?,?,?,?,?,?,?)'
  );
  for (const p of pieces) {
    insertPiece.run(p.id, p.dossier_id, p.type_piece, p.fichier_nom, p.statut, now, now);
  }

  // Audit log pour d-2
  const audits = [
    { id: uuidv4(), dossier_id: 'd-2', lead_id: 'l-6', type_action: 'creation_dossier', detail: 'Dossier créé depuis lead #l-6', auteur_id: 'u-commercial-1', created_at: lastWeek },
    { id: uuidv4(), dossier_id: 'd-2', lead_id: null, type_action: 'bloc_valide', detail: 'Bloc administratif validé par Sophie Martin', auteur_id: 'u-gestionnaire-1', created_at: yesterday },
    { id: uuidv4(), dossier_id: 'd-2', lead_id: 'l-6', type_action: 'apprenant_active', detail: 'Apprenant activé — lead → Gagné, commission figée (1 200 €)', auteur_id: 'u-admin-1', created_at: yesterday },
  ];
  const insertAudit = db.prepare(
    'INSERT INTO audit_log (id, dossier_id, lead_id, type_action, detail, auteur_id, created_at) VALUES (?,?,?,?,?,?,?)'
  );
  for (const a of audits) {
    insertAudit.run(a.id, a.dossier_id, a.lead_id, a.type_action, a.detail, a.auteur_id, a.created_at);
  }
}
