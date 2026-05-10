import { getDb } from './index';
import { seedIfEmpty } from './seed';
import type {
  Apprenant, ApprenantWithRelations, Dossier, DossierWithRelations,
  PieceJustificative, AuditLog, BlocStatut, TypeFinancement,
  FormationType, Formule
} from './types';

export function initDb(): void {
  getDb();
  seedIfEmpty();
}

// ---------- APPRENANTS ----------

export function getApprenants(filters: { restricted_commercial_id?: string } = {}): ApprenantWithRelations[] {
  const db = getDb();
  let where = '1=1';
  const params: string[] = [];

  if (filters.restricted_commercial_id) {
    where += ' AND (d.commercial_id = ? OR l.commercial_id = ?)';
    params.push(filters.restricted_commercial_id, filters.restricted_commercial_id);
  }

  return db.prepare(`
    SELECT a.*, l.prenom AS lead_prenom, l.nom AS lead_nom,
      (SELECT COUNT(*) FROM dossiers d2 WHERE d2.id_apprenant = a.id) AS nb_dossiers
    FROM apprenants a
    LEFT JOIN leads l ON a.id_lead_origine = l.id
    LEFT JOIN dossiers d ON d.id_apprenant = a.id
    WHERE ${where}
    GROUP BY a.id
    ORDER BY a.nom ASC
  `).all(...params) as ApprenantWithRelations[];
}

export function getApprenantById(id: string): ApprenantWithRelations | null {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, l.prenom AS lead_prenom, l.nom AS lead_nom,
      (SELECT COUNT(*) FROM dossiers d WHERE d.id_apprenant = a.id) AS nb_dossiers
    FROM apprenants a
    LEFT JOIN leads l ON a.id_lead_origine = l.id
    WHERE a.id = ?
  `).get(id) as ApprenantWithRelations | null;
}

export function updateApprenant(id: string, data: Partial<Pick<Apprenant, 'prenom' | 'nom' | 'date_naissance' | 'lieu_naissance' | 'nationalite' | 'email' | 'telephone' | 'adresse' | 'code_postal' | 'ville'>>): void {
  const db = getDb();
  const now = new Date().toISOString();
  const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(data), now, id];
  db.prepare(`UPDATE apprenants SET ${sets}, updated_at = ? WHERE id = ?`).run(...vals);
}

// ---------- DOSSIERS ----------

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

export function getDossiers(filters: DossierFilters = {}): DossierWithRelations[] {
  const db = getDb();
  const where: string[] = ['1=1'];
  const params: (string | number)[] = [];

  if (filters.restricted_commercial_id) {
    where.push('d.commercial_id = ?');
    params.push(filters.restricted_commercial_id);
  }
  if (filters.statut?.length) {
    where.push(`d.statut IN (${filters.statut.map(() => '?').join(',')})`);
    params.push(...filters.statut);
  }
  if (filters.statut_bloc_admin) {
    where.push('d.statut_bloc_admin = ?');
    params.push(filters.statut_bloc_admin);
  }
  if (filters.statut_bloc_financier) {
    where.push('d.statut_bloc_financier = ?');
    params.push(filters.statut_bloc_financier);
  }
  if (filters.formation_type?.length) {
    where.push(`d.formation_type IN (${filters.formation_type.map(() => '?').join(',')})`);
    params.push(...filters.formation_type);
  }
  if (filters.type_financement?.length) {
    where.push(`d.type_financement IN (${filters.type_financement.map(() => '?').join(',')})`);
    params.push(...filters.type_financement);
  }
  if (filters.gestionnaire_id) {
    where.push('d.gestionnaire_id = ?');
    params.push(filters.gestionnaire_id);
  }
  if (filters.date_debut) {
    where.push('d.date_creation >= ?');
    params.push(filters.date_debut);
  }
  if (filters.date_fin) {
    where.push('d.date_creation <= ?');
    params.push(filters.date_fin);
  }

  return db.prepare(`
    SELECT d.*,
      a.prenom AS apprenant_prenom, a.nom AS apprenant_nom,
      uc.prenom AS commercial_prenom, uc.nom AS commercial_nom,
      ug.prenom AS gestionnaire_prenom, ug.nom AS gestionnaire_nom
    FROM dossiers d
    JOIN apprenants a ON d.id_apprenant = a.id
    LEFT JOIN users uc ON d.commercial_id = uc.id
    LEFT JOIN users ug ON d.gestionnaire_id = ug.id
    WHERE ${where.join(' AND ')}
    ORDER BY d.date_creation DESC
  `).all(...params) as DossierWithRelations[];
}

export function getDossierById(id: string): DossierWithRelations | null {
  const db = getDb();
  return db.prepare(`
    SELECT d.*,
      a.prenom AS apprenant_prenom, a.nom AS apprenant_nom,
      uc.prenom AS commercial_prenom, uc.nom AS commercial_nom,
      ug.prenom AS gestionnaire_prenom, ug.nom AS gestionnaire_nom
    FROM dossiers d
    JOIN apprenants a ON d.id_apprenant = a.id
    LEFT JOIN users uc ON d.commercial_id = uc.id
    LEFT JOIN users ug ON d.gestionnaire_id = ug.id
    WHERE d.id = ?
  `).get(id) as DossierWithRelations | null;
}

export function getDossiersByApprenant(apprenantId: string): DossierWithRelations[] {
  return getDossiers({ restricted_commercial_id: undefined }).filter(d => d.id_apprenant === apprenantId);
}

export function getPiecesJustificatives(dossierId: string): PieceJustificative[] {
  const db = getDb();
  return db.prepare('SELECT * FROM pieces_justificatives WHERE dossier_id = ? ORDER BY type_piece').all(dossierId) as PieceJustificative[];
}

export function getAuditLog(dossierId: string): AuditLog[] {
  const db = getDb();
  return db.prepare(`
    SELECT al.*, u.prenom AS auteur_prenom, u.nom AS auteur_nom
    FROM audit_log al
    LEFT JOIN users u ON al.auteur_id = u.id
    WHERE al.dossier_id = ?
    ORDER BY al.created_at DESC
  `).all(dossierId) as AuditLog[];
}

// ---------- BLOC ADMIN / FINANCIER ----------

export function updateBlocStatut(
  dossierId: string,
  bloc: 'admin' | 'financier',
  newStatut: BlocStatut,
  auteurId: string,
  motif?: string
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const field = bloc === 'admin' ? 'statut_bloc_admin' : 'statut_bloc_financier';
  const actionType = newStatut === 'valide' ? 'bloc_valide' : newStatut === 'rejete' ? 'bloc_rejete' : 'bloc_soumis';
  const detail = motif
    ? `Bloc ${bloc} ${actionType.replace('bloc_', '')} : ${motif}`
    : `Bloc ${bloc} ${actionType.replace('bloc_', '')}`;

  db.transaction(() => {
    db.prepare(`UPDATE dossiers SET ${field} = ?, updated_at = ? WHERE id = ?`).run(newStatut, now, dossierId);

    // Auto-update dossier statut
    const d = db.prepare('SELECT statut_bloc_admin, statut_bloc_financier, statut FROM dossiers WHERE id = ?').get(dossierId) as Pick<Dossier, 'statut_bloc_admin' | 'statut_bloc_financier' | 'statut'>;
    const adminOk = bloc === 'admin' ? newStatut === 'valide' : d.statut_bloc_admin === 'valide';
    const finOk = bloc === 'financier' ? newStatut === 'valide' : d.statut_bloc_financier === 'valide';

    let newDossierStatut = d.statut;
    if (adminOk && finOk && d.statut === 'en_cours') newDossierStatut = 'valide';
    else if (d.statut === 'pre_dossier') newDossierStatut = 'en_cours';

    if (newDossierStatut !== d.statut) {
      db.prepare('UPDATE dossiers SET statut = ?, updated_at = ? WHERE id = ?').run(newDossierStatut, now, dossierId);
    }

    db.prepare('INSERT INTO audit_log (id, dossier_id, type_action, detail, auteur_id, created_at) VALUES (?,?,?,?,?,?)')
      .run(crypto.randomUUID(), dossierId, actionType, detail, auteurId, now);
  })();
}

// ---------- OUVERTURE PRÉ-DOSSIER (atomique) ----------

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

export function ouvrirPreDossier(input: PreDossierInput): { apprenantId: string; dossierId: string } {
  const db = getDb();
  const now = new Date().toISOString();
  const apprenantId = crypto.randomUUID();
  const dossierId = crypto.randomUUID();

  db.transaction(() => {
    db.prepare(`
      INSERT INTO apprenants (id, id_lead_origine, prenom, nom, date_naissance, email, telephone, statut, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,'pre_actif',?,?)
    `).run(apprenantId, input.lead_id, input.prenom, input.nom, input.date_naissance, input.email, input.telephone, now, now);

    db.prepare(`
      INSERT INTO dossiers (id, id_apprenant, id_lead_origine, formation_type, formule, commercial_id, statut, statut_bloc_admin, statut_bloc_financier, notes, date_creation, updated_at)
      VALUES (?,?,?,?,?,?,'pre_dossier','non_demarre','non_demarre',?,?,?)
    `).run(dossierId, apprenantId, input.lead_id, input.formation_type, input.formule, input.commercial_id, input.notes ?? null, now, now);

    db.prepare('UPDATE leads SET badge_pre_dossier = 1, updated_at = ? WHERE id = ?').run(now, input.lead_id);

    db.prepare('INSERT INTO timeline_activites (id, lead_id, type, description, auteur_id, created_at) VALUES (?,?,?,?,?,?)')
      .run(crypto.randomUUID(), input.lead_id, 'pre_dossier_ouvert', 'Pré-dossier ouvert', input.commercial_id, now);

    db.prepare('INSERT INTO audit_log (id, dossier_id, lead_id, type_action, detail, auteur_id, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(crypto.randomUUID(), dossierId, input.lead_id, 'creation_dossier', `Dossier créé depuis lead #${input.lead_id}`, input.commercial_id, now);

    if (input.commission != null) {
      db.prepare(`
        INSERT INTO commissions (id, lead_id, commercial_id, montant, statut, created_at, updated_at)
        VALUES (?,?,?,?,'libre',?,?)
        ON CONFLICT(lead_id) DO UPDATE SET montant = excluded.montant, updated_at = excluded.updated_at
        WHERE statut = 'libre'
      `).run(crypto.randomUUID(), input.lead_id, input.commercial_id, input.commission, now, now);
    }

    // Init pièces obligatoires
    const pieces = [
      'piece_identite', 'justif_domicile', 'photo_identite', 'permis_conduire', 'casier_judiciaire',
    ];
    const typeSpecifique: Record<string, string[]> = {
      vtc: ['attestation_medicale'],
      taxi: ['attestation_medicale', 'attestation_assr'],
      vmdtr: ['attestation_medicale', 'permis_be'],
      passerelle_vtc_taxi: ['carte_pro_vtc'],
      passerelle_taxi_vtc: ['carte_pro_taxi'],
    };
    const extras = typeSpecifique[input.formation_type] ?? [];
    const allPieces = [...pieces, ...extras];
    const insertPiece = db.prepare('INSERT INTO pieces_justificatives (id, dossier_id, type_piece, statut, created_at, updated_at) VALUES (?,?,?,?,?,?)');
    for (const p of allPieces) {
      insertPiece.run(crypto.randomUUID(), dossierId, p, 'a_fournir', now, now);
    }
  })();

  return { apprenantId, dossierId };
}

// ---------- ACTIVATION APPRENANT (atomique) ----------

export function activerApprenant(dossierId: string, adminId: string): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.transaction(() => {
    const dossier = db.prepare('SELECT * FROM dossiers WHERE id = ?').get(dossierId) as Dossier | undefined;
    if (!dossier) throw new Error('Dossier introuvable');
    if (dossier.statut_bloc_admin !== 'valide' || dossier.statut_bloc_financier !== 'valide') {
      throw new Error('Les deux blocs doivent être Validé');
    }

    db.prepare("UPDATE dossiers SET statut = 'non_planifie', date_activation = ?, updated_at = ? WHERE id = ?").run(now, now, dossierId);
    db.prepare("UPDATE apprenants SET statut = 'actif', updated_at = ? WHERE id = ?").run(now, dossier.id_apprenant);

    if (dossier.id_lead_origine) {
      db.prepare("UPDATE leads SET statut = 'gagne', updated_at = ? WHERE id = ?").run(now, dossier.id_lead_origine);
      db.prepare("UPDATE commissions SET statut = 'figee', date_figement = ?, updated_at = ? WHERE lead_id = ?").run(now, now, dossier.id_lead_origine);

      const comm = db.prepare('SELECT montant FROM commissions WHERE lead_id = ?').get(dossier.id_lead_origine) as { montant: number | null } | undefined;
      const commStr = comm?.montant != null ? ` commission figée (${comm.montant.toLocaleString('fr-FR')} €)` : '';
      const detail = `Apprenant activé — lead → Gagné,${commStr}`;

      db.prepare('INSERT INTO timeline_activites (id, lead_id, type, description, auteur_id, created_at) VALUES (?,?,?,?,?,?)')
        .run(crypto.randomUUID(), dossier.id_lead_origine, 'changement_statut', detail, null, now);
    }

    db.prepare('INSERT INTO audit_log (id, dossier_id, lead_id, type_action, detail, auteur_id, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(crypto.randomUUID(), dossierId, dossier.id_lead_origine ?? null, 'apprenant_active', 'Apprenant activé', adminId, now);
  })();
}

// ---------- QUALIOPI ----------

export interface QualiopiCritere {
  id: string;
  label: string;
  statut: 'ok' | 'warning' | 'error' | 'na';
  source: string;
}

export function computeQualiopiCriteres(dossierId: string): QualiopiCritere[] {
  const db = getDb();
  const dossier = db.prepare('SELECT * FROM dossiers WHERE id = ?').get(dossierId) as Dossier | undefined;
  if (!dossier) return [];

  const pieces = db.prepare('SELECT type_piece, statut FROM pieces_justificatives WHERE dossier_id = ?').all(dossierId) as { type_piece: string; statut: string }[];
  const hasPiece = (type: string, s?: string) => pieces.some(p => p.type_piece === type && (s ? p.statut === s : true));

  const blocAdminOk = dossier.statut_bloc_admin === 'valide';
  const blocAdminSoumis = dossier.statut_bloc_admin === 'soumis';

  return [
    {
      id: 'I1',
      label: 'Information du public — Formation cataloguée',
      statut: 'ok',
      source: 'formations.catalogue',
    },
    {
      id: 'I2a',
      label: 'Positionnement — Prérequis (bloc admin)',
      statut: blocAdminOk ? 'ok' : blocAdminSoumis ? 'warning' : 'error',
      source: 'statut_bloc_admin',
    },
    {
      id: 'I2b',
      label: 'Positionnement — Évaluation de positionnement',
      statut: hasPiece('evaluation_positionnement', 'fournie') ? 'ok' : 'error',
      source: 'documents',
    },
    {
      id: 'I3',
      label: 'Adaptation — Programme de formation',
      statut: hasPiece('programme_formation', 'fournie') ? 'ok' : 'error',
      source: 'documents',
    },
    { id: 'I4a', label: 'Suivi — Session de cours affectée', statut: 'error', source: 'sessions (Lot 3)' },
    { id: 'I4b', label: 'Suivi — Feuille d\'émargement', statut: 'error', source: 'documents (Lot 4)' },
    { id: 'I5a', label: 'Évaluation — Examen théorie', statut: 'error', source: 'sessions (Lot 3)' },
    { id: 'I5b', label: 'Évaluation — Résultat théorie', statut: 'error', source: 'sessions_examen (Lot 5)' },
    { id: 'I5c', label: 'Évaluation — Examen pratique', statut: 'na', source: 'sessions (Lot 3)' },
    { id: 'I5d', label: 'Évaluation — Résultat pratique', statut: 'na', source: 'sessions_examen (Lot 5)' },
    { id: 'I6a', label: 'Résultats — Attestation de réalisation', statut: 'error', source: 'documents (Lot 4)' },
    { id: 'I6b', label: 'Résultats — Certificat de réussite', statut: 'na', source: 'documents (Lot 4)' },
    {
      id: 'I7',
      label: 'Réclamations — Aucune réclamation ouverte non traitée',
      statut: 'ok',
      source: 'audit_log',
    },
  ];
}
