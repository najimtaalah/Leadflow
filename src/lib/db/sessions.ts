import { prisma } from './prisma';
import type {
  SessionCours, SessionCoursWithCount,
  SessionEdof, SessionEdofWithCount,
  SessionExamenTheorique, SessionExamenTheoriqueWithCount,
  SessionExamenPratique, SessionExamenPratiqueWithCount,
  Affectation, AffectationWithApprenant,
  SessionStatut, TypePresence, SessionEdofStatut, ResultatExamen,
} from './types';

// ─── SESSIONS COURS ───────────────────────────────────────────────────────────

export async function getSessionsCours(): Promise<SessionCoursWithCount[]> {
  const rows = await prisma.sessionCours.findMany({
    include: { _count: { select: { affectations: true } } },
    orderBy: { date_debut: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    titre: r.titre,
    date_debut: r.date_debut.toISOString(),
    date_fin: r.date_fin.toISOString(),
    type_presence: r.type_presence as TypePresence,
    lieu: r.lieu,
    formateur: r.formateur,
    capacite_max: r.capacite_max,
    statut: r.statut as SessionStatut,
    notes: r.notes,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    nb_affectations: r._count.affectations,
  }));
}

export async function getSessionCoursById(id: string): Promise<SessionCoursWithCount | null> {
  const r = await prisma.sessionCours.findUnique({
    where: { id },
    include: { _count: { select: { affectations: true } } },
  });
  if (!r) return null;
  return {
    id: r.id,
    titre: r.titre,
    date_debut: r.date_debut.toISOString(),
    date_fin: r.date_fin.toISOString(),
    type_presence: r.type_presence as TypePresence,
    lieu: r.lieu,
    formateur: r.formateur,
    capacite_max: r.capacite_max,
    statut: r.statut as SessionStatut,
    notes: r.notes,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    nb_affectations: r._count.affectations,
  };
}

export interface CreateSessionCoursInput {
  titre: string;
  date_debut: string;
  date_fin: string;
  type_presence: TypePresence;
  lieu?: string;
  formateur?: string;
  capacite_max?: number;
  notes?: string;
}

export async function createSessionCours(input: CreateSessionCoursInput): Promise<string> {
  const id = crypto.randomUUID();
  await prisma.sessionCours.create({
    data: {
      id,
      titre: input.titre,
      date_debut: new Date(input.date_debut),
      date_fin: new Date(input.date_fin),
      type_presence: input.type_presence,
      lieu: input.lieu ?? null,
      formateur: input.formateur ?? null,
      capacite_max: input.capacite_max ?? 20,
      notes: input.notes ?? null,
    },
  });
  return id;
}

// ─── SESSIONS EDOF ────────────────────────────────────────────────────────────

export async function getSessionsEdof(): Promise<SessionEdofWithCount[]> {
  const rows = await prisma.sessionEdof.findMany({
    include: { _count: { select: { affectations: true } } },
    orderBy: { date_debut: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    reference_edof: r.reference_edof,
    date_debut: r.date_debut.toISOString(),
    date_fin: r.date_fin.toISOString(),
    date_fin_cpf: r.date_fin_cpf ? r.date_fin_cpf.toISOString() : null,
    capacite_max: r.capacite_max,
    statut: r.statut as SessionEdofStatut,
    notes: r.notes,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    nb_affectations: r._count.affectations,
  }));
}

export async function getSessionEdofById(id: string): Promise<SessionEdofWithCount | null> {
  const r = await prisma.sessionEdof.findUnique({
    where: { id },
    include: { _count: { select: { affectations: true } } },
  });
  if (!r) return null;
  return {
    id: r.id,
    reference_edof: r.reference_edof,
    date_debut: r.date_debut.toISOString(),
    date_fin: r.date_fin.toISOString(),
    date_fin_cpf: r.date_fin_cpf ? r.date_fin_cpf.toISOString() : null,
    capacite_max: r.capacite_max,
    statut: r.statut as SessionEdofStatut,
    notes: r.notes,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    nb_affectations: r._count.affectations,
  };
}

export interface CreateSessionEdofInput {
  reference_edof?: string;
  date_debut: string;
  date_fin: string;
  date_fin_cpf?: string;
  capacite_max?: number;
  notes?: string;
}

export async function createSessionEdof(input: CreateSessionEdofInput): Promise<string> {
  const id = crypto.randomUUID();
  await prisma.sessionEdof.create({
    data: {
      id,
      reference_edof: input.reference_edof ?? null,
      date_debut: new Date(input.date_debut),
      date_fin: new Date(input.date_fin),
      date_fin_cpf: input.date_fin_cpf ? new Date(input.date_fin_cpf) : null,
      capacite_max: input.capacite_max ?? 20,
      notes: input.notes ?? null,
    },
  });
  return id;
}

// ─── SESSIONS EXAMENS THÉORIQUES ─────────────────────────────────────────────

export async function getSessionsExamensTheoriques(): Promise<SessionExamenTheoriqueWithCount[]> {
  const rows = await prisma.sessionExamenTheorique.findMany({
    include: { _count: { select: { affectations: true } } },
    orderBy: { date_examen: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    date_examen: r.date_examen.toISOString(),
    lieu: r.lieu,
    organisme: r.organisme,
    capacite_max: r.capacite_max,
    statut: r.statut as SessionStatut,
    notes: r.notes,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    nb_affectations: r._count.affectations,
  }));
}

export async function getSessionExamenTheoriqueById(id: string): Promise<SessionExamenTheoriqueWithCount | null> {
  const r = await prisma.sessionExamenTheorique.findUnique({
    where: { id },
    include: { _count: { select: { affectations: true } } },
  });
  if (!r) return null;
  return {
    id: r.id,
    date_examen: r.date_examen.toISOString(),
    lieu: r.lieu,
    organisme: r.organisme,
    capacite_max: r.capacite_max,
    statut: r.statut as SessionStatut,
    notes: r.notes,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    nb_affectations: r._count.affectations,
  };
}

export interface CreateSessionExamenTheoriqueInput {
  date_examen: string;
  lieu?: string;
  organisme?: string;
  capacite_max?: number;
  notes?: string;
}

export async function createSessionExamenTheorique(input: CreateSessionExamenTheoriqueInput): Promise<string> {
  const id = crypto.randomUUID();
  await prisma.sessionExamenTheorique.create({
    data: {
      id,
      date_examen: new Date(input.date_examen),
      lieu: input.lieu ?? null,
      organisme: input.organisme ?? null,
      capacite_max: input.capacite_max ?? 30,
      notes: input.notes ?? null,
    },
  });
  return id;
}

// ─── SESSIONS EXAMENS PRATIQUES ──────────────────────────────────────────────

export async function getSessionsExamensPratiques(): Promise<SessionExamenPratiqueWithCount[]> {
  const rows = await prisma.sessionExamenPratique.findMany({
    include: { _count: { select: { affectations: true } } },
    orderBy: { date_examen: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    date_examen: r.date_examen.toISOString(),
    lieu: r.lieu,
    organisme: r.organisme,
    capacite_max: r.capacite_max,
    statut: r.statut as SessionStatut,
    notes: r.notes,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    nb_affectations: r._count.affectations,
  }));
}

export async function getSessionExamenPratiqueById(id: string): Promise<SessionExamenPratiqueWithCount | null> {
  const r = await prisma.sessionExamenPratique.findUnique({
    where: { id },
    include: { _count: { select: { affectations: true } } },
  });
  if (!r) return null;
  return {
    id: r.id,
    date_examen: r.date_examen.toISOString(),
    lieu: r.lieu,
    organisme: r.organisme,
    capacite_max: r.capacite_max,
    statut: r.statut as SessionStatut,
    notes: r.notes,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    nb_affectations: r._count.affectations,
  };
}

export interface CreateSessionExamenPratiqueInput {
  date_examen: string;
  lieu?: string;
  organisme?: string;
  capacite_max?: number;
  notes?: string;
}

export async function createSessionExamenPratique(input: CreateSessionExamenPratiqueInput): Promise<string> {
  const id = crypto.randomUUID();
  await prisma.sessionExamenPratique.create({
    data: {
      id,
      date_examen: new Date(input.date_examen),
      lieu: input.lieu ?? null,
      organisme: input.organisme ?? null,
      capacite_max: input.capacite_max ?? 10,
      notes: input.notes ?? null,
    },
  });
  return id;
}

// ─── AFFECTATIONS ─────────────────────────────────────────────────────────────

export async function getAffectationsBySession(
  type: 'cours' | 'edof' | 'theorique' | 'pratique',
  sessionId: string,
): Promise<AffectationWithApprenant[]> {
  const where =
    type === 'cours'     ? { session_cours_id: sessionId }
    : type === 'edof'    ? { session_edof_id: sessionId }
    : type === 'theorique' ? { session_examen_theorique_id: sessionId }
    : { session_examen_pratique_id: sessionId };

  const rows = await prisma.affectation.findMany({
    where,
    include: {
      dossier: {
        include: {
          apprenant: { select: { prenom: true, nom: true, email: true } },
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  return rows.map((r) => ({
    id: r.id,
    dossier_id: r.dossier_id,
    session_cours_id: r.session_cours_id,
    session_edof_id: r.session_edof_id,
    session_examen_theorique_id: r.session_examen_theorique_id,
    session_examen_pratique_id: r.session_examen_pratique_id,
    resultat_theorique: r.resultat_theorique as ResultatExamen | null,
    resultat_pratique: r.resultat_pratique as ResultatExamen | null,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    apprenant_prenom: r.dossier.apprenant.prenom,
    apprenant_nom: r.dossier.apprenant.nom,
    apprenant_email: r.dossier.apprenant.email,
    dossier_formation_type: r.dossier.formation_type,
    dossier_statut: r.dossier.statut as import('./types').DossierStatut,
  }));
}

export async function getAffectationByDossier(dossierId: string): Promise<Affectation | null> {
  const r = await prisma.affectation.findUnique({ where: { dossier_id: dossierId } });
  if (!r) return null;
  return {
    id: r.id,
    dossier_id: r.dossier_id,
    session_cours_id: r.session_cours_id,
    session_edof_id: r.session_edof_id,
    session_examen_theorique_id: r.session_examen_theorique_id,
    session_examen_pratique_id: r.session_examen_pratique_id,
    resultat_theorique: r.resultat_theorique as ResultatExamen | null,
    resultat_pratique: r.resultat_pratique as ResultatExamen | null,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}

export interface AffecterSessionInput {
  dossier_id: string;
  session_type: 'cours' | 'edof' | 'theorique' | 'pratique';
  session_id: string;
  auteur_id: string;
}

// RM-L4-07: vérification capacité ; RM-L4-05: examen pratique après théorie réussie
// RM-L4-04: dossier → Planifié si cours + EDOF affectés (CPF)
// RM-L4-06: Qualiopi critères 5 & 7 enregistrés via audit_log
export async function affecterSession(input: AffecterSessionInput): Promise<void> {
  const { dossier_id, session_type, session_id, auteur_id } = input;

  await prisma.$transaction(async (tx) => {
    const dossier = await tx.dossier.findUniqueOrThrow({
      where: { id: dossier_id },
      select: { statut: true, type_financement: true },
    });

    // RM-L4-05: examen pratique uniquement après théorie réussie
    if (session_type === 'pratique') {
      const affectation = await tx.affectation.findUnique({ where: { dossier_id } });
      if (!affectation?.resultat_theorique || affectation.resultat_theorique !== 'reussi') {
        throw new Error("L'apprenant doit avoir réussi l'examen théorique avant d'être affecté à un examen pratique.");
      }
    }

    // RM-L4-07: vérifier capacité disponible
    const capaciteOk = await checkCapacite(tx, session_type, session_id);
    if (!capaciteOk) {
      throw new Error('La session a atteint sa capacité maximale.');
    }

    const sessionField =
      session_type === 'cours'     ? 'session_cours_id'
      : session_type === 'edof'    ? 'session_edof_id'
      : session_type === 'theorique' ? 'session_examen_theorique_id'
      : 'session_examen_pratique_id';

    // Upsert affectation (one row per dossier)
    const existing = await tx.affectation.findUnique({ where: { dossier_id } });
    if (existing) {
      await tx.affectation.update({
        where: { dossier_id },
        data: { [sessionField]: session_id },
      });
    } else {
      await tx.affectation.create({
        data: {
          id: crypto.randomUUID(),
          dossier_id,
          [sessionField]: session_id,
        },
      });
    }

    // RM-L4-04: dossier → "planifie" quand cours + EDOF affectés (si CPF)
    const updated = await tx.affectation.findUniqueOrThrow({ where: { dossier_id } });
    const isCpf = dossier.type_financement === 'cpf';
    const coursOk = !!updated.session_cours_id;
    const edofOk = !!updated.session_edof_id;
    const shouldPlanifier = coursOk && (edofOk || !isCpf);

    if (shouldPlanifier && (dossier.statut === 'non_planifie' || dossier.statut === 'valide')) {
      await tx.dossier.update({
        where: { id: dossier_id },
        data: { statut: 'planifie' },
      });
    }

    // RM-L4-06: audit log pour traçabilité Qualiopi 5 & 7
    await tx.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        dossier_id,
        type_action: 'session_affectee',
        detail: `Session ${session_type} affectée (id: ${session_id}) — Qualiopi C5/C7`,
        auteur_id,
      },
    });
  });
}

export async function setResultatExamen(
  dossier_id: string,
  type: 'theorique' | 'pratique',
  resultat: ResultatExamen,
  auteur_id: string,
): Promise<void> {
  const field = type === 'theorique' ? 'resultat_theorique' : 'resultat_pratique';

  await prisma.$transaction(async (tx) => {
    const existing = await tx.affectation.findUnique({ where: { dossier_id } });
    if (!existing) throw new Error('Aucune affectation trouvée pour ce dossier.');

    if (type === 'pratique' && existing.resultat_theorique !== 'reussi') {
      throw new Error("L'examen pratique ne peut être saisi qu'après réussite de l'examen théorique.");
    }

    await tx.affectation.update({
      where: { dossier_id },
      data: { [field]: resultat },
    });

    await tx.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        dossier_id,
        type_action: 'session_affectee',
        detail: `Résultat examen ${type}: ${resultat} — Qualiopi C7`,
        auteur_id,
      },
    });
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function checkCapacite(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  type: 'cours' | 'edof' | 'theorique' | 'pratique',
  sessionId: string,
): Promise<boolean> {
  if (type === 'cours') {
    const session = await tx.sessionCours.findUniqueOrThrow({ where: { id: sessionId }, select: { capacite_max: true } });
    const count = await tx.affectation.count({ where: { session_cours_id: sessionId } });
    return count < session.capacite_max;
  }
  if (type === 'edof') {
    const session = await tx.sessionEdof.findUniqueOrThrow({ where: { id: sessionId }, select: { capacite_max: true } });
    const count = await tx.affectation.count({ where: { session_edof_id: sessionId } });
    return count < session.capacite_max;
  }
  if (type === 'theorique') {
    const session = await tx.sessionExamenTheorique.findUniqueOrThrow({ where: { id: sessionId }, select: { capacite_max: true } });
    const count = await tx.affectation.count({ where: { session_examen_theorique_id: sessionId } });
    return count < session.capacite_max;
  }
  const session = await tx.sessionExamenPratique.findUniqueOrThrow({ where: { id: sessionId }, select: { capacite_max: true } });
  const count = await tx.affectation.count({ where: { session_examen_pratique_id: sessionId } });
  return count < session.capacite_max;
}
