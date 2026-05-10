"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Eye, Phone, Bell, FolderPlus, X, ExternalLink
} from "lucide-react";
import { DataTable, Column } from "@/components/ds/data-table";
import { Badge } from "@/components/ui/badge";
import type { LeadWithRelations } from "@/lib/db/types";
import type { User } from "@/lib/db/types";
import {
  formatDate, LEAD_STATUT_LABELS, LEAD_STATUT_VARIANT,
  SOURCE_LABELS
} from "@/lib/format";

interface Filters {
  statut: string[];
  commercial: string;
  source: string[];
  pre_dossier: boolean;
  en_retard: boolean;
  sort: string;
  dir: 'asc' | 'desc';
}

interface Props {
  leads: LeadWithRelations[];
  currentUser: User;
  commercials: User[];
  currentFilters: Filters;
}

const STATUTS = ['nouveau', 'qualifie', 'en_cours', 'gagne', 'perdu'];
const SOURCES = ['formulaire_web', 'telephone', 'recommandation', 'autre'];

export function LeadsListClient({ leads, currentUser, commercials, currentFilters }: Props) {
  const router = useRouter();
  const [filters, setFilters] = React.useState(currentFilters);

  function pushFilters(newFilters: Filters) {
    const p = new URLSearchParams();
    for (const s of newFilters.statut) p.append('statut', s);
    for (const s of newFilters.source) p.append('source', s);
    if (newFilters.commercial) p.set('commercial', newFilters.commercial);
    if (newFilters.pre_dossier) p.set('pre_dossier', '1');
    if (newFilters.en_retard) p.set('en_retard', '1');
    if (newFilters.sort !== 'l.date_creation') p.set('sort', newFilters.sort);
    if (newFilters.dir !== 'desc') p.set('dir', newFilters.dir);
    router.push(`/leads?${p.toString()}`);
  }

  function toggleStatut(s: string) {
    const next = filters.statut.includes(s)
      ? filters.statut.filter(x => x !== s)
      : [...filters.statut, s];
    const f = { ...filters, statut: next };
    setFilters(f);
    pushFilters(f);
  }

  function toggleSource(s: string) {
    const next = filters.source.includes(s)
      ? filters.source.filter(x => x !== s)
      : [...filters.source, s];
    const f = { ...filters, source: next };
    setFilters(f);
    pushFilters(f);
  }

  function handleSort(key: string) {
    const f = {
      ...filters,
      sort: key,
      dir: filters.sort === key && filters.dir === 'asc' ? 'desc' as const : 'asc' as const,
    };
    setFilters(f);
    pushFilters(f);
  }

  const showCommercialCol = ['gestionnaire', 'admin', 'super_admin'].includes(currentUser.role);

  const columns: Column<LeadWithRelations>[] = [
    {
      key: 'nom',
      header: 'Apprenant',
      sortable: true,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{row.prenom} {row.nom}</span>
          <span className="text-[11px] text-foreground-muted">{row.email}</span>
        </div>
      ),
    },
    {
      key: 'statut',
      header: 'Statut',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={LEAD_STATUT_VARIANT[row.statut] as Parameters<typeof Badge>[0]['variant']}>
            {LEAD_STATUT_LABELS[row.statut]}
          </Badge>
          {row.badge_pre_dossier && (
            <Badge variant="outline" className="text-indigo-600 border-indigo-300 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-400 dark:border-indigo-700 text-[10px]">
              Pré-dossier
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      sortable: true,
      cell: (row) => <span className="text-[12px] text-foreground-muted">{SOURCE_LABELS[row.source]}</span>,
    },
    ...(showCommercialCol ? [{
      key: 'commercial_nom',
      header: 'Commercial',
      sortable: true,
      cell: (row: LeadWithRelations) => (
        <span className="text-[12px]">{row.commercial_prenom} {row.commercial_nom}</span>
      ),
    } as Column<LeadWithRelations>] : []),
    {
      key: 'date_creation',
      header: 'Créé le',
      sortable: true,
      cell: (row) => <span className="text-[12px] text-foreground-muted tabular-nums">{formatDate(row.date_creation)}</span>,
    },
    {
      key: 'prochaine_relance',
      header: 'Relance',
      cell: (row) => row.prochaine_relance ? (
        <span className={`text-[12px] tabular-nums ${new Date(row.prochaine_relance) < new Date() ? 'text-red-600 font-medium' : 'text-foreground-muted'}`}>
          {formatDate(row.prochaine_relance)}
        </span>
      ) : <span className="text-foreground-subtle text-[12px]">—</span>,
    },
    ...(showCommercialCol ? [{
      key: 'commission_montant',
      header: 'Commission',
      cell: (row: LeadWithRelations) => row.commission_montant != null ? (
        <span className="text-[12px] tabular-nums">
          {row.commission_montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}
          {row.commission_statut === 'figee' && <span className="ml-1 text-foreground-subtle">🔒</span>}
        </span>
      ) : <span className="text-foreground-subtle text-[12px]">—</span>,
    } as Column<LeadWithRelations>] : []),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-surface shrink-0">
        {/* Statut filters */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-foreground-muted mr-1">Statut :</span>
          {STATUTS.map(s => (
            <button
              key={s}
              onClick={() => toggleStatut(s)}
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                filters.statut.includes(s)
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-surface-hover text-foreground-muted hover:text-foreground'
              }`}
            >
              {LEAD_STATUT_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Source filters */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-foreground-muted mr-1">Source :</span>
          {SOURCES.map(s => (
            <button
              key={s}
              onClick={() => toggleSource(s)}
              className={`px-2 py-0.5 rounded-full text-[11px] transition-colors ${
                filters.source.includes(s)
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-surface-hover text-foreground-muted hover:text-foreground'
              }`}
            >
              {SOURCE_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Toggles */}
        <button
          onClick={() => { const f = { ...filters, pre_dossier: !filters.pre_dossier }; setFilters(f); pushFilters(f); }}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition-colors ${
            filters.pre_dossier ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'bg-surface-hover text-foreground-muted hover:text-foreground'
          }`}
        >
          <FolderPlus className="h-[11px] w-[11px]" />
          Avec pré-dossier
        </button>

        <button
          onClick={() => { const f = { ...filters, en_retard: !filters.en_retard }; setFilters(f); pushFilters(f); }}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition-colors ${
            filters.en_retard ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-surface-hover text-foreground-muted hover:text-foreground'
          }`}
        >
          <Bell className="h-[11px] w-[11px]" />
          Relances en retard
        </button>

        {/* Commercial filter (only for non-commercial roles) */}
        {showCommercialCol && (
          <select
            value={filters.commercial}
            onChange={(e) => { const f = { ...filters, commercial: e.target.value }; setFilters(f); pushFilters(f); }}
            className="h-[26px] px-2 text-[11px] rounded-[5px] border border-border bg-surface text-foreground"
          >
            <option value="">Tous les commerciaux</option>
            {commercials.map(c => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        )}

        {/* Reset */}
        {(filters.statut.length > 0 || filters.source.length > 0 || filters.commercial || filters.pre_dossier || filters.en_retard) && (
          <button
            onClick={() => {
              const f: Filters = { statut: [], commercial: '', source: [], pre_dossier: false, en_retard: false, sort: 'l.date_creation', dir: 'desc' };
              setFilters(f);
              router.push('/leads');
            }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-foreground-muted hover:text-foreground bg-surface-hover ml-auto"
          >
            <X className="h-[10px] w-[10px]" />
            Réinitialiser
          </button>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        rows={leads}
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/leads/${r.id}`)}
        sortKey={filters.sort}
        sortDir={filters.dir === 'asc' ? 'asc' : 'desc'}
        onSort={handleSort}
        rowHeight="sm"
        emptyState={
          <div className="flex flex-col items-center justify-center py-16 text-foreground-muted">
            <p className="text-[13px]">Aucun lead ne correspond à vos filtres</p>
          </div>
        }
      />
    </div>
  );
}
