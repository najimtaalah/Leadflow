export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function formatEuro(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n);
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n} %`;
}

export const LEAD_STATUT_LABELS: Record<string, string> = {
  nouveau: 'Nouveau',
  qualifie: 'Qualifié',
  en_cours: 'En cours',
  gagne: 'Gagné',
  perdu: 'Perdu',
};

export const LEAD_STATUT_VARIANT: Record<string, string> = {
  nouveau: 'gray',
  qualifie: 'blue',
  en_cours: 'orange',
  gagne: 'green',
  perdu: 'red',
};

export const SOURCE_LABELS: Record<string, string> = {
  formulaire_web: 'Formulaire web',
  telephone: 'Téléphone',
  recommandation: 'Recommandation',
  autre: 'Autre',
};

export const FORMATION_TYPE_LABELS: Record<string, string> = {
  vtc: 'VTC',
  taxi: 'Taxi',
  vmdtr: 'VMDTR',
  passerelle_vtc_taxi: 'Passerelle VTC→Taxi',
  passerelle_taxi_vtc: 'Passerelle Taxi→VTC',
};

export const FORMULE_LABELS: Record<string, string> = {
  standard: 'Standard',
  accelere: 'Accéléré',
  illimite: 'Illimité',
  week_end: 'Week-end',
  mixte: 'Mixte',
};

export const FINANCEMENT_LABELS: Record<string, string> = {
  cpf: 'CPF',
  france_travail: 'France Travail',
  opco: 'OPCO',
  personnel: 'Personnel',
  autre: 'Autre',
};

export const FINANCEMENT_VARIANT: Record<string, string> = {
  cpf: 'blue',
  france_travail: 'orange',
  opco: 'green',
  personnel: 'gray',
  autre: 'gray',
};

export const DOSSIER_STATUT_LABELS: Record<string, string> = {
  pre_dossier: 'Pré-dossier',
  en_cours: 'En cours',
  valide: 'Validé',
  non_planifie: 'Non planifié',
  planifie: 'Planifié',
  annule: 'Annulé',
};

export const DOSSIER_STATUT_VARIANT: Record<string, string> = {
  pre_dossier: 'gray',
  en_cours: 'orange',
  valide: 'blue',
  non_planifie: 'green',
  planifie: 'green',
  annule: 'red',
};

export const BLOC_STATUT_LABELS: Record<string, string> = {
  non_demarre: 'Non démarré',
  en_cours: 'En cours',
  soumis: 'Soumis',
  valide: 'Validé',
  rejete: 'Rejeté',
};

export const BLOC_STATUT_VARIANT: Record<string, string> = {
  non_demarre: 'gray',
  en_cours: 'orange',
  soumis: 'blue',
  valide: 'green',
  rejete: 'red',
};

export const RELANCE_STATUT_LABELS: Record<string, string> = {
  a_faire: 'À faire',
  en_retard: 'En retard',
  faite: 'Faite',
};

export const RELANCE_STATUT_VARIANT: Record<string, string> = {
  a_faire: 'blue',
  en_retard: 'red',
  faite: 'green',
};

export const RELANCE_TYPE_LABELS: Record<string, string> = {
  appel: 'Appel',
  email: 'Email',
  rdv: 'RDV',
  autre: 'Autre',
};

export const PIECE_STATUT_LABELS: Record<string, string> = {
  a_fournir: 'À fournir',
  fournie: 'Fournie',
  rejetee: 'Rejetée',
  validee: 'Validée',
};

export const PIECE_STATUT_VARIANT: Record<string, string> = {
  a_fournir: 'gray',
  fournie: 'orange',
  rejetee: 'red',
  validee: 'green',
};

export const PIECE_TYPE_LABELS: Record<string, string> = {
  piece_identite: "Pièce d'identité (CNI / passeport)",
  justif_domicile: "Justificatif de domicile (< 3 mois)",
  photo_identite: "Photo d'identité",
  permis_conduire: "Permis de conduire (recto-verso)",
  casier_judiciaire: "Extrait casier judiciaire B3",
  attestation_medicale: "Attestation médicale d'aptitude",
  attestation_assr: "Attestation ASSR niveau 2",
  permis_be: "Permis BE (ou certificat équivalent)",
  carte_pro_vtc: "Carte professionnelle VTC valide",
  carte_pro_taxi: "Carte professionnelle Taxi valide",
  evaluation_positionnement: "Évaluation de positionnement",
  programme_formation: "Programme de formation",
};

export const ROLE_LABELS: Record<string, string> = {
  commercial: 'Commercial',
  closer_habilite: 'Closer habilité',
  gestionnaire: 'Gestionnaire',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

export const SESSION_STATUT_LABELS: Record<string, string> = {
  planifie: 'Planifié',
  en_cours: 'En cours',
  termine: 'Terminé',
  annule: 'Annulé',
};

export const SESSION_STATUT_VARIANT: Record<string, string> = {
  planifie: 'blue',
  en_cours: 'orange',
  termine: 'green',
  annule: 'red',
};

export const SESSION_EDOF_STATUT_LABELS: Record<string, string> = {
  active: 'Active',
  cloturee: 'Clôturée',
};

export const SESSION_EDOF_STATUT_VARIANT: Record<string, string> = {
  active: 'green',
  cloturee: 'gray',
};

export const TYPE_PRESENCE_LABELS: Record<string, string> = {
  presentiel: 'Présentiel',
  distanciel: 'Distanciel',
  hybride: 'Hybride',
};

export const RESULTAT_EXAMEN_LABELS: Record<string, string> = {
  reussi: 'Réussi',
  echoue: 'Échoué',
  absent: 'Absent',
};

export const RESULTAT_EXAMEN_VARIANT: Record<string, string> = {
  reussi: 'green',
  echoue: 'red',
  absent: 'gray',
};
