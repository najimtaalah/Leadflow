import { prisma } from './prisma';
import type {
  Lead, LeadWithRelations, Relance, RelanceWithLead,
  Commission, CommissionWithLead, TimelineActivite,
  PerformanceCommercial, LeadStatut, LeadSource, RelanceType,
  RelanceStatut,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

// ─── LEADS ────────────────────────────────────────────────────────────────────

export interface LeadFilters {
  statut?: string[];
  commercial_id?: string;
  source?: string[];
  avec_pre_dossier?: boolean;
  relances_en_retard?: boolean;
  date_debut?: string;
  date_fin?: string;
  restricted_commercial_id?: string;
  sort_key?: string;
  sort_dir?: 'asc' | 'desc';
}

export async function getLeads(filters: LeadFilters = {}): Promise<LeadWithRelations[]> {
  const dir = filters.sort_dir ?? 'desc';
  const orderBy = buildOrderBy(filters.sort_key, dir);

  const rows = await prisma.lead.findMany({
    where: {
      ...(filters.restricted_commercial_id && { commercial_id: filters.restricted_commercial_id }),
      ...(filters.statut?.length && { statut: { in: filters.statut as LeadStatut[] } }),
      ...(filters.commercial_id && { commercial_id: filters.commercial_id }),
      ...(filters.source?.length && { source: { in: filters.source as LeadSource[] } }),
      ...(filters.avec_pre_dossier && { badge_pre_dossier: true }),
      ...(filters.relances_en_retard && { relances: { some: { statut: 'en_retard' } } }),
      ...(filters.date_debut && { date_creation: { gte: new Date(filters.date_debut) } }),
      ...(filters.date_fin && { date_creation: { lte: new Date(filters.date_fin) } }),
    },
    include: {
      commercial: { select: { prenom: true, nom: true } },
      commissions: { select: { montant: true, statut: true }, take: 1 },
      relances: {
        where: { statut: { not: 'faite' } },
        orderBy: { date_prevue: 'asc' },
        take: 1,
        select: { date_prevue: true },
      },
    },
    orderBy,
  });

  return rows.map((r) => ({
    id: r.id,
    commercial_id: r.commercial_id,
    prenom: r.prenom,
    nom: r.nom,
    email: r.email,
    telephone: r.telephone,
    source: r.source as LeadSource,
    formation_visee: r.formation_visee,
    statut: r.statut as LeadStatut,
    badge_pre_dossier: r.badge_pre_dossier,
    notes: r.notes,
    date_creation: r.date_creation.toISOString(),
    updated_at: r.updated_at.toISOString(),
    commercial_prenom: r.commercial.prenom,
    commercial_nom: r.commercial.nom,
    prochaine_relance: r.relances[0]?.date_prevue ? r.relances[0].date_prevue.toISOString() : null,
    commission_montant: r.commissions[0]?.montant ?? null,
    commission_statut: (r.commissions[0]?.statut ?? null) as LeadWithRelations['commission_statut'],
  }));
}

function buildOrderBy(sortKey: string | undefined, dir: 'asc' | 'desc') {
  switch (sortKey) {
    case 'l.nom': return { nom: dir };
    case 'l.statut': return { statut: dir };
    case 'l.source': return { source: dir };
    case 'u.nom': return { commercial: { nom: dir } };
    case 'l.date_creation':
    default:
      return { date_creation: dir };
  }
}

export async function getLeadById(id: string): Promise<LeadWithRelations | null> {
  const r = await prisma.lead.findUnique({
    where: { id },
    include: {
      commercial: { select: { prenom: true, nom: true } },
      commissions: { select: { montant: true, statut: true }, take: 1 },
      relances: {
        where: { statut: { not: 'faite' } },
        orderBy: { date_prevue: 'asc' },
        take: 1,
        select: { date_prevue: true },
      },
    },
  });
  if (!r) return null;
  return {
    id: r.id,
    commercial_id: r.commercial_id,
    prenom: r.prenom,
    nom: r.nom,
    email: r.email,
    telephone: r.telephone,
    source: r.source as LeadSource,
    formation_visee: r.formation_visee,
    statut: r.statut as LeadStatut,
    badge_pre_dossier: r.badge_pre_dossier,
    notes: r.notes,
    date_creation: r.date_creation.toISOString(),
    updated_at: r.updated_at.toISOString(),
    commercial_prenom: r.commercial.prenom,
    commercial_nom: r.commercial.nom,
    prochaine_relance: r.relances[0]?.date_prevue ? r.relances[0].date_prevue.toISOString() : null,
    commission_montant: r.commissions[0]?.montant ?? null,
    commission_statut: (r.commissions[0]?.statut ?? null) as LeadWithRelations['commission_statut'],
  };
}

export async function getLeadTimeline(leadId: string): Promise<TimelineActivite[]> {
  const rows = await prisma.timelineActivite.findMany({
    where: { lead_id: leadId },
    include: { auteur: { select: { prenom: true, nom: true } } },
    orderBy: { created_at: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    lead_id: r.lead_id,
    type: r.type as TimelineActivite['type'],
    description: r.description,
    auteur_id: r.auteur_id,
    auteur_prenom: r.auteur?.prenom ?? null,
    auteur_nom: r.auteur?.nom ?? null,
    created_at: r.created_at.toISOString(),
  }));
}

export async function updateLeadStatut(
  leadId: string,
  newStatut: LeadStatut,
  auteurId: string,
  oldStatut: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data: { statut: newStatut } }),
    prisma.timelineActivite.create({
      data: {
        id: crypto.randomUUID(),
        lead_id: leadId,
        type: 'changement_statut',
        description: `${oldStatut} → ${newStatut}`,
        auteur_id: auteurId,
      },
    }),
  ]);
}

export async function updateLead(
  leadId: string,
  data: Partial<Pick<Lead, 'prenom' | 'nom' | 'email' | 'telephone' | 'source' | 'formation_visee' | 'notes'>>,
): Promise<void> {
  await prisma.lead.update({ where: { id: leadId }, data });
}

// ─── RELANCES ─────────────────────────────────────────────────────────────────

export async function getRelances(
  filters: { commercial_id?: string; restricted_commercial_id?: string; statut?: string[]; type?: string[] } = {},
): Promise<RelanceWithLead[]> {
  const rows = await prisma.relance.findMany({
    where: {
      ...(filters.restricted_commercial_id && { commercial_id: filters.restricted_commercial_id }),
      ...(filters.commercial_id && { commercial_id: filters.commercial_id }),
      ...(filters.statut?.length && { statut: { in: filters.statut as RelanceStatut[] } }),
      ...(filters.type?.length && { type: { in: filters.type as RelanceType[] } }),
    },
    include: {
      lead: { select: { prenom: true, nom: true } },
      commercial: { select: { prenom: true, nom: true } },
    },
    orderBy: { date_prevue: 'asc' },
  });

  return rows.map((r) => ({
    id: r.id,
    lead_id: r.lead_id,
    commercial_id: r.commercial_id,
    type: r.type as RelanceType,
    date_prevue: r.date_prevue.toISOString(),
    statut: r.statut as RelanceStatut,
    notes: r.notes,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    lead_prenom: r.lead.prenom,
    lead_nom: r.lead.nom,
    commercial_prenom: r.commercial.prenom,
    commercial_nom: r.commercial.nom,
  }));
}

export async function createRelance(data: {
  lead_id: string;
  commercial_id: string;
  type: RelanceType;
  date_prevue: string;
  notes?: string;
}): Promise<void> {
  await prisma.relance.create({
    data: {
      id: crypto.randomUUID(),
      lead_id: data.lead_id,
      commercial_id: data.commercial_id,
      type: data.type,
      date_prevue: new Date(data.date_prevue),
      statut: 'a_faire',
      notes: data.notes ?? null,
    },
  });
}

export async function markRelanceFaite(relanceId: string): Promise<void> {
  await prisma.relance.update({ where: { id: relanceId }, data: { statut: 'faite' } });
}

export async function reprogramRelance(relanceId: string, newDate: string): Promise<void> {
  await prisma.relance.update({
    where: { id: relanceId },
    data: { date_prevue: new Date(newDate), statut: 'a_faire' },
  });
}

export async function deleteRelance(relanceId: string): Promise<void> {
  await prisma.relance.delete({ where: { id: relanceId } });
}

export async function countRelancesEnRetard(commercialId?: string): Promise<number> {
  return prisma.relance.count({
    where: {
      ...(commercialId && { commercial_id: commercialId }),
      statut: { not: 'faite' },
      date_prevue: { lt: new Date() },
    },
  });
}

// ─── COMMISSIONS ──────────────────────────────────────────────────────────────

export async function getCommissions(
  filters: { commercial_id?: string } = {},
): Promise<CommissionWithLead[]> {
  const rows = await prisma.commission.findMany({
    where: filters.commercial_id ? { commercial_id: filters.commercial_id } : {},
    include: {
      lead: { select: { prenom: true, nom: true } },
      commercial: { select: { prenom: true, nom: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  return rows.map((r) => ({
    id: r.id,
    lead_id: r.lead_id,
    commercial_id: r.commercial_id,
    montant: r.montant,
    statut: r.statut as Commission['statut'],
    date_figement: toIso(r.date_figement),
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    lead_prenom: r.lead.prenom,
    lead_nom: r.lead.nom,
    commercial_prenom: r.commercial.prenom,
    commercial_nom: r.commercial.nom,
  }));
}

export async function upsertCommission(
  leadId: string,
  commercialId: string,
  montant: number | null,
): Promise<void> {
  await prisma.commission.upsert({
    where: { lead_id: leadId },
    create: {
      id: crypto.randomUUID(),
      lead_id: leadId,
      commercial_id: commercialId,
      montant,
      statut: 'libre',
    },
    update: { montant },
  });
}

export async function unlockCommission(
  leadId: string,
  motif: string,
  adminId: string,
  dossierId: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.commission.update({
      where: { lead_id: leadId },
      data: { statut: 'libre', date_figement: null },
    }),
    prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        dossier_id: dossierId,
        lead_id: leadId,
        type_action: 'commission_deverrouillee',
        detail: motif,
        auteur_id: adminId,
      },
    }),
  ]);
}

// ─── PERFORMANCE ──────────────────────────────────────────────────────────────

export async function getPerformanceCommercials(
  filters: { commercial_id?: string; date_debut?: string; date_fin?: string } = {},
): Promise<PerformanceCommercial[]> {
  const today = new Date();

  const users = await prisma.user.findMany({
    where: {
      role: { in: ['commercial', 'gestionnaire'] },
      ...(filters.commercial_id && { id: filters.commercial_id }),
    },
    include: {
      leads_as_commercial: {
        where: {
          ...(filters.date_debut && { date_creation: { gte: new Date(filters.date_debut) } }),
          ...(filters.date_fin && { date_creation: { lte: new Date(filters.date_fin) } }),
        },
        include: { commissions: { select: { montant: true, statut: true } } },
      },
      relances: {
        where: { statut: { not: 'faite' }, date_prevue: { lt: today } },
        select: { id: true },
      },
    },
    orderBy: { nom: 'asc' },
  });

  return users
    .map((u) => {
      const leads = u.leads_as_commercial;
      const gagnes = leads.filter((l) => l.statut === 'gagne').length;
      const perdus = leads.filter((l) => l.statut === 'perdu').length;
      const terminal = gagnes + perdus;
      const commFigees = leads
        .filter((l) => l.statut === 'gagne')
        .reduce((s, l) => s + (l.commissions.find((c) => c.statut === 'figee')?.montant ?? 0), 0);
      const commLibres = leads
        .filter((l) => !['gagne', 'perdu'].includes(l.statut))
        .reduce((s, l) => s + (l.commissions.find((c) => c.statut === 'libre')?.montant ?? 0), 0);

      return {
        commercial_id: u.id,
        commercial_prenom: u.prenom,
        commercial_nom: u.nom,
        leads_attribues: leads.length,
        leads_actifs: leads.filter((l) => !['gagne', 'perdu'].includes(l.statut)).length,
        leads_gagnes: gagnes,
        leads_perdus: perdus,
        taux_conversion: terminal === 0 ? null : Math.round((gagnes / terminal) * 100),
        commissions_figees: commFigees,
        commissions_en_cours: commLibres,
        relances_en_retard: u.relances.length,
      } satisfies PerformanceCommercial;
    })
    .sort((a, b) => b.leads_gagnes - a.leads_gagnes);
}
