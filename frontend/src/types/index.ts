export type Role = "COMMERCIAL" | "CLOSER" | "GESTIONNAIRE" | "ADMIN" | "SUPER_ADMIN";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}

// ─── Lot 6 — Documents ────────────────────────────────────────────────────────

export type DocumentDossierType =
  | "CONVOCATION_FORMATION"
  | "CONTRAT_FORMATION"
  | "EMARGEMENT"
  | "ATTESTATION_FORMATION"
  | "CERTIFICAT"
  | "FACTURE"
  | "CONVOCATION_EXAMEN_THEO"
  | "CONVOCATION_EXAMEN_PRAT";

export type DocumentDossierStatut =
  | "NON_GENERE"
  | "EN_ATTENTE"
  | "GENERE"
  | "SIGNE"
  | "BLOQUE";

export interface DocumentDossierView {
  id: string;
  typeDocument: DocumentDossierType;
  sourceType: string;
  sourceId: string | null;
  statut: DocumentDossierStatut;
  urlFichier: string | null;
  genereAt: string | null;
  genereParNom: string | null;
  signeAt: string | null;
  signeParNom: string | null;
}

export interface AlerteDocument {
  type: "avant_formation" | "apres_formation" | "avant_examen";
  message: string;
  typeDocument: DocumentDossierType;
  dossierId: string;
}

export interface ZipManifestEntry {
  typeDocument: DocumentDossierType;
  label: string;
  statut: DocumentDossierStatut;
  urlFichier: string | null;
  included: boolean;
  raison?: string;
}

// ─── Lot 6 — Qualiopi ─────────────────────────────────────────────────────────

export type QualiopiStatut = "VERT" | "ORANGE" | "ROUGE" | "GRIS";

export interface PreuveDetail {
  label: string;
  type: "document" | "champ" | "session" | "audit";
  statut: "presente" | "manquante" | "partielle";
  lien?: string;
}

export interface ActionContextuelle {
  label: string;
  typeDocument?: DocumentDossierType;
  champ?: string;
  href?: string;
}

export interface CritereResult {
  num: number;
  label: string;
  description: string;
  statut: QualiopiStatut;
  preuves: PreuveDetail[];
  actions: ActionContextuelle[];
}

export interface QualiopiConformite {
  tauxNumerateur: number;
  tauxDenominateur: number;
  tauxPourcent: number;
  criteres: CritereResult[];
  alertesAvantFormation: string[];
  alertesApresFormation: string[];
}

export interface HistoriqueEntry {
  id: string;
  critereNum: number;
  statutAvant: QualiopiStatut | null;
  statutApres: QualiopiStatut;
  declencheurType: string;
  note: string | null;
  createdAt: string;
}
