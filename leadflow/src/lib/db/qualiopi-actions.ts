import { prisma } from './prisma';
import { isValidTransition, computeStatut, VALID_TRANSITIONS } from './qualiopi-actions.logic';
import type {
  ActionQualiopi,
  ActionQualiopiWithHistory,
  ActionQualiopiHistoryRow,
  ActionQualiopiFilters,
  ActionQualiopiDashboardSummary,
  ActionQualiopiStatut,
  ActionQualiopiIndicateur,
  ActionQualiopiPriorite,
  ActionQualiopiFormation,
} from './types';

export { isValidTransition, VALID_TRANSITIONS };

// ─── Mappers ───────────────────────────────────────────────────────────────────

function mapRow(row: {
  id: string;
  indicateur: string;
  formation: string | null;
  titre: string;
  description: string | null;
  responsable: string | null;
  date_echeance: Date | null;
  statut: string;
  priorite: string;
  preuve: string | null;
  preuve_fichier_url: string | null;
  source_veille_semaine: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}): ActionQualiopi {
  return {
    id: row.id,
    indicateur: row.indicateur as ActionQualiopiIndicateur,
    formation: row.formation as ActionQualiopiFormation | null,
    titre: row.titre,
    description: row.description,
    responsable: row.responsable,
    date_echeance: row.date_echeance ? row.date_echeance.toISOString().split('T')[0] : null,
    statut: computeStatut(row.statut, row.date_echeance),
    priorite: row.priorite as ActionQualiopiPriorite,
    preuve: row.preuve,
    preuve_fichier_url: row.preuve_fichier_url,
    source_veille_semaine: row.source_veille_semaine,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    created_by: row.created_by,
  };
}

function mapHistoryRow(row: {
  id: string;
  action_id: string;
  statut_avant: string | null;
  statut_apres: string;
  changed_by: string | null;
  note: string | null;
  created_at: Date;
}): ActionQualiopiHistoryRow {
  return {
    id: row.id,
    action_id: row.action_id,
    statut_avant: (row.statut_avant as ActionQualiopiStatut) || null,
    statut_apres: row.statut_apres as ActionQualiopiStatut,
    changed_by: row.changed_by,
    note: row.note,
    created_at: row.created_at.toISOString(),
  };
}

// ─── List ──────────────────────────────────────────────────────────────────────

export async function listActions(filters: ActionQualiopiFilters = {}): Promise<{
  actions: ActionQualiopi[];
  total: number;
}> {
  const { indicateur, formation, statut, priorite, q, page = 1, limit = 25 } = filters;

  const where: Record<string, unknown> = {};
  if (indicateur) where.indicateur = indicateur;
  if (formation) where.formation = formation;
  if (statut && statut !== 'en_retard') {
    where.statut = statut;
  }
  if (priorite) where.priorite = priorite;
  if (q) {
    where.OR = [
      { titre: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.actionQualiopi.findMany({
      where,
      orderBy: [{ date_echeance: 'asc' }, { priorite: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.actionQualiopi.count({ where }),
  ]);

  let actions = rows.map(mapRow);

  // Apply en_retard filter after lazy computation
  if (statut === 'en_retard') {
    actions = actions.filter((a) => a.statut === 'en_retard');
  }

  return { actions, total };
}

// ─── Get one ───────────────────────────────────────────────────────────────────

export async function getActionById(id: string): Promise<ActionQualiopiWithHistory | null> {
  const row = await prisma.actionQualiopi.findUnique({
    where: { id },
    include: {
      history: { orderBy: { created_at: 'desc' } },
    },
  });
  if (!row) return null;

  return {
    ...mapRow(row),
    history: row.history.map(mapHistoryRow),
  };
}

// ─── Create ────────────────────────────────────────────────────────────────────

export interface CreateActionInput {
  indicateur: ActionQualiopiIndicateur;
  formation?: ActionQualiopiFormation | null;
  titre: string;
  description?: string | null;
  responsable?: string | null;
  date_echeance?: string | null;
  priorite?: ActionQualiopiPriorite;
  preuve?: string | null;
  source_veille_semaine?: string | null;
  created_by?: string | null;
}

export async function createAction(input: CreateActionInput): Promise<ActionQualiopi> {
  const row = await prisma.actionQualiopi.create({
    data: {
      indicateur: input.indicateur,
      formation: input.formation ?? null,
      titre: input.titre,
      description: input.description ?? null,
      responsable: input.responsable ?? null,
      date_echeance: input.date_echeance ? new Date(input.date_echeance) : null,
      statut: 'a_faire',
      priorite: input.priorite ?? 'medium',
      preuve: input.preuve ?? null,
      source_veille_semaine: input.source_veille_semaine ?? null,
      created_by: input.created_by ?? null,
    },
  });

  await prisma.actionQualiopiHistory.create({
    data: {
      action_id: row.id,
      statut_avant: null,
      statut_apres: 'a_faire',
      changed_by: input.created_by ?? null,
      note: 'Action créée',
    },
  });

  return mapRow(row);
}

// ─── Update ────────────────────────────────────────────────────────────────────

export interface UpdateActionInput {
  indicateur?: ActionQualiopiIndicateur;
  formation?: ActionQualiopiFormation | null;
  titre?: string;
  description?: string | null;
  responsable?: string | null;
  date_echeance?: string | null;
  statut?: ActionQualiopiStatut;
  priorite?: ActionQualiopiPriorite;
  preuve?: string | null;
  preuve_fichier_url?: string | null;
  source_veille_semaine?: string | null;
  changed_by?: string | null;
  note?: string | null;
}

export async function updateAction(id: string, input: UpdateActionInput): Promise<ActionQualiopi> {
  const current = await prisma.actionQualiopi.findUnique({ where: { id } });
  if (!current) throw new Error('Action introuvable');

  const currentStatut = computeStatut(current.statut, current.date_echeance);

  if (input.statut && input.statut !== currentStatut) {
    if (!isValidTransition(currentStatut, input.statut)) {
      throw new Error(
        `Transition de statut invalide : ${currentStatut} → ${input.statut}`,
      );
    }
    if (input.statut === 'fait') {
      const preuve = input.preuve ?? current.preuve;
      const preuveFichier = input.preuve_fichier_url ?? current.preuve_fichier_url;
      if (!preuve && !preuveFichier) {
        throw new Error(
          'Une preuve (texte ou fichier) est obligatoire pour clôturer une action.',
        );
      }
    }
  }

  const data: Record<string, unknown> = {};
  if (input.indicateur !== undefined) data.indicateur = input.indicateur;
  if (input.formation !== undefined) data.formation = input.formation;
  if (input.titre !== undefined) data.titre = input.titre;
  if (input.description !== undefined) data.description = input.description;
  if (input.responsable !== undefined) data.responsable = input.responsable;
  if (input.date_echeance !== undefined) {
    data.date_echeance = input.date_echeance ? new Date(input.date_echeance) : null;
  }
  if (input.statut !== undefined) data.statut = input.statut;
  if (input.priorite !== undefined) data.priorite = input.priorite;
  if (input.preuve !== undefined) data.preuve = input.preuve;
  if (input.preuve_fichier_url !== undefined) data.preuve_fichier_url = input.preuve_fichier_url;
  if (input.source_veille_semaine !== undefined) data.source_veille_semaine = input.source_veille_semaine;

  const updated = await prisma.actionQualiopi.update({
    where: { id },
    data,
  });

  if (input.statut && input.statut !== currentStatut) {
    await prisma.actionQualiopiHistory.create({
      data: {
        action_id: id,
        statut_avant: currentStatut,
        statut_apres: input.statut,
        changed_by: input.changed_by ?? null,
        note: input.note ?? null,
      },
    });
  }

  return mapRow(updated);
}

// ─── Delete (soft) ─────────────────────────────────────────────────────────────

export async function deleteAction(id: string, changed_by?: string): Promise<void> {
  const current = await prisma.actionQualiopi.findUnique({ where: { id } });
  if (!current) throw new Error('Action introuvable');

  const currentStatut = computeStatut(current.statut, current.date_echeance);

  await prisma.actionQualiopi.update({
    where: { id },
    data: { statut: 'annule' },
  });

  await prisma.actionQualiopiHistory.create({
    data: {
      action_id: id,
      statut_avant: currentStatut,
      statut_apres: 'annule',
      changed_by: changed_by ?? null,
      note: 'Action annulée',
    },
  });
}

// ─── Dashboard summary ─────────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<ActionQualiopiDashboardSummary> {
  const today = new Date(new Date().toDateString());

  const [all, prochaines] = await Promise.all([
    prisma.actionQualiopi.findMany({
      where: { statut: { not: 'annule' } },
      orderBy: [{ priorite: 'asc' }, { date_echeance: 'asc' }],
    }),
    prisma.actionQualiopi.findMany({
      where: {
        statut: { in: ['a_faire', 'en_cours'] },
        date_echeance: { gte: today },
      },
      orderBy: [{ date_echeance: 'asc' }, { priorite: 'asc' }],
      take: 5,
    }),
  ]);

  const mapped = all.map(mapRow);
  const en_retard_count = mapped.filter((a) => a.statut === 'en_retard').length;
  const prioritaires = mapped
    .filter((a) => a.statut !== 'fait' && (a.priorite === 'critical' || a.priorite === 'high'))
    .slice(0, 5);

  return {
    en_retard_count,
    prioritaires,
    prochaines_echeances: prochaines.map(mapRow),
  };
}

// ─── Export CSV ────────────────────────────────────────────────────────────────

export async function exportActionsCSV(filters: ActionQualiopiFilters = {}): Promise<string> {
  const { actions } = await listActions({ ...filters, limit: 1000, page: 1 });

  const header = [
    'ID', 'Indicateur', 'Formation', 'Titre', 'Description', 'Responsable',
    'Échéance', 'Statut', 'Priorité', 'Preuve', 'Semaine Veille',
    'Créé le', 'Modifié le', 'Créé par',
  ].join(';');

  const rows = actions.map((a) => [
    a.id,
    a.indicateur,
    a.formation ?? '',
    `"${(a.titre ?? '').replace(/"/g, '""')}"`,
    `"${(a.description ?? '').replace(/"/g, '""')}"`,
    a.responsable ?? '',
    a.date_echeance ?? '',
    a.statut,
    a.priorite,
    `"${(a.preuve ?? '').replace(/"/g, '""')}"`,
    a.source_veille_semaine ?? '',
    a.created_at.split('T')[0],
    a.updated_at.split('T')[0],
    a.created_by ?? '',
  ].join(';'));

  return [header, ...rows].join('\n');
}

export { VALID_TRANSITIONS };
