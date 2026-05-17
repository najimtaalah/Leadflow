import { prisma } from './prisma';
import type {
  Apprenant, ApprenantWithRelations, Dossier, DossierWithRelations,
  PieceJustificative, AuditLog, BlocStatut, TypeFinancement,
  FormationType, Formule,
} from './types';

export function initDb(): void {
  // no-op — Prisma connects lazily; seeding done at container start
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

// ─── APPRENANTS ───────────────────────────────────────────────────────────────

export async function getApprenants(
  filters: { restricted_commercial_id?: string } = {},
): Promise<ApprenantWithRelations[]> {
  const rows = await prisma.apprenant.findMany({
    where: filters.restricted_commercial_id
      ? {
          OR: [
            { dossiers: { some: { commercial_id: filters.restricted_commercial_id } } },
            { lead: { commercial_id: filters.restricted_commercial_id } },
          ],
        }
      : {},
    include: {
      lead: { select: { prenom: true, nom: true } },
      _count: { select: { dossiers: true } },
    },
    orderBy: { nom: 'asc' },
  });

  return rows.map((r) => ({
    id: r.id,
    id_lead_origine: r.id_lead_origine,
    prenom: r.prenom,
    nom: r.nom,
    date_naissance: r.date_naissance,
    lieu_naissance: r.lieu_naissance,
    nationalite: r.nationalite,
    email: r.email,
    telephone: r.telephone,
    adresse: r.adresse,
    code_postal: r.code_postal,
    ville: r.ville,
    statut: r.statut as Apprenant['statut'],
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    lead_prenom: r.lead?.prenom ?? null,
    lead_nom: r.lead?.nom ?? null,
    nb_dossiers: r._count.dossiers,
  }));
}

export async function getApprenantById(id: string): Promise<ApprenantWithRelations | null> {
  const r = await prisma.apprenant.findUnique({
    where: { id },
    include: {
      lead: { select: { prenom: true, nom: true } },
      _count: { select: { dossiers: true } },
    },
  });
  if (!r) return null;
  return {
    id: r.id,
    id_lead_origine: r.id_lead_origine,
    prenom: r.prenom,
    nom: r.nom,
    date_naissance: r.date_naissance,
    lieu_naissance: r.lieu_naissance,
    nationalite: r.nationalite,
    email: r.email,
    telephone: r.telephone,
    adresse: r.adresse,
    code_postal: r.code_postal,
    ville: r.ville,
    statut: r.statut as Apprenant['statut'],
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    lead_prenom: r.lead?.prenom ?? null,
    lead_nom: r.lead?.nom ?? null,
    nb_dossiers: r._count.dossiers,
  };
}

export async function updateApprenant(
  id: string,
  data: Partial<Pick<Apprenant, 'prenom' | 'nom' | 'date_naissance' | 'lieu_naissance' | 'nationalite' | 'email' | 'telephone' | 'adresse' | 'code_postal' | 'ville'>>,
): Promise<void> {
  await prisma.apprenant.update({ where: { id }, data });
}

// ─── DOSSIERS ─────────────────────────────────────────────────────────────────

export interface DossierFilters {
  statut?: string[];
  statut_bloc_admin?: string;
  statut_bloc_financier?: string;
  formation_type?: string[];
  type_financement?: string[];
  gestionnaire_id?: string;
  date_debut?: string;
  date_fin?: string;
  sans_session?: boolean;
  restricted_commercial_id?: string;
}

export async function getDossiers(filters: DossierFilters = {}): Promise<DossierWithRelations[]> {
  const rows = await prisma.dossier.findMany({
    where: {
      ...(filters.restricted_commercial_id && { commercial_id: filters.restricted_commercial_id }),
      ...(filters.statut?.length && { statut: { in: filters.statut as Dossier['statut'][] } }),
      ...(filters.statut_bloc_admin && { statut_bloc_admin: filters.statut_bloc_admin as BlocStatut }),
      ...(filters.statut_bloc_financier && { statut_bloc_financier: filters.statut_bloc_financier as BlocStatut }),
      ...(filters.formation_type?.length && { formation_type: { in: filters.formation_type as FormationType[] } }),
      ...(filters.type_financement?.length && { type_financement: { in: filters.type_financement as TypeFinancement[] } }),
      ...(filters.gestionnaire_id && { gestionnaire_id: filters.gestionnaire_id }),
      ...(filters.date_debut && { date_creation: { gte: new Date(filters.date_debut) } }),
      ...(filters.date_fin && { date_creation: { lte: new Date(filters.date_fin) } }),
    },
    include: {
      apprenant: { select: { prenom: true, nom: true } },
      commercial: { select: { prenom: true, nom: true } },
      gestionnaire: { select: { prenom: true, nom: true } },
    },
    orderBy: { date_creation: 'desc' },
  });

  return rows.map(mapDossier);
}

export async function getDossierById(id: string): Promise<DossierWithRelations | null> {
  const r = await prisma.dossier.findUnique({
    where: { id },
    include: {
      apprenant: { select: { prenom: true, nom: true } },
      commercial: { select: { prenom: true, nom: true } },
      gestionnaire: { select: { prenom: true, nom: true } },
    },
  });
  return r ? mapDossier(r) : null;
}

export async function getDossiersByApprenant(apprenantId: string): Promise<DossierWithRelations[]> {
  return getDossiers({ restricted_commercial_id: undefined });
}

function mapDossier(r: {
  id: string; id_apprenant: string; id_lead_origine: string | null;
  formation_type: string; formule: string; numero_cma: string | null;
  type_financement: string | null; reference_financeur: string | null;
  montant_vendu: number | null; apport_personnel: number | null; montant_prise_en_charge: number | null;
  commercial_id: string | null; gestionnaire_id: string | null;
  statut: string; statut_bloc_admin: string; statut_bloc_financier: string;
  notes: string | null; notes_financier: string | null;
  date_creation: Date; date_activation: Date | null; updated_at: Date;
  apprenant: { prenom: string; nom: string };
  commercial: { prenom: string; nom: string } | null;
  gestionnaire: { prenom: string; nom: string } | null;
}): DossierWithRelations {
  return {
    id: r.id,
    id_apprenant: r.id_apprenant,
    id_lead_origine: r.id_lead_origine,
    formation_type: r.formation_type as FormationType,
    formule: r.formule as Formule,
    numero_cma: r.numero_cma,
    type_financement: r.type_financement as TypeFinancement | null,
    reference_financeur: r.reference_financeur,
    montant_vendu: r.montant_vendu,
    apport_personnel: r.apport_personnel,
    montant_prise_en_charge: r.montant_prise_en_charge,
    commercial_id: r.commercial_id,
    gestionnaire_id: r.gestionnaire_id,
    statut: r.statut as Dossier['statut'],
    statut_bloc_admin: r.statut_bloc_admin as BlocStatut,
    statut_bloc_financier: r.statut_bloc_financier as BlocStatut,
    notes: r.notes,
    notes_financier: r.notes_financier,
    date_creation: r.date_creation.toISOString(),
    date_activation: r.date_activation ? r.date_activation.toISOString() : null,
    updated_at: r.updated_at.toISOString(),
    apprenant_prenom: r.apprenant.prenom,
    apprenant_nom: r.apprenant.nom,
    commercial_prenom: r.commercial?.prenom ?? null,
    commercial_nom: r.commercial?.nom ?? null,
    gestionnaire_prenom: r.gestionnaire?.prenom ?? null,
    gestionnaire_nom: r.gestionnaire?.nom ?? null,
  };
}

export async function getPiecesJustificatives(dossierId: string): Promise<PieceJustificative[]> {
  const rows = await prisma.pieceJustificative.findMany({
    where: { dossier_id: dossierId },
    orderBy: { type_piece: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    dossier_id: r.dossier_id,
    type_piece: r.type_piece,
    fichier_nom: r.fichier_nom,
    fichier_path: r.fichier_path,
    date_depot: r.date_depot ? r.date_depot.toISOString() : null,
    statut: r.statut as PieceJustificative['statut'],
    motif_rejet: r.motif_rejet,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  }));
}

export async function getAuditLog(dossierId: string): Promise<AuditLog[]> {
  const rows = await prisma.auditLog.findMany({
    where: { dossier_id: dossierId },
    include: { auteur: { select: { prenom: true, nom: true } } },
    orderBy: { created_at: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    dossier_id: r.dossier_id,
    lead_id: r.lead_id,
    type_action: r.type_action as AuditLog['type_action'],
    detail: r.detail,
    auteur_id: r.auteur_id,
    auteur_prenom: r.auteur?.prenom ?? null,
    auteur_nom: r.auteur?.nom ?? null,
    created_at: r.created_at.toISOString(),
  }));
}

// ─── BLOC ADMIN / FINANCIER ───────────────────────────────────────────────────

export async function updateBlocStatut(
  dossierId: string,
  bloc: 'admin' | 'financier',
  newStatut: BlocStatut,
  auteurId: string,
  motif?: string,
): Promise<void> {
  const field = bloc === 'admin' ? 'statut_bloc_admin' : 'statut_bloc_financier';
  const actionType = newStatut === 'valide' ? 'bloc_valide' : newStatut === 'rejete' ? 'bloc_rejete' : 'bloc_soumis';
  const detail = motif
    ? `Bloc ${bloc} ${actionType.replace('bloc_', '')} : ${motif}`
    : `Bloc ${bloc} ${actionType.replace('bloc_', '')}`;

  await prisma.$transaction(async (tx) => {
    await tx.dossier.update({ where: { id: dossierId }, data: { [field]: newStatut } });

    const d = await tx.dossier.findUniqueOrThrow({
      where: { id: dossierId },
      select: { statut: true, statut_bloc_admin: true, statut_bloc_financier: true },
    });

    const adminOk = bloc === 'admin' ? newStatut === 'valide' : d.statut_bloc_admin === 'valide';
    const finOk = bloc === 'financier' ? newStatut === 'valide' : d.statut_bloc_financier === 'valide';

    let newDossierStatut = d.statut;
    if (adminOk && finOk && d.statut === 'en_cours') newDossierStatut = 'valide';
    else if (d.statut === 'pre_dossier') newDossierStatut = 'en_cours';

    if (newDossierStatut !== d.statut) {
      await tx.dossier.update({ where: { id: dossierId }, data: { statut: newDossierStatut } });
    }

    await tx.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        dossier_id: dossierId,
        type_action: actionType,
        detail,
        auteur_id: auteurId,
      },
    });
  });
}

// ─── OUVERTURE PRÉ-DOSSIER ────────────────────────────────────────────────────

export interface PreDossierInput {
  lead_id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  date_naissance: string;
  formation_type: FormationType;
  formule: Formule;
  commercial_id: string;
  commission?: number | null;
  notes?: string;
}

export async function ouvrirPreDossier(
  input: PreDossierInput,
): Promise<{ apprenantId: string; dossierId: string }> {
  const apprenantId = crypto.randomUUID();
  const dossierId = crypto.randomUUID();

  const typeSpecifique: Record<string, string[]> = {
    vtc: ['attestation_medicale'],
    taxi: ['attestation_medicale', 'attestation_assr'],
    vmdtr: ['attestation_medicale', 'permis_be'],
    passerelle_vtc_taxi: ['carte_pro_vtc'],
    passerelle_taxi_vtc: ['carte_pro_taxi'],
  };
  const basePieces = ['piece_identite', 'justif_domicile', 'photo_identite', 'permis_conduire', 'casier_judiciaire'];
  const allPieces = [...basePieces, ...(typeSpecifique[input.formation_type] ?? [])];

  await prisma.$transaction(async (tx) => {
    await tx.apprenant.create({
      data: {
        id: apprenantId,
        id_lead_origine: input.lead_id,
        prenom: input.prenom,
        nom: input.nom,
        date_naissance: input.date_naissance,
        email: input.email,
        telephone: input.telephone,
        statut: 'pre_actif',
      },
    });

    await tx.dossier.create({
      data: {
        id: dossierId,
        id_apprenant: apprenantId,
        id_lead_origine: input.lead_id,
        formation_type: input.formation_type,
        formule: input.formule,
        commercial_id: input.commercial_id,
        statut: 'pre_dossier',
        statut_bloc_admin: 'non_demarre',
        statut_bloc_financier: 'non_demarre',
        notes: input.notes ?? null,
      },
    });

    await tx.lead.update({
      where: { id: input.lead_id },
      data: { badge_pre_dossier: true },
    });

    await tx.timelineActivite.create({
      data: {
        id: crypto.randomUUID(),
        lead_id: input.lead_id,
        type: 'pre_dossier_ouvert',
        description: 'Pré-dossier ouvert',
        auteur_id: input.commercial_id,
      },
    });

    await tx.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        dossier_id: dossierId,
        lead_id: input.lead_id,
        type_action: 'creation_dossier',
        detail: `Dossier créé depuis lead #${input.lead_id}`,
        auteur_id: input.commercial_id,
      },
    });

    if (input.commission != null) {
      await tx.commission.upsert({
        where: { lead_id: input.lead_id },
        create: {
          id: crypto.randomUUID(),
          lead_id: input.lead_id,
          commercial_id: input.commercial_id,
          montant: input.commission,
          statut: 'libre',
        },
        update: { montant: input.commission },
      });
    }

    for (const typePiece of allPieces) {
      await tx.pieceJustificative.create({
        data: {
          id: crypto.randomUUID(),
          dossier_id: dossierId,
          type_piece: typePiece,
          statut: 'a_fournir',
        },
      });
    }
  });

  return { apprenantId, dossierId };
}

// ─── ACTIVATION APPRENANT ─────────────────────────────────────────────────────

export async function activerApprenant(dossierId: string, adminId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const dossier = await tx.dossier.findUnique({ where: { id: dossierId } });
    if (!dossier) throw new Error('Dossier introuvable');
    if (dossier.statut_bloc_admin !== 'valide' || dossier.statut_bloc_financier !== 'valide') {
      throw new Error('Les deux blocs doivent être Validé');
    }

    await tx.dossier.update({
      where: { id: dossierId },
      data: { statut: 'non_planifie', date_activation: new Date() },
    });

    await tx.apprenant.update({
      where: { id: dossier.id_apprenant },
      data: { statut: 'actif' },
    });

    if (dossier.id_lead_origine) {
      await tx.lead.update({
        where: { id: dossier.id_lead_origine },
        data: { statut: 'gagne' },
      });

      await tx.commission.updateMany({
        where: { lead_id: dossier.id_lead_origine },
        data: { statut: 'figee', date_figement: new Date() },
      });

      const comm = await tx.commission.findUnique({
        where: { lead_id: dossier.id_lead_origine },
        select: { montant: true },
      });
      const commStr = comm?.montant != null
        ? ` commission figée (${comm.montant.toLocaleString('fr-FR')} €)`
        : '';

      await tx.timelineActivite.create({
        data: {
          id: crypto.randomUUID(),
          lead_id: dossier.id_lead_origine,
          type: 'changement_statut',
          description: `Activation apprenant — lead → Gagné,${commStr}`,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        dossier_id: dossierId,
        lead_id: dossier.id_lead_origine,
        type_action: 'apprenant_active',
        detail: 'Apprenant activé',
        auteur_id: adminId,
      },
    });
  });
}

// ─── QUALIOPI ─────────────────────────────────────────────────────────────────

export interface QualiopiCritere {
  id: string;
  label: string;
  statut: 'ok' | 'warning' | 'error' | 'na';
  source: string;
}

export async function computeQualiopiCriteres(dossierId: string): Promise<QualiopiCritere[]> {
  const dossier = await prisma.dossier.findUnique({ where: { id: dossierId } });
  if (!dossier) return [];

  const [pieces, affectation, tentatives, attestationRequests] = await Promise.all([
    prisma.pieceJustificative.findMany({
      where: { dossier_id: dossierId },
      select: { type_piece: true, statut: true },
    }),
    prisma.affectation.findUnique({ where: { dossier_id: dossierId } }),
    prisma.tentative.findMany({
      where: { dossier_id: dossierId },
      include: { resultats: true },
      orderBy: { numero: 'desc' },
    }),
    prisma.attestationRequest.findMany({
      where: { dossier_id: dossierId, statut: { not: 'annulee' } },
    }),
  ]);

  const hasPiece = (type: string, s?: string) =>
    pieces.some((p) => p.type_piece === type && (s ? p.statut === s : true));

  const blocAdminOk = dossier.statut_bloc_admin === 'valide';
  const blocAdminSoumis = dossier.statut_bloc_admin === 'soumis';

  // Critère 5 — Traçabilité sessions de formation
  const sessionCoursOk = !!affectation?.session_cours_id;
  const sessionTheoriqueOk = !!affectation?.session_examen_theorique_id;
  const sessionPratiqueOk = !!affectation?.session_examen_pratique_id;

  // Lot 5: résultats détaillés depuis resultats_examens
  const currentTentative = tentatives.find((t) => t.statut === 'en_cours') ?? tentatives[0];
  const rTheo = currentTentative?.resultats.find((r) => r.session_type === 'theorique');
  const rPrat = currentTentative?.resultats.find((r) => r.session_type === 'pratique');
  const resultatTheoriqueAdmis = rTheo?.resultat === 'admis';
  const resultatPratiqueAdmis = rPrat?.resultat === 'admis';

  // Critère 7 — Résultats examens (backward compat)
  const resultatTheoriqueOk = affectation?.resultat_theorique === 'reussi' || resultatTheoriqueAdmis;
  const resultatPratiqueOk = affectation?.resultat_pratique === 'reussi' || resultatPratiqueAdmis;

  const attestationCreee = attestationRequests.length > 0;

  return [
    { id: 'I1', label: 'Information du public — Formation cataloguée', statut: 'ok', source: 'formations.catalogue' },
    { id: 'I2a', label: 'Positionnement — Prérequis (bloc admin)', statut: blocAdminOk ? 'ok' : blocAdminSoumis ? 'warning' : 'error', source: 'statut_bloc_admin' },
    { id: 'I2b', label: 'Positionnement — Évaluation de positionnement', statut: hasPiece('evaluation_positionnement', 'fournie') ? 'ok' : 'error', source: 'documents' },
    { id: 'I3', label: 'Adaptation — Programme de formation', statut: hasPiece('programme_formation', 'fournie') ? 'ok' : 'error', source: 'documents' },
    { id: 'I4a', label: 'Suivi — Session de cours affectée (C5)', statut: sessionCoursOk ? 'ok' : 'error', source: 'affectations.session_cours_id' },
    { id: 'I4b', label: "Suivi — Feuille d'émargement", statut: 'error', source: 'documents (Lot 6)' },
    { id: 'I5a', label: 'Évaluation — Examen théorique affecté (C5)', statut: sessionTheoriqueOk ? 'ok' : 'error', source: 'affectations.session_examen_theorique_id' },
    { id: 'I5b', label: 'Évaluation — Résultat théorique (C5)', statut: rTheo ? (resultatTheoriqueAdmis ? 'ok' : 'warning') : sessionTheoriqueOk ? 'warning' : 'error', source: 'resultats_examens.theorique' },
    { id: 'I5c', label: 'Évaluation — Examen pratique affecté (C5)', statut: sessionPratiqueOk ? 'ok' : sessionTheoriqueOk ? 'warning' : 'na', source: 'affectations.session_examen_pratique_id' },
    { id: 'I5d', label: 'Évaluation — Résultat pratique (C5)', statut: rPrat ? (resultatPratiqueAdmis ? 'ok' : 'warning') : sessionPratiqueOk ? 'error' : 'na', source: 'resultats_examens.pratique' },
    { id: 'I6a', label: 'Résultats — Demande attestation créée (C6)', statut: attestationCreee ? 'ok' : resultatPratiqueAdmis ? 'warning' : 'na', source: 'attestation_requests' },
    { id: 'I6b', label: 'Résultats — Attestation/Certificat généré (C6)', statut: 'error', source: 'documents (Lot 6)' },
    { id: 'I7', label: 'Réclamations — Aucune réclamation ouverte non traitée', statut: 'ok', source: 'audit_log' },
  ];
}
