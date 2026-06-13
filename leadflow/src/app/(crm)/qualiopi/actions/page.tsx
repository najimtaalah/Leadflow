import Link from "next/link";
import { listActions } from "@/lib/db/qualiopi-actions";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { Badge } from "@/components/ui/badge";
import {
  ACTION_STATUT_LABELS, ACTION_STATUT_VARIANT,
  ACTION_PRIORITE_LABELS, ACTION_PRIORITE_VARIANT,
  ACTION_FORMATION_LABELS, formatDate,
} from "@/lib/format";
import { Plus, Download, Eye, Pencil, Copy } from "lucide-react";
import type { ActionQualiopiStatut, ActionQualiopiPriorite, ActionQualiopiIndicateur, ActionQualiopiFormation } from "@/lib/db/types";

interface Props {
  searchParams: Promise<{
    indicateur?: string;
    formation?: string;
    statut?: string;
    priorite?: string;
    q?: string;
    page?: string;
  }>;
}

export default async function QualiopiActionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!['gestionnaire', 'admin', 'super_admin'].includes(user.role)) {
    return <div className="p-8 text-foreground-muted">Accès non autorisé.</div>;
  }

  const page = parseInt(params.page ?? '1', 10);
  const { actions, total } = await listActions({
    indicateur: params.indicateur as ActionQualiopiIndicateur | undefined,
    formation: params.formation as ActionQualiopiFormation | undefined,
    statut: params.statut as ActionQualiopiStatut | undefined,
    priorite: params.priorite as ActionQualiopiPriorite | undefined,
    q: params.q,
    page,
    limit: 25,
  });

  const canDelete = ['admin', 'super_admin'].includes(user.role);

  const totalPages = Math.ceil(total / 25);

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = { ...params, ...overrides };
    const qs = Object.entries(p)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join('&');
    return `/qualiopi/actions${qs ? `?${qs}` : ''}`;
  }

  return (
    <>
      <PageHeader
        title="Actions Qualiopi"
        description={`${total} action${total !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/qualiopi/actions/export"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-foreground-muted border border-border rounded-md hover:bg-surface-hover transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Exporter CSV
            </Link>
            <Link
              href="/qualiopi/actions/new"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-accent text-white rounded-md hover:bg-accent/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Créer une action
            </Link>
          </div>
        }
      />
      <PageContent>
        {/* Filtres */}
        <form method="GET" action="/qualiopi/actions" className="flex flex-wrap items-center gap-2 mb-4">
          <select
            name="indicateur"
            defaultValue={params.indicateur ?? ''}
            className="text-[12px] border border-border rounded px-2 py-1 bg-surface text-foreground"
          >
            <option value="">Tous les indicateurs</option>
            {(['IND-23', 'IND-24', 'IND-25', 'CRIT-5', 'CRIT-6'] as const).map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          <select
            name="formation"
            defaultValue={params.formation ?? ''}
            className="text-[12px] border border-border rounded px-2 py-1 bg-surface text-foreground"
          >
            <option value="">Toutes les formations</option>
            {Object.entries(ACTION_FORMATION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            name="statut"
            defaultValue={params.statut ?? ''}
            className="text-[12px] border border-border rounded px-2 py-1 bg-surface text-foreground"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(ACTION_STATUT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            name="priorite"
            defaultValue={params.priorite ?? ''}
            className="text-[12px] border border-border rounded px-2 py-1 bg-surface text-foreground"
          >
            <option value="">Toutes les priorités</option>
            {Object.entries(ACTION_PRIORITE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input
            type="text"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Rechercher..."
            className="text-[12px] border border-border rounded px-2 py-1 bg-surface text-foreground min-w-[150px]"
          />
          <button
            type="submit"
            className="text-[12px] px-3 py-1 bg-accent text-white rounded hover:bg-accent/90"
          >
            Filtrer
          </button>
          <Link
            href="/qualiopi/actions"
            className="text-[12px] px-3 py-1 border border-border rounded text-foreground-muted hover:bg-surface-hover"
          >
            Réinitialiser
          </Link>
        </form>

        {/* Tableau */}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-[11px] font-medium text-foreground-muted w-20">Priorité</th>
                <th className="text-left px-3 py-2 text-[11px] font-medium text-foreground-muted">Titre</th>
                <th className="text-left px-3 py-2 text-[11px] font-medium text-foreground-muted w-20">Indicateur</th>
                <th className="text-left px-3 py-2 text-[11px] font-medium text-foreground-muted w-28">Formation</th>
                <th className="text-left px-3 py-2 text-[11px] font-medium text-foreground-muted w-28">Responsable</th>
                <th className="text-left px-3 py-2 text-[11px] font-medium text-foreground-muted w-28">Échéance</th>
                <th className="text-left px-3 py-2 text-[11px] font-medium text-foreground-muted w-24">Statut</th>
                <th className="text-left px-3 py-2 text-[11px] font-medium text-foreground-muted w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => {
                const isLate = action.statut === 'en_retard';
                const daysLate = isLate && action.date_echeance
                  ? Math.floor((Date.now() - new Date(action.date_echeance).getTime()) / 86400000)
                  : 0;

                return (
                  <tr
                    key={action.id}
                    className={`border-b border-border hover:bg-surface-hover transition-colors ${isLate ? 'bg-red-50/30' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <Badge variant={ACTION_PRIORITE_VARIANT[action.priorite] as Parameters<typeof Badge>[0]['variant']}>
                        {ACTION_PRIORITE_LABELS[action.priorite]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      <Link
                        href={`/qualiopi/actions/${action.id}`}
                        className="font-medium text-foreground hover:text-accent truncate block"
                      >
                        {action.titre}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-[11px] text-foreground-muted">{action.indicateur}</span>
                    </td>
                    <td className="px-3 py-2 text-foreground-muted">
                      {action.formation ? ACTION_FORMATION_LABELS[action.formation] : '—'}
                    </td>
                    <td className="px-3 py-2 text-foreground-muted truncate max-w-[120px]">
                      {action.responsable ?? '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {action.date_echeance ? (
                        <span className={isLate ? 'text-red-600 font-medium' : 'text-foreground-muted'}>
                          {formatDate(action.date_echeance)}
                          {isLate && daysLate > 0 && (
                            <span className="ml-1 text-[10px]">(J+{daysLate})</span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={ACTION_STATUT_VARIANT[action.statut] as Parameters<typeof Badge>[0]['variant']}>
                        {ACTION_STATUT_LABELS[action.statut]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/qualiopi/actions/${action.id}`}
                          className="p-1 rounded hover:bg-surface-hover text-foreground-muted hover:text-foreground"
                          title="Voir"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          href={`/qualiopi/actions/${action.id}/edit`}
                          className="p-1 rounded hover:bg-surface-hover text-foreground-muted hover:text-foreground"
                          title="Modifier"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          href={`/qualiopi/actions/new?duplicate=${action.id}`}
                          className="p-1 rounded hover:bg-surface-hover text-foreground-muted hover:text-foreground"
                          title="Dupliquer"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {actions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-foreground-muted">
                    Aucune action Qualiopi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <span className="text-[11px] text-foreground-muted">
              Page {page} / {totalPages} — {total} actions
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildUrl({ page: String(page - 1) })}
                  className="text-[12px] px-3 py-1 border border-border rounded hover:bg-surface-hover"
                >
                  ← Précédent
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildUrl({ page: String(page + 1) })}
                  className="text-[12px] px-3 py-1 border border-border rounded hover:bg-surface-hover"
                >
                  Suivant →
                </Link>
              )}
            </div>
          </div>
        )}
      </PageContent>
    </>
  );
}
