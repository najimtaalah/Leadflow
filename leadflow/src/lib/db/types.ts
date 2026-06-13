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
export type SessionStatut = 'planifie' | 'en_cours' | 'termine' | 'annule';
export type TypePresence = 'presentiel' | 'distanciel' | 'hybride';
export type SessionEdofStatut = 'active' | 'cloturee';
export type ResultatExamen = 'reussi' | 'echoue' | 'absent';
export type TentativeStatut = 'en_cours' | 'reussie' | 'echouee';
export type SaisieResultat = 'admis' | 'refuse';
export type StatutResultatExamen = 'planifie' | 'passe' | 'resultat_en_attente' | 'reussi' | 'echoue';
export type SessionTypeExamen = 'theorique' | 'pratique';
export type StatutConvocationRequest = 'en_attente' | 'traitee' | 'annulee';
export type StatutAttestationRequest = 'en_attente' | 'traitee' | 'annulee';
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

export interface SessionCours {
  id: string;
  titre: string;
  date_debut: string;
  date_fin: string;
  type_presence: TypePresence;
  lieu: string | null;
  formateur: string | null;
  capacite_max: number;
  statut: SessionStatut;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionCoursWithCount extends SessionCours {
  nb_affectations: number;
}

export interface SessionEdof {
  id: string;
  reference_edof: string | null;
  date_debut: string;
  date_fin: string;
  date_fin_cpf: string | null;
  capacite_max: number;
  statut: SessionEdofStatut;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionEdofWithCount extends SessionEdof {
  nb_affectations: number;
}

export interface SessionExamenTheorique {
  id: string;
  date_examen: string;
  lieu: string | null;
  organisme: string | null;
  capacite_max: number;
  statut: SessionStatut;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionExamenTheoriqueWithCount extends SessionExamenTheorique {
  nb_affectations: number;
}

export interface SessionExamenPratique {
  id: string;
  date_examen: string;
  lieu: string | null;
  organisme: string | null;
  capacite_max: number;
  statut: SessionStatut;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionExamenPratiqueWithCount extends SessionExamenPratique {
  nb_affectations: number;
}

export interface Affectation {
  id: string;
  dossier_id: string;
  session_cours_id: string | null;
  session_edof_id: string | null;
  session_examen_theorique_id: string | null;
  session_examen_pratique_id: string | null;
  resultat_theorique: ResultatExamen | null;
  resultat_pratique: ResultatExamen | null;
  created_at: string;
  updated_at: string;
}

export interface AffectationWithApprenant extends Affectation {
  apprenant_prenom: string;
  apprenant_nom: string;
  apprenant_email: string;
  dossier_formation_type: string;
  dossier_statut: DossierStatut;
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

// ─── Lot 5 — Examens & Tentatives ─────────────────────────────────────────────

export interface Tentative {
  id: string;
  dossier_id: string;
  numero: number;
  statut: TentativeStatut;
  session_examen_theorique_id: string | null;
  session_examen_pratique_id: string | null;
  date_cloture: string | null;
  created_at: string;
  updated_at: string;
}

export interface TentativeWithResultats extends Tentative {
  resultat_theorique: ResultatExamenDetailRow | null;
  resultat_pratique: ResultatExamenDetailRow | null;
  session_theorique_date: string | null;
  session_theorique_lieu: string | null;
  session_pratique_date: string | null;
  session_pratique_lieu: string | null;
}

export interface ResultatExamenDetailRow {
  id: string;
  dossier_id: string;
  tentative_id: string;
  session_type: SessionTypeExamen;
  session_id: string;
  statut: StatutResultatExamen;
  resultat: SaisieResultat | null;
  score: number | null;
  mention: string | null;
  observations: string | null;
  saisi_par_id: string | null;
  saisi_par_prenom: string | null;
  saisi_par_nom: string | null;
  saisi_le: string | null;
  created_at: string;
  updated_at: string;
}

export interface AffectationWithApprenantAndTentative extends AffectationWithApprenant {
  tentative_id: string | null;
  tentative_numero: number | null;
  tentative_statut: TentativeStatut | null;
  resultat_detail_statut: StatutResultatExamen | null;
  resultat_detail_resultat: SaisieResultat | null;
  resultat_detail_score: number | null;
  resultat_detail_mention: string | null;
}

// ─── Lot 6 — Documents & Module Qualiopi visuel ───────────────────────────────

export type TypeDocument =
  | 'convocation_formation'
  | 'contrat_formation'
  | 'emargement'
  | 'attestation_formation'
  | 'certificat'
  | 'facture'
  | 'convocation_examen_theo'
  | 'convocation_examen_prat';

export type SourceTypeDocument =
  | 'session_cours'
  | 'session_edof'
  | 'session_examen_theo'
  | 'session_examen_prat'
  | 'dossier';

export type StatutDocument = 'non_genere' | 'en_attente' | 'genere' | 'signe' | 'bloque';

export type QualiopiCouleur = 'vert' | 'orange' | 'rouge' | 'gris';

export type QualiopiDeclencheurType = 'document' | 'session' | 'champ' | 'audit' | 'manuel';

export interface DocumentDossier {
  id: string;
  dossier_id: string;
  type_document: TypeDocument;
  source_type: SourceTypeDocument;
  source_id: string | null;
  statut: StatutDocument;
  url_fichier: string | null;
  genere_at: string | null;
  genere_par_id: string | null;
  genere_par_prenom: string | null;
  genere_par_nom: string | null;
  signe_at: string | null;
  signe_par_id: string | null;
  signe_par_prenom: string | null;
  signe_par_nom: string | null;
  created_at: string;
  updated_at: string;
}

export interface QualiopiHistoriqueRow {
  id: string;
  dossier_id: string;
  critere_num: number;
  statut_avant: QualiopiCouleur;
  statut_apres: QualiopiCouleur;
  declencheur_type: QualiopiDeclencheurType;
  declencheur_id: string | null;
  acteur_id: string | null;
  acteur_prenom: string | null;
  acteur_nom: string | null;
  note: string | null;
  created_at: string;
}

export interface QualiopiPreuve {
  label: string;
  statut: 'presente' | 'manquante' | 'partielle' | 'non_applicable';
  lien_type?: string;
  lien_id?: string;
}

export interface QualiopiCritereStatut {
  num: number;
  couleur: QualiopiCouleur;
  preuves: QualiopiPreuve[];
}

export interface QualiopiConformite {
  criteres: QualiopiCritereStatut[];
  taux_numerateur: number;
  taux_denominateur: number;
  taux_pourcent: number;
}

// ─── Lot 9 — Qualiopi Action Tracker ──────────────────────────────────────────

export type ActionQualiopiStatut = 'a_faire' | 'en_cours' | 'fait' | 'en_retard' | 'annule';
export type ActionQualiopiPriorite = 'low' | 'medium' | 'high' | 'critical';
export type ActionQualiopiIndicateur = 'IND-23' | 'IND-24' | 'IND-25' | 'CRIT-5' | 'CRIT-6';
export type ActionQualiopiFormation = 'TAXI' | 'VTC' | 'VMDTR' | 'ANGLAIS' | 'FRANCAIS_FLE' | 'GRANDE_REMISE';

export interface ActionQualiopi {
  id: string;
  indicateur: ActionQualiopiIndicateur;
  formation: ActionQualiopiFormation | null;
  titre: string;
  description: string | null;
  responsable: string | null;
  date_echeance: string | null;
  statut: ActionQualiopiStatut;
  priorite: ActionQualiopiPriorite;
  preuve: string | null;
  preuve_fichier_url: string | null;
  source_veille_semaine: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ActionQualiopiWithHistory extends ActionQualiopi {
  history: ActionQualiopiHistoryRow[];
}

export interface ActionQualiopiHistoryRow {
  id: string;
  action_id: string;
  statut_avant: ActionQualiopiStatut | null;
  statut_apres: ActionQualiopiStatut;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface ActionQualiopiFilters {
  indicateur?: ActionQualiopiIndicateur;
  formation?: ActionQualiopiFormation;
  statut?: ActionQualiopiStatut;
  priorite?: ActionQualiopiPriorite;
  q?: string;
  page?: number;
  limit?: number;
}

export interface ActionQualiopiDashboardSummary {
  en_retard_count: number;
  prioritaires: ActionQualiopi[];
  prochaines_echeances: ActionQualiopi[];
}
