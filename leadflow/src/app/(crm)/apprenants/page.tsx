import Link from "next/link";
import { getApprenants } from "@/lib/db/dossiers";
import { getCurrentUser, canViewAllLeads } from "@/lib/auth";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export default async function ApprenantPage() {
  const user = await getCurrentUser();
  const apprenants = await getApprenants({
    restricted_commercial_id: !canViewAllLeads(user) ? user.id : undefined,
  });

  return (
    <>
      <PageHeader
        title="Apprenants"
        description={`${apprenants.length} apprenant${apprenants.length !== 1 ? 's' : ''}`}
      />
      <PageContent>
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Apprenant</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Email</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Téléphone</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Lead d'origine</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Statut</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-foreground-muted">Dossiers</th>
            </tr>
          </thead>
          <tbody>
            {apprenants.map(a => (
              <tr key={a.id} className="border-b border-border hover:bg-surface-hover transition-colors cursor-pointer">
                <td className="px-4 py-2">
                  <Link href={`/apprenants/${a.id}`} className="font-medium text-foreground hover:text-accent">
                    {a.prenom} {a.nom}
                  </Link>
                  <p className="text-[11px] text-foreground-muted">{formatDate(a.created_at)}</p>
                </td>
                <td className="px-4 py-2 text-foreground-muted">{a.email}</td>
                <td className="px-4 py-2 text-foreground-muted">{a.telephone}</td>
                <td className="px-4 py-2">
                  {a.id_lead_origine ? (
                    <Link href={`/leads/${a.id_lead_origine}`} className="text-accent hover:underline">
                      {a.lead_prenom} {a.lead_nom}
                    </Link>
                  ) : <span className="text-foreground-subtle">—</span>}
                </td>
                <td className="px-4 py-2">
                  <Badge variant={a.statut === 'actif' ? 'green' : 'gray'}>
                    {a.statut === 'actif' ? 'Actif' : 'Pré-actif'}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{a.nb_dossiers}</td>
              </tr>
            ))}
            {apprenants.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-foreground-muted">Aucun apprenant</td></tr>
            )}
          </tbody>
        </table>
      </PageContent>
    </>
  );
}
