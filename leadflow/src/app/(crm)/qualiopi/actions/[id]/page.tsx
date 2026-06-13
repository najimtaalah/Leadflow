import { notFound } from "next/navigation";
import Link from "next/link";
import { getActionById } from "@/lib/db/qualiopi-actions";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { Badge } from "@/components/ui/badge";
import {
  ACTION_STATUT_LABELS, ACTION_STATUT_VARIANT,
  ACTION_PRIORITE_LABELS, ACTION_PRIORITE_VARIANT,
  ACTION_FORMATION_LABELS, formatDate, formatDateTime,
} from "@/lib/format";
import { Pencil, Copy, Clock, CheckCircle2, XCircle, AlertCircle, PlayCircle } from "lucide-react";
import { ActionChangeStatutButton } from "@/components/crm/qualiopi-action-statut-button";
import type { ActionQualiopiStatut } from "@/lib/db/types";

interface Props { params: Promise<{ id: string }> }

const STATUT_ICONS: Record<ActionQualiopiStatut, React.ReactNode> = {
  a_faire: <Clock className="h-4 w-4" />,
  en_cours: <PlayCircle className="h-4 w-4" />,
  fait: <CheckCircle2 className="h-4 w-4" />,
  en_retard: <AlertCircle className="h-4 w-4" />,
  annule: <XCircle className="h-4 w-4" />,
};

export default async function ActionDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!['gestionnaire', 'admin', 'super_admin'].includes(user.role)) {
    return <div className="p-8 text-foreground-muted">Accès non autorisé.</div>;
  }

  const action = await getActionById(id);
  if (!action) notFound();

  const isLate = action.statut === 'en_retard';
  const daysLate = isLate && action.date_echeance
    ? Math.floor((Date.now() - new Date(action.date_echeance).getTime()) / 86400000)
    : 0;
  const daysTilDue = !isLate && action.date_echeance && action.statut !== 'fait'
    ? Math.ceil((new Date(action.date_echeance).getTime() - Date.now()) / 86400000)
    : null;

  const canEdit = user.role !== 'gestionnaire' ||
    action.responsable === `${user.prenom} ${user.nom}` ||
    action.responsable === user.email;

  return (
    <>
      <PageHeader
        title={
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/qualiopi/actions" className="text-foreground-muted hover:text-foreground text-[13px]">
              Actions Qualiopi
            </Link>
            <span className="text-foreground-subtle">/</span>
            <span className="truncate max-w-xs">{action.titre}</span>
            <Badge variant={ACTION_STATUT_VARIANT[action.statut] as Parameters<typeof Badge>[0]['variant']}>
              {STATUT_ICONS[action.statut]}
              <span className="ml-1">{ACTION_STATUT_LABELS[action.statut]}</span>
            </Badge>
            <Badge variant={ACTION_PRIORITE_VARIANT[action.priorite] as Parameters<typeof Badge>[0]['variant']}>
              {ACTION_PRIORITE_LABELS[action.priorite]}
            </Badge>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <Link
                href={`/qualiopi/actions/${id}/edit`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-border rounded-md hover:bg-surface-hover"
              >
                <Pencil className="h-3.5 w-3.5" />
                Modifier
              </Link>
            )}
            <Link
              href={`/qualiopi/actions/new?duplicate=${id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-border rounded-md hover:bg-surface-hover"
            >
              <Copy className="h-3.5 w-3.5" />
              Dupliquer
            </Link>
          </div>
        }
      />
      <PageContent>
        <div className="max-w-2xl space-y-6">
          {/* Alert retard */}
          {isLate && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[12px]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-medium">EN RETARD depuis {daysLate} jour{daysLate > 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Infos principales */}
          <div className="bg-surface border border-border rounded-lg divide-y divide-border">
            <div className="px-4 py-3 grid grid-cols-3 gap-2">
              <span className="text-[11px] font-medium text-foreground-muted">Indicateur</span>
              <span className="col-span-2 text-[13px] font-mono font-medium">{action.indicateur}</span>
            </div>
            {action.formation && (
              <div className="px-4 py-3 grid grid-cols-3 gap-2">
                <span className="text-[11px] font-medium text-foreground-muted">Formation</span>
                <span className="col-span-2 text-[13px]">{ACTION_FORMATION_LABELS[action.formation]}</span>
              </div>
            )}
            {action.description && (
              <div className="px-4 py-3 grid grid-cols-3 gap-2">
                <span className="text-[11px] font-medium text-foreground-muted">Description</span>
                <p className="col-span-2 text-[13px] text-foreground-muted whitespace-pre-wrap">{action.description}</p>
              </div>
            )}
            {action.responsable && (
              <div className="px-4 py-3 grid grid-cols-3 gap-2">
                <span className="text-[11px] font-medium text-foreground-muted">Responsable</span>
                <span className="col-span-2 text-[13px]">{action.responsable}</span>
              </div>
            )}
            {action.date_echeance && (
              <div className="px-4 py-3 grid grid-cols-3 gap-2">
                <span className="text-[11px] font-medium text-foreground-muted">Échéance</span>
                <div className="col-span-2 text-[13px]">
                  <span className={isLate ? 'text-red-600 font-medium' : ''}>
                    {formatDate(action.date_echeance)}
                  </span>
                  {isLate && (
                    <span className="ml-2 text-red-600 text-[11px]">en retard depuis {daysLate} jour{daysLate > 1 ? 's' : ''}</span>
                  )}
                  {daysTilDue !== null && daysTilDue >= 0 && (
                    <span className="ml-2 text-foreground-muted text-[11px]">dans {daysTilDue} jour{daysTilDue > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            )}
            {action.preuve && (
              <div className="px-4 py-3 grid grid-cols-3 gap-2">
                <span className="text-[11px] font-medium text-foreground-muted">Preuve</span>
                <div className="col-span-2 text-[13px]">
                  {action.preuve.startsWith('http') ? (
                    <a href={action.preuve} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      {action.preuve}
                    </a>
                  ) : (
                    <span className="text-foreground-muted">{action.preuve}</span>
                  )}
                </div>
              </div>
            )}
            {action.preuve_fichier_url && (
              <div className="px-4 py-3 grid grid-cols-3 gap-2">
                <span className="text-[11px] font-medium text-foreground-muted">Pièce jointe</span>
                <div className="col-span-2">
                  <a
                    href={action.preuve_fichier_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-accent hover:underline"
                  >
                    Télécharger
                  </a>
                </div>
              </div>
            )}
            {action.source_veille_semaine && (
              <div className="px-4 py-3 grid grid-cols-3 gap-2">
                <span className="text-[11px] font-medium text-foreground-muted">Semaine veille</span>
                <span className="col-span-2 text-[13px] font-mono">{action.source_veille_semaine}</span>
              </div>
            )}
          </div>

          {/* Changement de statut rapide */}
          {canEdit && action.statut !== 'annule' && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-[11px] font-medium text-foreground-muted mb-3">Changer le statut</p>
              <ActionChangeStatutButton action={action} />
            </div>
          )}

          {/* Métadonnées */}
          <div className="bg-surface-subtle border border-border rounded-lg p-4 text-[11px] text-foreground-muted space-y-1">
            <div>Créé le {formatDateTime(action.created_at)}{action.created_by ? ` par ${action.created_by}` : ''}</div>
            <div>Modifié le {formatDateTime(action.updated_at)}</div>
          </div>

          {/* Historique */}
          {action.history.length > 0 && (
            <div>
              <h2 className="text-[13px] font-medium mb-2">Historique des transitions</h2>
              <div className="space-y-1">
                {action.history.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 text-[12px] py-1.5 border-b border-border last:border-0">
                    <span className="text-foreground-subtle w-36 shrink-0">{formatDateTime(h.created_at)}</span>
                    <span className="text-foreground-muted">
                      {h.statut_avant ? (
                        <>
                          <Badge variant={ACTION_STATUT_VARIANT[h.statut_avant] as Parameters<typeof Badge>[0]['variant']} className="text-[10px]">
                            {ACTION_STATUT_LABELS[h.statut_avant]}
                          </Badge>
                          <span className="mx-1">→</span>
                        </>
                      ) : 'Créée → '}
                      <Badge variant={ACTION_STATUT_VARIANT[h.statut_apres] as Parameters<typeof Badge>[0]['variant']} className="text-[10px]">
                        {ACTION_STATUT_LABELS[h.statut_apres]}
                      </Badge>
                    </span>
                    {h.changed_by && <span className="text-foreground-subtle">par {h.changed_by}</span>}
                    {h.note && <span className="text-foreground-subtle italic">— {h.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PageContent>
    </>
  );
}
