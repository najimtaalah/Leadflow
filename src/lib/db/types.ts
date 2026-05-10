export type LeadSource = 'formulaire_web' | 'telephone' | 'recommandation' | 'autre';
export type LeadStatut = 'nouveau' | 'qualifie' | 'en_cours' | 'gagne' | 'perdu';
export type RelanceType = 'appel' | 'email' | 'rdv' | 'autre';
export type RelanceStatut = 'a_faire' | 'en_retard' | 'faite';
export type CommissionStatut = 'libre' | 'figee';
export type TimelineType = 'appel' | 'message' | 'rdv' | 'relance' | 'note' | 'changement_statut' | 'pre_dossier_ouvert';
export type UserRole = 'commercial' | 'closer_habilite' | 'gestionnaire' | 'admin' | 'super_admin';
export type ApprenantStatut = 'pre_actif' | 'actif';
export type FormationType = 'vtc' | 'taxi' | 'vmdtr' | 'passerelle_vtc_taxi' | 'passerelle_taxi_vtc';
export type Formule = 'standard' | 'accelere' | 'illimite' | 'week_end' | 'mixte';
export type TypeFinancement = 'cpf' | 'france_travail' | 'opco' | 'personnel' | 'autre';
export type DossierStatut = 'pre_dossier' | 'en_cours' | 'valide' | 'non_planifie' | 'planifie' | 'annule';
export type BlocStatut = 'non_demarre' | 'en_cours' | 'soumis' | 'valide' | 'rejete';
export type PieceStatut = 'a_fournir' | 'fournie' | 'rejetee' | 'validee';
export type AuditActionType =
  | 'creation_dossier'
  | 'modification_champ'
  | 'piece_deposee'
  | 'piece_rejetee'
  | 'bloc_soumis'
  | 'bloc_valide'
  | 'bloc_rejete'
  | 'apprenant_active'
  | 'session_affectee'
  | 'document_genere'
  | 'commission_deverrouillee'
  | 'reclamation';

export interface User {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Lead {
  id: string;
  commercial_id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  source: LeadSource;
  formation_visee: string | null;
  statut: LeadStatut;
  badge_pre_dossier: boolean | number;
  notes: string | null;
  date_creation: string;
  updated_at: string;
}

export interface LeadWithRelations extends Lead {
  commercial_nom: string;
  commercial_prenom: string;
  prochaine_relance: string | null;
  commission_montant: number | null;
  commission_statut: CommissionStatut | null;
}

export interface Relance {
  id: string;
  lead_id: string;
  commercial_id: string;
  type: RelanceType;
  date_prevue: string;
  statut: RelanceStatut;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RelanceWithLead extends Relance {
  lead_prenom: string;
  lead_nom: string;
  commercial_prenom: string;
  commercial_nom: string;
}

export interface Commission {
  id: string;
  lead_id: string;
  commercial_id: string;
  montant: number | null;
  statut: CommissionStatut;
  date_figement: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommissionWithLead extends Commission {
  lead_prenom: string;
  lead_nom: string;
  commercial_prenom: string;
  commercial_nom: string;
}

export interface TimelineActivite {
  id: string;
  lead_id: string;
  type: TimelineType;
  description: string | null;
  auteur_id: string | null;
  auteur_prenom: string | null;
  auteur_nom: string | null;
  created_at: string;
}

export interface Apprenant {
  id: string;
  id_lead_origine: string | null;
  prenom: string;
  nom: string;
  date_naissance: string;
  lieu_naissance: string | null;
  nationalite: string | null;
  email: string;
  telephone: string;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  statut: ApprenantStatut;
  created_at: string;
  updated_at: string;
}

export interface ApprenantWithRelations extends Apprenant {
  lead_prenom: string | null;
  lead_nom: string | null;
  nb_dossiers: number;
}

export interface Dossier {
  id: string;
  id_apprenant: string;
  id_lead_origine: string | null;
  formation_type: FormationType;
  formule: Formule;
  numero_cma: string | null;
  type_financement: TypeFinancement | null;
  reference_financeur: string | null;
  montant_vendu: number | null;
  apport_personnel: number | null;
  montant_prise_en_charge: number | null;
  commercial_id: string | null;
  gestionnaire_id: string | null;
  statut: DossierStatut;
  statut_bloc_admin: BlocStatut;
  statut_bloc_financier: BlocStatut;
  notes: string | null;
  notes_financier: string | null;
  date_creation: string;
  date_activation: string | null;
  updated_at: string;
}

export interface DossierWithRelations extends Dossier {
  apprenant_prenom: string;
  apprenant_nom: string;
  commercial_prenom: string | null;
  commercial_nom: string | null;
  gestionnaire_prenom: string | null;
  gestionnaire_nom: string | null;
}

export interface PieceJustificative {
  id: string;
  dossier_id: string;
  type_piece: string;
  fichier_nom: string | null;
  fichier_path: string | null;
  date_depot: string | null;
  statut: PieceStatut;
  motif_rejet: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  dossier_id: string | null;
  lead_id: string | null;
  type_action: AuditActionType;
  detail: string | null;
  auteur_id: string | null;
  auteur_prenom: string | null;
  auteur_nom: string | null;
  created_at: string;
}

export interface PerformanceCommercial {
  commercial_id: string;
  commercial_prenom: string;
  commercial_nom: string;
  leads_attribues: number;
  leads_actifs: number;
  leads_gagnes: number;
  leads_perdus: number;
  taux_conversion: number | null;
  commissions_figees: number;
  commissions_en_cours: number;
  relances_en_retard: number;
}
