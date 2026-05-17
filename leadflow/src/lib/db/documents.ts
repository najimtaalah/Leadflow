import { prisma } from './prisma';
import type {
  DocumentDossier,
  TypeDocument,
  SourceTypeDocument,
  StatutDocument,
} from './types';

// ─── Source mapping ────────────────────────────────────────────────────────────

export const DOCUMENT_SOURCE_MAP: Record<TypeDocument, SourceTypeDocument> = {
  convocation_formation:    'session_cours',
  contrat_formation:        'session_cours',
  emargement:               'session_cours',
  attestation_formation:    'session_cours',
  certificat:               'session_examen_theo',
  facture:                  'dossier',
  convocation_examen_theo:  'session_examen_theo',
  convocation_examen_prat:  'session_examen_prat',
};

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getDocumentsByDossier(dossierId: string): Promise<DocumentDossier[]> {
  const rows = await prisma.documentDossier.findMany({
    where: { dossier_id: dossierId },
    include: {
      genere_par: { select: { prenom: true, nom: true } },
      signe_par:  { select: { prenom: true, nom: true } },
    },
    orderBy: { type_document: 'asc' },
  });

  return rows.map(mapDocument);
}

export async function getDocumentByType(
  dossierId: string,
  typeDocument: TypeDocument,
): Promise<DocumentDossier | null> {
  const row = await prisma.documentDossier.findUnique({
    where: { dossier_id_type_document: { dossier_id: dossierId, type_document: typeDocument } },
    include: {
      genere_par: { select: { prenom: true, nom: true } },
      signe_par:  { select: { prenom: true, nom: true } },
    },
  });
  return row ? mapDocument(row) : null;
}

// ─── Compute liste documents avec statut dynamique ────────────────────────────

export interface DocumentStatus {
  type_document: TypeDocument;
  source_type: SourceTypeDocument;
  source_id: string | null;
  statut: StatutDocument;
  document: DocumentDossier | null;
  raison_bloque: string | null;
}

export async function computeDocumentsList(dossierId: string): Promise<DocumentStatus[]> {
  const [dossier, affectation, tentatives, documents] = await Promise.all([
    prisma.dossier.findUnique({ where: { id: dossierId } }),
    prisma.affectation.findUnique({ where: { dossier_id: dossierId } }),
    prisma.tentative.findMany({
      where: { dossier_id: dossierId },
      include: { resultats: true },
      orderBy: { numero: 'desc' },
    }),
    getDocumentsByDossier(dossierId),
  ]);

  if (!dossier) return [];

  const docMap = new Map(documents.map((d) => [d.type_document, d]));

  const estCPF = dossier.type_financement === 'cpf';
  const sessionCoursId = affectation?.session_cours_id ?? null;
  const sessionEdofId = affectation?.session_edof_id ?? null;
  const sessionTheoId = affectation?.session_examen_theorique_id ?? null;
  const sessionPratId = affectation?.session_examen_pratique_id ?? null;

  const currentTentative = tentatives.find((t) => t.statut === 'en_cours') ?? tentatives[0];
  const rTheo = currentTentative?.resultats.find((r) => r.session_type === 'theorique');
  const rPrat = currentTentative?.resultats.find((r) => r.session_type === 'pratique');
  const examReussi = rTheo?.resultat === 'admis' || rPrat?.resultat === 'admis';

  const blocFinancierValide = dossier.statut_bloc_financier === 'valide';

  // For CPF: check if EDOF has reference_edof
  let edofNumeroOk = true;
  if (estCPF && sessionEdofId) {
    const edof = await prisma.sessionEdof.findUnique({
      where: { id: sessionEdofId },
      select: { reference_edof: true },
    });
    edofNumeroOk = !!edof?.reference_edof;
  }

  function computeStatut(type: TypeDocument): { statut: StatutDocument; raison: string | null; sourceId: string | null } {
    const existing = docMap.get(type);
    if (existing && (existing.statut === 'genere' || existing.statut === 'signe')) {
      return { statut: existing.statut, raison: null, sourceId: existing.source_id };
    }

    if (estCPF && !edofNumeroOk && type !== 'convocation_examen_theo' && type !== 'convocation_examen_prat') {
      return { statut: 'bloque', raison: 'Numéro EDOF manquant — saisir sur la fiche session EDOF', sourceId: sessionEdofId };
    }

    switch (type) {
      case 'convocation_formation':
        if (!sessionCoursId) return { statut: 'bloque', raison: 'Aucune session de cours affectée', sourceId: null };
        return { statut: 'non_genere', raison: null, sourceId: sessionCoursId };

      case 'contrat_formation':
        if (!sessionCoursId) return { statut: 'bloque', raison: 'Aucune session de cours affectée', sourceId: null };
        if (!blocFinancierValide) return { statut: 'en_attente', raison: 'Bloc financier non encore validé', sourceId: sessionCoursId };
        return { statut: 'non_genere', raison: null, sourceId: sessionCoursId };

      case 'emargement':
        if (!sessionCoursId) return { statut: 'bloque', raison: 'Aucune session de cours affectée', sourceId: null };
        return { statut: 'en_attente', raison: 'Générable dès démarrage de la session', sourceId: sessionCoursId };

      case 'attestation_formation':
        if (!sessionCoursId) return { statut: 'bloque', raison: 'Aucune session de cours affectée', sourceId: null };
        return { statut: 'en_attente', raison: 'Générable après fin de session', sourceId: sessionCoursId };

      case 'certificat':
        if (!examReussi) return { statut: 'bloque', raison: "Examen non réussi — certificat non applicable", sourceId: null };
        return { statut: 'non_genere', raison: null, sourceId: currentTentative?.session_examen_theorique_id ?? sessionTheoId };

      case 'facture':
        if (!blocFinancierValide) return { statut: 'bloque', raison: 'Bloc financier non validé par Admin', sourceId: null };
        return { statut: 'non_genere', raison: null, sourceId: dossierId };

      case 'convocation_examen_theo':
        if (!sessionTheoId) return { statut: 'bloque', raison: 'Aucune session examen théorique affectée', sourceId: null };
        return { statut: 'non_genere', raison: null, sourceId: sessionTheoId };

      case 'convocation_examen_prat':
        if (!sessionPratId) return { statut: 'bloque', raison: 'Aucune session examen pratique affectée', sourceId: null };
        return { statut: 'non_genere', raison: null, sourceId: sessionPratId };

      default:
        return { statut: 'bloque', raison: 'Type inconnu', sourceId: null };
    }
  }

  const allTypes: TypeDocument[] = [
    'convocation_formation',
    'contrat_formation',
    'emargement',
    'attestation_formation',
    'certificat',
    'facture',
    'convocation_examen_theo',
    'convocation_examen_prat',
  ];

  return allTypes.map((type) => {
    const { statut, raison, sourceId } = computeStatut(type);
    const existing = docMap.get(type) ?? null;
    return {
      type_document: type,
      source_type: DOCUMENT_SOURCE_MAP[type],
      source_id: sourceId,
      statut: existing ? existing.statut : statut,
      document: existing,
      raison_bloque: raison,
    };
  });
}

// ─── Write ─────────────────────────────────────────────────────────────────────

export async function genererDocument(
  dossierId: string,
  typeDocument: TypeDocument,
  auteurId: string,
): Promise<DocumentDossier> {
  const sourceType = DOCUMENT_SOURCE_MAP[typeDocument];
  const list = await computeDocumentsList(dossierId);
  const item = list.find((d) => d.type_document === typeDocument);

  if (!item || item.statut === 'bloque') {
    throw new Error(item?.raison_bloque ?? 'Document non générable');
  }

  const now = new Date();
  const url = `/api/documents/${dossierId}/${typeDocument}`;

  const row = await prisma.documentDossier.upsert({
    where: { dossier_id_type_document: { dossier_id: dossierId, type_document: typeDocument } },
    create: {
      id: crypto.randomUUID(),
      dossier_id: dossierId,
      type_document: typeDocument,
      source_type: sourceType,
      source_id: item.source_id,
      statut: 'genere',
      url_fichier: url,
      genere_at: now,
      genere_par_id: auteurId,
    },
    update: {
      source_id: item.source_id,
      statut: 'genere',
      url_fichier: url,
      genere_at: now,
      genere_par_id: auteurId,
      signe_at: null,
      signe_par_id: null,
    },
    include: {
      genere_par: { select: { prenom: true, nom: true } },
      signe_par:  { select: { prenom: true, nom: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      id: crypto.randomUUID(),
      dossier_id: dossierId,
      type_action: 'document_genere',
      detail: `Document ${typeDocument} généré`,
      auteur_id: auteurId,
    },
  });

  return mapDocument(row);
}

export async function signerDocument(
  dossierId: string,
  typeDocument: TypeDocument,
  auteurId: string,
): Promise<void> {
  const now = new Date();

  const updated = await prisma.documentDossier.updateMany({
    where: {
      dossier_id: dossierId,
      type_document: typeDocument,
      statut: 'genere',
    },
    data: { statut: 'signe', signe_at: now, signe_par_id: auteurId },
  });

  if (updated.count === 0) throw new Error('Document non trouvé ou déjà signé');

  await prisma.auditLog.create({
    data: {
      id: crypto.randomUUID(),
      dossier_id: dossierId,
      type_action: 'document_genere',
      detail: `Document ${typeDocument} marqué signé`,
      auteur_id: auteurId,
    },
  });
}

// ─── Export ZIP list ──────────────────────────────────────────────────────────

export async function getDocumentsForExport(dossierId: string): Promise<{
  inclus: DocumentDossier[];
  exclus: { type_document: TypeDocument; raison: string }[];
}> {
  const list = await computeDocumentsList(dossierId);
  const inclus: DocumentDossier[] = [];
  const exclus: { type_document: TypeDocument; raison: string }[] = [];

  for (const item of list) {
    if (item.document && (item.document.statut === 'genere' || item.document.statut === 'signe')) {
      inclus.push(item.document);
    } else {
      exclus.push({
        type_document: item.type_document,
        raison: item.raison_bloque ?? `Statut: ${item.statut}`,
      });
    }
  }

  return { inclus, exclus };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function mapDocument(r: {
  id: string;
  dossier_id: string;
  type_document: string;
  source_type: string;
  source_id: string | null;
  statut: string;
  url_fichier: string | null;
  genere_at: Date | null;
  genere_par_id: string | null;
  genere_par?: { prenom: string; nom: string } | null;
  signe_at: Date | null;
  signe_par_id: string | null;
  signe_par?: { prenom: string; nom: string } | null;
  created_at: Date;
  updated_at: Date;
}): DocumentDossier {
  return {
    id: r.id,
    dossier_id: r.dossier_id,
    type_document: r.type_document as DocumentDossier['type_document'],
    source_type: r.source_type as DocumentDossier['source_type'],
    source_id: r.source_id,
    statut: r.statut as DocumentDossier['statut'],
    url_fichier: r.url_fichier,
    genere_at: r.genere_at?.toISOString() ?? null,
    genere_par_id: r.genere_par_id,
    genere_par_prenom: r.genere_par?.prenom ?? null,
    genere_par_nom: r.genere_par?.nom ?? null,
    signe_at: r.signe_at?.toISOString() ?? null,
    signe_par_id: r.signe_par_id,
    signe_par_prenom: r.signe_par?.prenom ?? null,
    signe_par_nom: r.signe_par?.nom ?? null,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}
