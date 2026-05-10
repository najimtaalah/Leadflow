import Link from "next/link";
import { getDossiers } from "@/lib/db/dossiers";
import { getCurrentUser, getAllUsers, canViewAllLeads } from "@/lib/auth";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { Badge } from "@/components/ui/badge";
import {
  formatDate,
  DOSSIER_STATUT_LABELS, DOSSIER_STATUT_VARIANT,
  BLOC_STATUT_LABELS, BLOC_STATUT_VARIANT,
  FINANCEMENT_LABELS, FINANCEMENT_VARIANT,
  FORMATION_TYPE_LABELS, FORMULE_LABELS
} from "@/lib/format";

interface Props {
  searchParams: Promise<{
    statut?: string | string[];
    bloc_admin?: string;
    bloc_fin?: string;
    financement?: string | string[];
  }>;
}

export default async function DossiersPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getCurrentUser();

  const toArr = (v: string | string[] | undefined) => v ? (Array.isArray(v) ? v : [v]) : [];

  const dossiers = await getDossiers({
    statut: toArr(params.statut),
    statut_bloc_admin: params.bloc_admin || undefined,
    statut_bloc_financier: params.bloc_fin || undefined,
    type_financement: toArr(params.financement),
    restricted_commercial_id: !canViewAllLeads(user) ? user.id : undefined,
  });

  return (
    <>
      <PageHeader
        title="Dossiers"
        description={`${dossiers.length} dossier${dossiers.length !== 1 ? 's' : ''}`}
      />
      <PageContent>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Apprenant</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Formation</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Financement</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Statut dossier</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Bloc admin</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Bloc financier</th>
                {canViewAllLeads(user) && <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Gestionnaire</th>}
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.map(d => (
                <tr key={d.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-2">
                    <Link href={`/dossiers/${d.id}`} className="font-medium text-foreground hover:text-accent">
                      {d.apprenant_prenom} {d.apprenant_nom}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-foreground-muted">
                    {FORMATION_TYPE_LABELS[d.formation_type]} · {FORMULE_LABELS[d.formule]}
                  </td>
                  <td className="px-4 py-2">
                    {d.type_financement ? (
                      <Badge variant={FINANCEMENT_VARIANT[d.type_financement] as Parameters<typeof Badge>[0]['variant']}>
                        {FINANCEMENT_LABELS[d.type_financement]}
                      </Badge>
                    ) : <span className="text-foreground-subtle">—</span>}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={DOSSIER_STATUT_VARIANT[d.statut] as Parameters<typeof Badge>[0]['variant']}>
                      {DOSSIER_STATUT_LABELS[d.statut]}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={BLOC_STATUT_VARIANT[d.statut_bloc_admin] as Parameters<typeof Badge>[0]['variant']}>
                      {BLOC_STATUT_LABELS[d.statut_bloc_admin]}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={BLOC_STATUT_VARIANT[d.statut_bloc_financier] as Parameters<typeof Badge>[0]['variant']}>
                      {BLOC_STATUT_LABELS[d.statut_bloc_financier]}
                    </Badge>
                  </td>
                  {canViewAllLeads(user) && (
                    <td className="px-4 py-2 text-foreground-muted">
                      {d.gestionnaire_prenom ? `${d.gestionnaire_prenom} ${d.gestionnaire_nom}` : '—'}
                    </td>
                  )}
                  <td className="px-4 py-2 text-foreground-muted tabular-nums">{formatDate(d.date_creation)}</td>
                </tr>
              ))}
              {dossiers.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-foreground-muted">Aucun dossier</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PageContent>
    </>
  );
}
