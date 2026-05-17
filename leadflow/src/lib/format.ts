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
  nouveau: 'Entrant',
  entrant: 'Entrant',
  qualifie: 'Qualifié',
  a_relancer: 'À relancer',
  en_cours: 'En cours',
  rdv_planifie: 'RDV planifié',
  dossier_monte: 'Dossier monté',
  finance: 'Financé',
  gagne: 'Financé',
  perdu: 'Perdu',
};

export const LEAD_STATUT_VARIANT: Record<string, string> = {
  nouveau: 'gray',
  entrant: 'gray',
  qualifie: 'blue',
  a_relancer: 'violet',
  en_cours: 'violet',
  rdv_planifie: 'green',
  dossier_monte: 'orange',
  finance: 'green',
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

// Lot 5
export const SESSION_STATUT_LABELS_EXAMEN: Record<string, string> = {
  planifie: 'Planifié',
  convocations_envoyees: 'Convocations envoyées',
  resultats_saisis: 'Résultats saisis',
  annule: 'Annulé',
};

export const SESSION_STATUT_VARIANT_EXAMEN: Record<string, string> = {
  planifie: 'blue',
  convocations_envoyees: 'orange',
  resultats_saisis: 'green',
  annule: 'red',
};

export const TENTATIVE_STATUT_LABELS: Record<string, string> = {
  en_cours: 'En cours',
  reussie: 'Réussie',
  echouee: 'Échouée',
};

export const TENTATIVE_STATUT_VARIANT: Record<string, string> = {
  en_cours: 'blue',
  reussie: 'green',
  echouee: 'red',
};

export const SAISIE_RESULTAT_LABELS: Record<string, string> = {
  admis: 'Admis',
  refuse: 'Refusé',
};

export const SAISIE_RESULTAT_VARIANT: Record<string, string> = {
  admis: 'green',
  refuse: 'red',
};

export const STATUT_RESULTAT_LABELS: Record<string, string> = {
  planifie: 'Planifié',
  passe: 'Passé',
  resultat_en_attente: 'Résultat en attente',
  reussi: 'Réussi',
  echoue: 'Échoué',
};

export const STATUT_RESULTAT_VARIANT: Record<string, string> = {
  planifie: 'blue',
  passe: 'orange',
  resultat_en_attente: 'orange',
  reussi: 'green',
  echoue: 'red',
};
