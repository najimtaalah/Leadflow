import { prisma } from './prisma';
import type {
  QualiopiConformite,
  QualiopiCritereStatut,
  QualiopiCouleur,
  QualiopiHistoriqueRow,
} from './types';

// ─── Compute conformité Qualiopi (7 critères) ─────────────────────────────────

export async function computeQualiopiConformite(dossierId: string): Promise<QualiopiConformite> {
  const [dossier, affectation, tentatives, documents, auditLogs] = await Promise.all([
    prisma.dossier.findUnique({ where: { id: dossierId } }),
    prisma.affectation.findUnique({ where: { dossier_id: dossierId } }),
    prisma.tentative.findMany({
      where: { dossier_id: dossierId },
      include: { resultats: true },
      orderBy: { numero: 'desc' },
    }),
    prisma.documentDossier.findMany({ where: { dossier_id: dossierId } }),
    prisma.auditLog.findMany({
      where: { dossier_id: dossierId },
      orderBy: { created_at: 'desc' },
    }),
  ]);

  if (!dossier) {
    return { criteres: [], taux_numerateur: 0, taux_denominateur: 0, taux_pourcent: 0 };
  }

  const estCPF = dossier.type_financement === 'cpf';
  const docMap = new Map(documents.map((d) => [d.type_document, d]));

  const hasDoc = (type: string) => {
    const d = docMap.get(type as never);
    return d?.statut === 'genere' || d?.statut === 'signe';
  };

  const currentTentative = tentatives.find((t) => t.statut === 'en_cours') ?? tentatives[0];
  const rTheo = currentTentative?.resultats.find((r) => r.session_type === 'theorique');
  const rPrat = currentTentative?.resultats.find((r) => r.session_type === 'pratique');
  const theorique_admis = rTheo?.resultat === 'admis';
  const pratique_admis = rPrat?.resultat === 'admis';
  const examResultSaisi = !!rTheo;

  const sessionCoursId = affectation?.session_cours_id;
  const sessionEdofId = affectation?.session_edof_id;
  const sessionTheoId = affectation?.session_examen_theorique_id;
  const sessionPratId = affectation?.session_examen_pratique_id;

  const blocAdminValide = dossier.statut_bloc_admin === 'valide';
  const objectifRenseigne = !!dossier.objectif_formation?.trim();
  const evalPreRenseignee = !!dossier.evaluation_pre_formation?.trim();

  const incidentLogs = auditLogs.filter((l) => l.type_action === 'reclamation');
  const hasIncidentOuvert = incidentLogs.some((l) => l.detail?.includes('en_cours'));
  const hasIncidentTraite = incidentLogs.some((l) => !l.detail?.includes('en_cours'));

  // ─── Critère 1 — Besoin & objectif ──────────────────────────────────────────
  let c1: QualiopiCouleur;
  if (blocAdminValide && objectifRenseigne) c1 = 'vert';
  else if (blocAdminValide && !objectifRenseigne) c1 = 'orange';
  else c1 = 'rouge';

  const critere1: QualiopiCritereStatut = {
    num: 1,
    couleur: c1,
    preuves: [
      {
        label: 'Bloc admin validé',
        statut: blocAdminValide ? 'presente' : 'manquante',
        lien_type: 'dossier',
        lien_id: dossierId,
      },
      {
        label: 'Objectif de formation renseigné',
        statut: objectifRenseigne ? 'presente' : 'manquante',
        lien_type: 'dossier',
        lien_id: dossierId,
      },
    ],
  };

  // ─── Critère 2 — Positionnement ──────────────────────────────────────────────
  let c2: QualiopiCouleur;
  if (evalPreRenseignee) c2 = 'vert';
  else if (blocAdminValide) c2 = 'orange';
  else c2 = 'rouge';

  const critere2: QualiopiCritereStatut = {
    num: 2,
    couleur: c2,
    preuves: [
      {
        label: 'Évaluation pré-formation renseignée',
        statut: evalPreRenseignee ? 'presente' : 'manquante',
        lien_type: 'dossier',
        lien_id: dossierId,
      },
    ],
  };

  // ─── Critère 3 — Adaptation ───────────────────────────────────────────────────
  let c3: QualiopiCouleur;
  if (hasDoc('contrat_formation')) c3 = 'vert';
  else if (sessionCoursId) c3 = 'orange';
  else c3 = 'rouge';

  const critere3: QualiopiCritereStatut = {
    num: 3,
    couleur: c3,
    preuves: [
      {
        label: 'Contrat de formation généré',
        statut: hasDoc('contrat_formation') ? 'presente' : sessionCoursId ? 'partielle' : 'manquante',
        lien_type: 'document',
        lien_id: 'contrat_formation',
      },
    ],
  };

  // ─── Critère 4 — Suivi exécution ─────────────────────────────────────────────
  let c4: QualiopiCouleur;
  if (!sessionCoursId) c4 = 'rouge';
  else if (hasDoc('emargement') && (!estCPF || sessionEdofId)) c4 = 'vert';
  else if (!hasDoc('emargement')) c4 = 'orange';
  else c4 = 'orange'; // CPF sans EDOF

  const critere4: QualiopiCritereStatut = {
    num: 4,
    couleur: c4,
    preuves: [
      {
        label: "Émargement généré",
        statut: hasDoc('emargement') ? 'presente' : sessionCoursId ? 'manquante' : 'non_applicable',
        lien_type: 'document',
        lien_id: 'emargement',
      },
      ...(estCPF ? [{
        label: 'Session EDOF affectée',
        statut: (sessionEdofId ? 'presente' : 'manquante') as 'presente' | 'manquante' | 'partielle' | 'non_applicable',
        lien_type: 'session_edof',
        lien_id: sessionEdofId ?? undefined,
      }] : []),
    ],
  };

  // ─── Critère 5 — Évaluation des acquis ───────────────────────────────────────
  let c5: QualiopiCouleur;
  if (!sessionTheoId) c5 = 'rouge';
  else if (examResultSaisi) c5 = 'vert';
  else c5 = 'orange';

  const critere5: QualiopiCritereStatut = {
    num: 5,
    couleur: c5,
    preuves: [
      {
        label: 'Session examen théorique affectée',
        statut: sessionTheoId ? 'presente' : 'manquante',
        lien_type: 'session_examen_theo',
        lien_id: sessionTheoId ?? undefined,
      },
      {
        label: 'Résultat examen saisi',
        statut: examResultSaisi ? 'presente' : sessionTheoId ? 'manquante' : 'non_applicable',
        lien_type: 'tentative',
        lien_id: currentTentative?.id,
      },
    ],
  };

  // ─── Critère 6 — Résultats ────────────────────────────────────────────────────
  const hasAttestation = hasDoc('attestation_formation');
  const hasCertificat = hasDoc('certificat');
  let c6: QualiopiCouleur;
  if (hasAttestation || hasCertificat) c6 = 'vert';
  else if (sessionCoursId || practique_admis_or_theo_admis(theorique_admis, pratique_admis)) c6 = 'orange';
  else c6 = 'rouge';

  const critere6: QualiopiCritereStatut = {
    num: 6,
    couleur: c6,
    preuves: [
      {
        label: 'Attestation de formation générée',
        statut: hasAttestation ? 'presente' : sessionCoursId ? 'manquante' : 'non_applicable',
        lien_type: 'document',
        lien_id: 'attestation_formation',
      },
      {
        label: 'Certificat généré (si examen réussi)',
        statut: hasCertificat ? 'presente' : (theorique_admis || pratique_admis) ? 'manquante' : 'non_applicable',
        lien_type: 'document',
        lien_id: 'certificat',
      },
    ],
  };

  // ─── Critère 7 — Réclamations ─────────────────────────────────────────────────
  let c7: QualiopiCouleur;
  if (incidentLogs.length === 0) c7 = 'vert'; // aucun incident = normal
  else if (hasIncidentOuvert) c7 = 'rouge';
  else if (hasIncidentTraite) c7 = 'vert';
  else c7 = 'orange';

  const critere7: QualiopiCritereStatut = {
    num: 7,
    couleur: c7,
    preuves: [
      {
        label: 'Incidents tracés dans le journal d\'audit',
        statut: incidentLogs.length === 0
          ? 'non_applicable'
          : hasIncidentTraite
            ? 'presente'
            : 'partielle',
      },
    ],
  };

  const criteres = [critere1, critere2, critere3, critere4, critere5, critere6, critere7];

  // Critère 7 entre dans le dénominateur seulement si incidents présents
  const applicable = criteres.filter((c) =>
    c.num !== 7 || incidentLogs.length > 0
  );
  const numerateur = applicable.filter((c) => c.couleur === 'vert').length;
  const denominateur = applicable.length;
  const taux_pourcent = denominateur > 0 ? Math.round((numerateur / denominateur) * 100) : 0;

  return { criteres, taux_numerateur: numerateur, taux_denominateur: denominateur, taux_pourcent };
}

function practique_admis_or_theo_admis(theo: boolean, prat: boolean) {
  return theo || prat;
}

// ─── Historique ────────────────────────────────────────────────────────────────

export async function getQualiopiHistorique(
  dossierId: string,
  critereNum?: number,
): Promise<QualiopiHistoriqueRow[]> {
  const rows = await prisma.qualiopiHistorique.findMany({
    where: {
      dossier_id: dossierId,
      ...(critereNum ? { critere_num: critereNum } : {}),
    },
    include: { acteur: { select: { prenom: true, nom: true } } },
    orderBy: { created_at: 'desc' },
    take: 50,
  });

  return rows.map((r) => ({
    id: r.id,
    dossier_id: r.dossier_id,
    critere_num: r.critere_num,
    statut_avant: r.statut_avant as QualiopiCouleur,
    statut_apres: r.statut_apres as QualiopiCouleur,
    declencheur_type: r.declencheur_type as QualiopiHistoriqueRow['declencheur_type'],
    declencheur_id: r.declencheur_id,
    acteur_id: r.acteur_id,
    acteur_prenom: r.acteur?.prenom ?? null,
    acteur_nom: r.acteur?.nom ?? null,
    note: r.note,
    created_at: r.created_at.toISOString(),
  }));
}
