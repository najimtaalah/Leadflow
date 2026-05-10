import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  if (count > 0) {
    console.log('Database already seeded, skipping.');
    return;
  }

  const now = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const lastWeek = new Date(Date.now() - 7 * 86400000);
  const tomorrow = new Date(Date.now() + 86400000);

  // Users
  await prisma.user.createMany({
    data: [
      { id: 'u-commercial-1', prenom: 'Thomas', nom: 'Durand', email: 'thomas@leadflow.fr', role: 'commercial', created_at: now },
      { id: 'u-commercial-2', prenom: 'Léa', nom: 'Bernard', email: 'lea@leadflow.fr', role: 'commercial', created_at: now },
      { id: 'u-closer-1', prenom: 'Marc', nom: 'Petit', email: 'marc@leadflow.fr', role: 'closer_habilite', created_at: now },
      { id: 'u-gestionnaire-1', prenom: 'Sophie', nom: 'Martin', email: 'sophie@leadflow.fr', role: 'gestionnaire', created_at: now },
      { id: 'u-admin-1', prenom: 'Paul', nom: 'Leclerc', email: 'paul@leadflow.fr', role: 'admin', created_at: now },
      { id: 'u-superadmin-1', prenom: 'Alice', nom: 'Moreau', email: 'alice@leadflow.fr', role: 'super_admin', created_at: now },
    ],
  });

  // Leads
  await prisma.lead.createMany({
    data: [
      { id: 'l-1', commercial_id: 'u-commercial-1', prenom: 'Karim', nom: 'Benali', email: 'karim@test.fr', telephone: '0612345678', source: 'formulaire_web', formation_visee: 'VTC', statut: 'en_cours', badge_pre_dossier: false, notes: null, date_creation: lastWeek, updated_at: yesterday },
      { id: 'l-2', commercial_id: 'u-commercial-1', prenom: 'Fatima', nom: 'Zidane', email: 'fatima@test.fr', telephone: '0623456789', source: 'telephone', formation_visee: 'Taxi', statut: 'qualifie', badge_pre_dossier: false, notes: 'Intéressée par formation accélérée', date_creation: lastWeek, updated_at: now },
      { id: 'l-3', commercial_id: 'u-commercial-1', prenom: 'Jean', nom: 'Dupont', email: 'jean@test.fr', telephone: '0634567890', source: 'recommandation', formation_visee: 'VTC', statut: 'nouveau', badge_pre_dossier: false, notes: null, date_creation: now, updated_at: now },
      { id: 'l-4', commercial_id: 'u-commercial-2', prenom: 'Marie', nom: 'Curie', email: 'marie@test.fr', telephone: '0645678901', source: 'formulaire_web', formation_visee: 'Taxi', statut: 'en_cours', badge_pre_dossier: true, notes: null, date_creation: lastWeek, updated_at: yesterday },
      { id: 'l-5', commercial_id: 'u-commercial-2', prenom: 'Ahmed', nom: 'Hassan', email: 'ahmed@test.fr', telephone: '0656789012', source: 'autre', formation_visee: 'VMDTR', statut: 'perdu', badge_pre_dossier: false, notes: 'Pas disponible avant 6 mois', date_creation: lastWeek, updated_at: lastWeek },
      { id: 'l-6', commercial_id: 'u-commercial-1', prenom: 'Nadia', nom: 'Rezig', email: 'nadia@test.fr', telephone: '0667890123', source: 'telephone', formation_visee: 'VTC', statut: 'gagne', badge_pre_dossier: true, notes: null, date_creation: lastWeek, updated_at: yesterday },
    ],
  });

  // Commissions
  await prisma.commission.createMany({
    data: [
      { id: uuidv4(), lead_id: 'l-1', commercial_id: 'u-commercial-1', montant: 800, statut: 'libre', date_figement: null, created_at: now, updated_at: now },
      { id: uuidv4(), lead_id: 'l-6', commercial_id: 'u-commercial-1', montant: 1200, statut: 'figee', date_figement: yesterday, created_at: now, updated_at: now },
      { id: uuidv4(), lead_id: 'l-4', commercial_id: 'u-commercial-2', montant: 950, statut: 'libre', date_figement: null, created_at: now, updated_at: now },
    ],
  });

  // Relances
  await prisma.relance.createMany({
    data: [
      { id: uuidv4(), lead_id: 'l-1', commercial_id: 'u-commercial-1', type: 'appel', date_prevue: tomorrow, statut: 'a_faire', notes: 'Rappeler pour devis', created_at: now, updated_at: now },
      { id: uuidv4(), lead_id: 'l-2', commercial_id: 'u-commercial-1', type: 'email', date_prevue: yesterday, statut: 'en_retard', notes: null, created_at: now, updated_at: now },
      { id: uuidv4(), lead_id: 'l-3', commercial_id: 'u-commercial-1', type: 'rdv', date_prevue: tomorrow, statut: 'a_faire', notes: 'RDV téléphonique', created_at: now, updated_at: now },
    ],
  });

  // Timeline activites
  await prisma.timelineActivite.createMany({
    data: [
      { id: uuidv4(), lead_id: 'l-1', type: 'appel', description: 'Premier contact', auteur_id: 'u-commercial-1', created_at: lastWeek },
      { id: uuidv4(), lead_id: 'l-1', type: 'changement_statut', description: 'Nouveau → En cours', auteur_id: null, created_at: yesterday },
      { id: uuidv4(), lead_id: 'l-4', type: 'pre_dossier_ouvert', description: 'Pré-dossier ouvert', auteur_id: null, created_at: yesterday },
      { id: uuidv4(), lead_id: 'l-6', type: 'pre_dossier_ouvert', description: 'Pré-dossier ouvert', auteur_id: null, created_at: lastWeek },
      { id: uuidv4(), lead_id: 'l-6', type: 'changement_statut', description: 'Activation apprenant — lead → Gagné', auteur_id: null, created_at: yesterday },
    ],
  });

  // Apprenants
  await prisma.apprenant.createMany({
    data: [
      { id: 'a-1', id_lead_origine: 'l-4', prenom: 'Marie', nom: 'Curie', date_naissance: '1985-03-15', lieu_naissance: 'Paris', nationalite: 'Française', email: 'marie@test.fr', telephone: '0645678901', adresse: '12 rue de la Paix', code_postal: '75001', ville: 'Paris', statut: 'pre_actif', created_at: now, updated_at: now },
      { id: 'a-2', id_lead_origine: 'l-6', prenom: 'Nadia', nom: 'Rezig', date_naissance: '1990-07-22', lieu_naissance: 'Lyon', nationalite: 'Française', email: 'nadia@test.fr', telephone: '0667890123', adresse: '5 allée des Roses', code_postal: '69001', ville: 'Lyon', statut: 'actif', created_at: now, updated_at: now },
    ],
  });

  // Dossiers
  await prisma.dossier.createMany({
    data: [
      { id: 'd-1', id_apprenant: 'a-1', id_lead_origine: 'l-4', formation_type: 'taxi', formule: 'standard', type_financement: 'cpf', reference_financeur: '12345678', montant_vendu: 3500, apport_personnel: 0, montant_prise_en_charge: 3500, commercial_id: 'u-commercial-2', gestionnaire_id: 'u-gestionnaire-1', statut: 'en_cours', statut_bloc_admin: 'soumis', statut_bloc_financier: 'en_cours', date_creation: now, updated_at: now },
      { id: 'd-2', id_apprenant: 'a-2', id_lead_origine: 'l-6', formation_type: 'vtc', formule: 'accelere', type_financement: 'personnel', reference_financeur: null, montant_vendu: 2800, apport_personnel: 2800, montant_prise_en_charge: 0, commercial_id: 'u-commercial-1', gestionnaire_id: 'u-gestionnaire-1', statut: 'non_planifie', statut_bloc_admin: 'valide', statut_bloc_financier: 'valide', date_creation: now, updated_at: now },
    ],
  });

  // Pieces justificatives pour d-1
  await prisma.pieceJustificative.createMany({
    data: [
      { id: uuidv4(), dossier_id: 'd-1', type_piece: 'piece_identite', fichier_nom: 'CNI_marie.pdf', statut: 'fournie', created_at: now, updated_at: now },
      { id: uuidv4(), dossier_id: 'd-1', type_piece: 'justif_domicile', fichier_nom: null, statut: 'a_fournir', created_at: now, updated_at: now },
      { id: uuidv4(), dossier_id: 'd-1', type_piece: 'photo_identite', fichier_nom: 'photo.jpg', statut: 'fournie', created_at: now, updated_at: now },
      { id: uuidv4(), dossier_id: 'd-1', type_piece: 'permis_conduire', fichier_nom: 'permis.pdf', statut: 'fournie', created_at: now, updated_at: now },
      { id: uuidv4(), dossier_id: 'd-1', type_piece: 'casier_judiciaire', fichier_nom: null, statut: 'a_fournir', created_at: now, updated_at: now },
    ],
  });

  // Audit logs pour d-2
  await prisma.auditLog.createMany({
    data: [
      { id: uuidv4(), dossier_id: 'd-2', lead_id: 'l-6', type_action: 'creation_dossier', detail: 'Dossier créé depuis lead #l-6', auteur_id: 'u-commercial-1', created_at: lastWeek },
      { id: uuidv4(), dossier_id: 'd-2', lead_id: null, type_action: 'bloc_valide', detail: 'Bloc administratif validé par Sophie Martin', auteur_id: 'u-gestionnaire-1', created_at: yesterday },
      { id: uuidv4(), dossier_id: 'd-2', lead_id: 'l-6', type_action: 'apprenant_active', detail: 'Apprenant activé — lead → Gagné, commission figée (1 200 €)', auteur_id: 'u-admin-1', created_at: yesterday },
    ],
  });

  console.log('Database seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
