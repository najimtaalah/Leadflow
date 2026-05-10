import { getDb } from './index';
import type {
  Lead, LeadWithRelations, Relance, RelanceWithLead,
  Commission, CommissionWithLead, TimelineActivite,
  PerformanceCommercial, LeadStatut, LeadSource, RelanceType
} from './types';

// ---------- LEADS ----------

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

export function getLeads(filters: LeadFilters = {}): LeadWithRelations[] {
  const db = getDb();
  let where = ['1=1'];
  const params: (string | number | null)[] = [];

  if (filters.restricted_commercial_id) {
    where.push('l.commercial_id = ?');
    params.push(filters.restricted_commercial_id);
  }
  if (filters.statut?.length) {
    where.push(`l.statut IN (${filters.statut.map(() => '?').join(',')})`);
    params.push(...filters.statut);
  }
  if (filters.commercial_id) {
    where.push('l.commercial_id = ?');
    params.push(filters.commercial_id);
  }
  if (filters.source?.length) {
    where.push(`l.source IN (${filters.source.map(() => '?').join(',')})`);
    params.push(...filters.source);
  }
  if (filters.avec_pre_dossier) {
    where.push('l.badge_pre_dossier = 1');
  }
  if (filters.relances_en_retard) {
    where.push("EXISTS (SELECT 1 FROM relances r2 WHERE r2.lead_id = l.id AND r2.statut = 'en_retard')");
  }
  if (filters.date_debut) {
    where.push('l.date_creation >= ?');
    params.push(filters.date_debut);
  }
  if (filters.date_fin) {
    where.push('l.date_creation <= ?');
    params.push(filters.date_fin);
  }

  const sortKey = filters.sort_key ?? 'l.date_creation';
  const sortDir = filters.sort_dir ?? 'desc';
  const allowedSorts = ['l.nom', 'l.statut', 'l.source', 'u.nom', 'l.date_creation', 'r.date_prevue', 'c.montant'];
  const safeSort = allowedSorts.includes(sortKey) ? sortKey : 'l.date_creation';

  const sql = `
    SELECT
      l.*,
      u.prenom AS commercial_prenom,
      u.nom AS commercial_nom,
      (SELECT r.date_prevue FROM relances r WHERE r.lead_id = l.id AND r.statut != 'faite' ORDER BY r.date_prevue ASC LIMIT 1) AS prochaine_relance,
      c.montant AS commission_montant,
      c.statut AS commission_statut
    FROM leads l
    JOIN users u ON l.commercial_id = u.id
    LEFT JOIN commissions c ON c.lead_id = l.id
    WHERE ${where.join(' AND ')}
    ORDER BY ${safeSort} ${sortDir}
  `;

  const rows = db.prepare(sql).all(...params) as (LeadWithRelations & { badge_pre_dossier: number })[];
  return rows.map(r => ({ ...r, badge_pre_dossier: r.badge_pre_dossier === 1 }));
}

export function getLeadById(id: string): LeadWithRelations | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT l.*, u.prenom AS commercial_prenom, u.nom AS commercial_nom,
      (SELECT r.date_prevue FROM relances r WHERE r.lead_id = l.id AND r.statut != 'faite' ORDER BY r.date_prevue ASC LIMIT 1) AS prochaine_relance,
      c.montant AS commission_montant, c.statut AS commission_statut
    FROM leads l
    JOIN users u ON l.commercial_id = u.id
    LEFT JOIN commissions c ON c.lead_id = l.id
    WHERE l.id = ?
  `).get(id) as (LeadWithRelations & { badge_pre_dossier: number }) | undefined;
  if (!row) return null;
  return { ...row, badge_pre_dossier: row.badge_pre_dossier === 1 };
}

export function getLeadTimeline(leadId: string): TimelineActivite[] {
  const db = getDb();
  return db.prepare(`
    SELECT t.*, u.prenom AS auteur_prenom, u.nom AS auteur_nom
    FROM timeline_activites t
    LEFT JOIN users u ON t.auteur_id = u.id
    WHERE t.lead_id = ?
    ORDER BY t.created_at DESC
  `).all(leadId) as TimelineActivite[];
}

export function updateLeadStatut(
  leadId: string,
  newStatut: LeadStatut,
  auteurId: string,
  oldStatut: string
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare('UPDATE leads SET statut = ?, updated_at = ? WHERE id = ?').run(newStatut, now, leadId);
    db.prepare('INSERT INTO timeline_activites (id, lead_id, type, description, auteur_id, created_at) VALUES (?,?,?,?,?,?)')
      .run(crypto.randomUUID(), leadId, 'changement_statut', `${oldStatut} → ${newStatut}`, auteurId, now);
  })();
}

export function updateLead(leadId: string, data: Partial<Pick<Lead, 'prenom' | 'nom' | 'email' | 'telephone' | 'source' | 'formation_visee' | 'notes'>>): void {
  const db = getDb();
  const now = new Date().toISOString();
  const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(data), now, leadId];
  db.prepare(`UPDATE leads SET ${sets}, updated_at = ? WHERE id = ?`).run(...vals);
}

// ---------- RELANCES ----------

export function getRelances(filters: { commercial_id?: string; restricted_commercial_id?: string; statut?: string[]; type?: string[] } = {}): RelanceWithLead[] {
  const db = getDb();
  let where = ['1=1'];
  const params: string[] = [];

  if (filters.restricted_commercial_id) {
    where.push('r.commercial_id = ?');
    params.push(filters.restricted_commercial_id);
  }
  if (filters.commercial_id) {
    where.push('r.commercial_id = ?');
    params.push(filters.commercial_id);
  }
  if (filters.statut?.length) {
    where.push(`r.statut IN (${filters.statut.map(() => '?').join(',')})`);
    params.push(...filters.statut);
  }
  if (filters.type?.length) {
    where.push(`r.type IN (${filters.type.map(() => '?').join(',')})`);
    params.push(...filters.type);
  }

  return db.prepare(`
    SELECT r.*, l.prenom AS lead_prenom, l.nom AS lead_nom,
      u.prenom AS commercial_prenom, u.nom AS commercial_nom
    FROM relances r
    JOIN leads l ON r.lead_id = l.id
    JOIN users u ON r.commercial_id = u.id
    WHERE ${where.join(' AND ')}
    ORDER BY r.date_prevue ASC
  `).all(...params) as RelanceWithLead[];
}

export function createRelance(data: {
  lead_id: string; commercial_id: string; type: RelanceType;
  date_prevue: string; notes?: string;
}): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO relances (id, lead_id, commercial_id, type, date_prevue, statut, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(crypto.randomUUID(), data.lead_id, data.commercial_id, data.type, data.date_prevue, 'a_faire', data.notes ?? null, now, now);
}

export function markRelanceFaite(relanceId: string): void {
  const db = getDb();
  db.prepare("UPDATE relances SET statut = 'faite', updated_at = ? WHERE id = ?").run(new Date().toISOString(), relanceId);
}

export function reprogramRelance(relanceId: string, newDate: string): void {
  const db = getDb();
  db.prepare("UPDATE relances SET date_prevue = ?, statut = 'a_faire', updated_at = ? WHERE id = ?").run(newDate, new Date().toISOString(), relanceId);
}

export function deleteRelance(relanceId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM relances WHERE id = ?').run(relanceId);
}

export function countRelancesEnRetard(commercialId?: string): number {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  if (commercialId) {
    const r = db.prepare("SELECT COUNT(*) AS n FROM relances WHERE commercial_id = ? AND statut != 'faite' AND date_prevue < ?").get(commercialId, today) as { n: number };
    return r.n;
  }
  const r = db.prepare("SELECT COUNT(*) AS n FROM relances WHERE statut != 'faite' AND date_prevue < ?").get(today) as { n: number };
  return r.n;
}

// ---------- COMMISSIONS ----------

export function getCommissions(filters: { commercial_id?: string } = {}): CommissionWithLead[] {
  const db = getDb();
  const where = filters.commercial_id ? 'WHERE c.commercial_id = ?' : '';
  const params = filters.commercial_id ? [filters.commercial_id] : [];
  return db.prepare(`
    SELECT c.*, l.prenom AS lead_prenom, l.nom AS lead_nom,
      u.prenom AS commercial_prenom, u.nom AS commercial_nom
    FROM commissions c
    JOIN leads l ON c.lead_id = l.id
    JOIN users u ON c.commercial_id = u.id
    ${where}
    ORDER BY c.created_at DESC
  `).all(...params) as CommissionWithLead[];
}

export function upsertCommission(leadId: string, commercialId: string, montant: number | null): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO commissions (id, lead_id, commercial_id, montant, statut, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'libre', ?, ?)
    ON CONFLICT(lead_id) DO UPDATE SET montant = excluded.montant, updated_at = excluded.updated_at
    WHERE statut = 'libre'
  `).run(crypto.randomUUID(), leadId, commercialId, montant, now, now);
}

export function unlockCommission(leadId: string, motif: string, adminId: string, dossierId: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare("UPDATE commissions SET statut = 'libre', date_figement = NULL, updated_at = ? WHERE lead_id = ?").run(now, leadId);
    db.prepare('INSERT INTO audit_log (id, dossier_id, lead_id, type_action, detail, auteur_id, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(crypto.randomUUID(), dossierId, leadId, 'commission_deverrouillee', motif, adminId, now);
  })();
}

// ---------- PERFORMANCE ----------

export function getPerformanceCommercials(filters: { commercial_id?: string; date_debut?: string; date_fin?: string } = {}): PerformanceCommercial[] {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  let dateWhere = '';
  const params: string[] = [];

  if (filters.date_debut) { dateWhere += ' AND l.date_creation >= ?'; params.push(filters.date_debut); }
  if (filters.date_fin) { dateWhere += ' AND l.date_creation <= ?'; params.push(filters.date_fin); }
  if (filters.commercial_id) {
    dateWhere += ' AND u.id = ?';
    params.push(filters.commercial_id);
  }

  return db.prepare(`
    SELECT
      u.id AS commercial_id,
      u.prenom AS commercial_prenom,
      u.nom AS commercial_nom,
      COUNT(l.id) AS leads_attribues,
      SUM(CASE WHEN l.statut NOT IN ('gagne','perdu') THEN 1 ELSE 0 END) AS leads_actifs,
      SUM(CASE WHEN l.statut = 'gagne' THEN 1 ELSE 0 END) AS leads_gagnes,
      SUM(CASE WHEN l.statut = 'perdu' THEN 1 ELSE 0 END) AS leads_perdus,
      SUM(CASE WHEN c.statut = 'figee' AND l.statut = 'gagne' THEN COALESCE(c.montant, 0) ELSE 0 END) AS commissions_figees,
      SUM(CASE WHEN c.statut = 'libre' AND l.statut NOT IN ('gagne','perdu') THEN COALESCE(c.montant, 0) ELSE 0 END) AS commissions_en_cours,
      (SELECT COUNT(*) FROM relances r2 WHERE r2.commercial_id = u.id AND r2.statut != 'faite' AND r2.date_prevue < ?) AS relances_en_retard
    FROM users u
    LEFT JOIN leads l ON l.commercial_id = u.id ${dateWhere}
    LEFT JOIN commissions c ON c.lead_id = l.id
    WHERE u.role IN ('commercial', 'gestionnaire')
    GROUP BY u.id, u.prenom, u.nom
    ORDER BY leads_gagnes DESC
  `).all(today, ...params).map((row) => {
    const r = row as Record<string, unknown>;
    const gagnes = r.leads_gagnes as number;
    const perdus = r.leads_perdus as number;
    const terminal = gagnes + perdus;
    return {
      ...r,
      taux_conversion: terminal === 0 ? null : Math.round((gagnes / terminal) * 100),
    } as PerformanceCommercial;
  });
}
