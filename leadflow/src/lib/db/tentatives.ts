import { prisma } from './prisma';
import type {
  TentativeWithResultats,
  ResultatExamenDetailRow,
  AffectationWithApprenantAndTentative,
  TentativeStatut,
  StatutResultatExamen,
  SaisieResultat,
  SessionTypeExamen,
} from './types';

// ─── TENTATIVES ───────────────────────────────────────────────────────────────

export async function getTentativesByDossier(dossierId: string): Promise<TentativeWithResultats[]> {
  const rows = await prisma.tentative.findMany({
    where: { dossier_id: dossierId },
    include: {
      resultats: {
        include: { saisi_par: { select: { prenom: true, nom: true } } },
      },
      session_examen_theorique: { select: { date_examen: true, lieu: true } },
      session_examen_pratique: { select: { date_examen: true, lieu: true } },
    },
    orderBy: { numero: 'desc' },
  });

  return rows.map((t) => {
    const rTheo = t.resultats.find((r) => r.session_type === 'theorique') ?? null;
    const rPrat = t.resultats.find((r) => r.session_type === 'pratique') ?? null;
    return {
      id: t.id,
      dossier_id: t.dossier_id,
      numero: t.numero,
      statut: t.statut as TentativeStatut,
      session_examen_theorique_id: t.session_examen_theorique_id,
      session_examen_pratique_id: t.session_examen_pratique_id,
      date_cloture: t.date_cloture?.toISOString() ?? null,
      created_at: t.created_at.toISOString(),
      updated_at: t.updated_at.toISOString(),
      resultat_theorique: rTheo ? mapResultat(rTheo) : null,
      resultat_pratique: rPrat ? mapResultat(rPrat) : null,
      session_theorique_date: t.session_examen_theorique?.date_examen.toISOString() ?? null,
      session_theorique_lieu: t.session_examen_theorique?.lieu ?? null,
      session_pratique_date: t.session_examen_pratique?.date_examen.toISOString() ?? null,
      session_pratique_lieu: t.session_examen_pratique?.lieu ?? null,
    };
  });
}

export async function getCurrentTentative(dossierId: string) {
  return prisma.tentative.findFirst({
    where: { dossier_id: dossierId, statut: 'en_cours' },
    include: {
      resultats: true,
      session_examen_theorique: { select: { date_examen: true, lieu: true, jury_examinateur: true } },
      session_examen_pratique: { select: { date_examen: true, lieu: true, jury_examinateur: true } },
    },
    orderBy: { numero: 'desc' },
  });
}

export async function creerNouvelletentative(dossierId: string, auteurId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.tentative.findMany({
      where: { dossier_id: dossierId },
      orderBy: { numero: 'desc' },
    });

    const current = existing[0];
    if (!current || current.statut !== 'echouee') {
      throw new Error("Une nouvelle tentative ne peut être créée que si la tentative courante est échouée.");
    }

    const numero = current.numero + 1;
    const id = crypto.randomUUID();
    await tx.tentative.create({
      data: {
        id,
        dossier_id: dossierId,
        numero,
        statut: 'en_cours',
      },
    });

    await tx.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        dossier_id: dossierId,
        type_action: 'session_affectee',
        detail: `Tentative #${numero} créée — Qualiopi C5`,
        auteur_id: auteurId,
      },
    });

    return id;
  });
}

// ─── RÉSULTATS EXAMENS ────────────────────────────────────────────────────────

export interface SaisirResultatInput {
  dossier_id: string;
  tentative_id: string;
  session_type: SessionTypeExamen;
  session_id: string;
  resultat: SaisieResultat;
  score?: number;
  mention?: string;
  observations?: string;
  auteur_id: string;
}

export async function saisirResultatExamen(input: SaisirResultatInput): Promise<void> {
  const {
    dossier_id, tentative_id, session_type, session_id,
    resultat, score, mention, observations, auteur_id,
  } = input;

  await prisma.$transaction(async (tx) => {
    const tentative = await tx.tentative.findUniqueOrThrow({
      where: { id: tentative_id },
      include: { resultats: true },
    });

    if (tentative.statut !== 'en_cours') {
      throw new Error("Impossible de saisir un résultat sur une tentative clôturée.");
    }

    // RM-L5-03: pratique uniquement après theorique admis sur CETTE tentative
    if (session_type === 'pratique') {
      const rTheo = tentative.resultats.find((r) => r.session_type === 'theorique');
      if (!rTheo || rTheo.resultat !== 'admis') {
        throw new Error("L'examen pratique ne peut être saisi qu'après réussite de l'examen théorique sur cette tentative.");
      }
    }

    const now = new Date();
    const existing = tentative.resultats.find((r) => r.session_type === session_type);

    if (existing) {
      // RM-L5-07: only super_admin can modify closed session results — enforced at action layer
      await tx.resultatExamenDetail.update({
        where: { id: existing.id },
        data: {
          resultat,
          score: score ?? null,
          mention: mention ?? null,
          observations: observations ?? null,
          statut: 'reussi',
          saisi_par_id: auteur_id,
          saisi_le: now,
          updated_at: now,
        },
      });
    } else {
      await tx.resultatExamenDetail.create({
        data: {
          id: crypto.randomUUID(),
          dossier_id,
          tentative_id,
          session_type,
          session_id,
          statut: resultat === 'admis' ? 'reussi' : 'echoue',
          resultat,
          score: score ?? null,
          mention: mention ?? null,
          observations: observations ?? null,
          saisi_par_id: auteur_id,
          saisi_le: now,
        },
      });
    }

    // Sync backward-compat field on Affectation (for Qualiopi critere 5/7 computation)
    const affectationCompat = resultat === 'admis' ? 'reussi' : 'echoue';
    const affectField = session_type === 'theorique' ? 'resultat_theorique' : 'resultat_pratique';
    await tx.affectation.updateMany({
      where: { dossier_id },
      data: { [affectField]: affectationCompat },
    });

    // RM-L5-04: auto-close tentative
    let closeTentativeStatut: 'reussie' | 'echouee' | null = null;
    if (session_type === 'theorique' && resultat === 'refuse') {
      closeTentativeStatut = 'echouee';
    } else if (session_type === 'pratique') {
      closeTentativeStatut = resultat === 'admis' ? 'reussie' : 'echouee';
    }

    if (closeTentativeStatut) {
      await tx.tentative.update({
        where: { id: tentative_id },
        data: { statut: closeTentativeStatut, date_cloture: now },
      });
    }

    // RM-L5-09: attestation_request when pratique = admis
    if (session_type === 'pratique' && resultat === 'admis') {
      await tx.attestationRequest.create({
        data: {
          id: crypto.randomUUID(),
          dossier_id,
          tentative_id,
          statut: 'en_attente',
        },
      });
    }

    // RM-L5-10: audit log
    await tx.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        dossier_id,
        type_action: 'session_affectee',
        detail: `Résultat examen ${session_type} saisi: ${resultat}${score !== undefined ? ` score: ${score}` : ''} — Qualiopi C5/C6`,
        auteur_id,
      },
    });
  });
}

// ─── Transition statut session → convocations_envoyees ────────────────────────

export async function transitionnerSessionConvocations(
  sessionType: 'theorique' | 'pratique',
  sessionId: string,
  auteurId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Get all dossiers affectés à cette session
    const where =
      sessionType === 'theorique'
        ? { session_examen_theorique_id: sessionId }
        : { session_examen_pratique_id: sessionId };

    const affectations = await tx.affectation.findMany({ where, select: { dossier_id: true } });

    // Update session statut
    if (sessionType === 'theorique') {
      await tx.sessionExamenTheorique.update({
        where: { id: sessionId },
        data: { statut: 'convocations_envoyees' },
      });
    } else {
      await tx.sessionExamenPratique.update({
        where: { id: sessionId },
        data: { statut: 'convocations_envoyees' },
      });
    }

    // Create convocation_request for each candidat
    for (const { dossier_id } of affectations) {
      const tentative = await tx.tentative.findFirst({
        where: { dossier_id, statut: 'en_cours' },
        orderBy: { numero: 'desc' },
      });

      await tx.convocationRequest.create({
        data: {
          id: crypto.randomUUID(),
          dossier_id,
          tentative_id: tentative?.id ?? null,
          session_type: sessionType,
          session_id: sessionId,
          statut: 'en_attente',
        },
      });
    }

    await tx.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        type_action: 'session_affectee',
        detail: `Session ${sessionType} ${sessionId} → convocations_envoyees — ${affectations.length} convocation(s) créée(s)`,
        auteur_id: auteurId,
      },
    });
  });
}

// ─── Candidats pour un examen session (avec détail tentative) ─────────────────

export async function getAffectationsSessionWithTentative(
  sessionType: 'theorique' | 'pratique',
  sessionId: string,
): Promise<AffectationWithApprenantAndTentative[]> {
  const where =
    sessionType === 'theorique'
      ? { session_examen_theorique_id: sessionId }
      : { session_examen_pratique_id: sessionId };

  const rows = await prisma.affectation.findMany({
    where,
    include: {
      dossier: {
        include: {
          apprenant: { select: { prenom: true, nom: true, email: true } },
          tentatives: {
            where: { statut: 'en_cours' },
            include: {
              resultats: {
                where: { session_type: sessionType },
              },
            },
            orderBy: { numero: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  return rows.map((r) => {
    const tentative = r.dossier.tentatives[0] ?? null;
    const resultatDetail = tentative?.resultats[0] ?? null;
    return {
      id: r.id,
      dossier_id: r.dossier_id,
      session_cours_id: r.session_cours_id,
      session_edof_id: r.session_edof_id,
      session_examen_theorique_id: r.session_examen_theorique_id,
      session_examen_pratique_id: r.session_examen_pratique_id,
      resultat_theorique: r.resultat_theorique as import('./types').ResultatExamen | null,
      resultat_pratique: r.resultat_pratique as import('./types').ResultatExamen | null,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString(),
      apprenant_prenom: r.dossier.apprenant.prenom,
      apprenant_nom: r.dossier.apprenant.nom,
      apprenant_email: r.dossier.apprenant.email,
      dossier_formation_type: r.dossier.formation_type,
      dossier_statut: r.dossier.statut as import('./types').DossierStatut,
      tentative_id: tentative?.id ?? null,
      tentative_numero: tentative?.numero ?? null,
      tentative_statut: (tentative?.statut ?? null) as TentativeStatut | null,
      resultat_detail_statut: (resultatDetail?.statut ?? null) as StatutResultatExamen | null,
      resultat_detail_resultat: (resultatDetail?.resultat ?? null) as SaisieResultat | null,
      resultat_detail_score: resultatDetail?.score ? Number(resultatDetail.score) : null,
      resultat_detail_mention: resultatDetail?.mention ?? null,
    };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapResultat(r: {
  id: string;
  dossier_id: string;
  tentative_id: string;
  session_type: string;
  session_id: string;
  statut: string;
  resultat: string | null;
  score: unknown;
  mention: string | null;
  observations: string | null;
  saisi_par_id: string | null;
  saisi_par?: { prenom: string; nom: string } | null;
  saisi_le: Date | null;
  created_at: Date;
  updated_at: Date;
}): ResultatExamenDetailRow {
  return {
    id: r.id,
    dossier_id: r.dossier_id,
    tentative_id: r.tentative_id,
    session_type: r.session_type as SessionTypeExamen,
    session_id: r.session_id,
    statut: r.statut as StatutResultatExamen,
    resultat: (r.resultat ?? null) as SaisieResultat | null,
    score: r.score ? Number(r.score) : null,
    mention: r.mention,
    observations: r.observations,
    saisi_par_id: r.saisi_par_id,
    saisi_par_prenom: r.saisi_par?.prenom ?? null,
    saisi_par_nom: r.saisi_par?.nom ?? null,
    saisi_le: r.saisi_le?.toISOString() ?? null,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}
