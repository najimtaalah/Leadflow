import { getPerformanceCommercials } from "@/lib/db/leads";
import { getCurrentUser, canViewAllLeads } from "@/lib/auth";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { formatEuro, formatPercent } from "@/lib/format";

interface Props {
  searchParams: Promise<{ commercial?: string; debut?: string; fin?: string }>;
}

export default async function PerformancePage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const isAdmin = canViewAllLeads(user);

  const data = getPerformanceCommercials({
    commercial_id: !isAdmin ? user.id : params.commercial || undefined,
    date_debut: params.debut,
    date_fin: params.fin,
  });

  return (
    <>
      <PageHeader title="Tableau de performance commerciaux" />
      <PageContent>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Commercial</th>
                <th className="text-right px-4 py-2 text-[11px] font-medium text-foreground-muted">Leads attribués</th>
                <th className="text-right px-4 py-2 text-[11px] font-medium text-foreground-muted">Actifs</th>
                <th className="text-right px-4 py-2 text-[11px] font-medium text-foreground-muted">Gagnés</th>
                <th className="text-right px-4 py-2 text-[11px] font-medium text-foreground-muted">Perdus</th>
                <th className="text-right px-4 py-2 text-[11px] font-medium text-foreground-muted">Taux conversion</th>
                <th className="text-right px-4 py-2 text-[11px] font-medium text-foreground-muted">Comm. figées</th>
                <th className="text-right px-4 py-2 text-[11px] font-medium text-foreground-muted">Comm. en cours</th>
                <th className="text-right px-4 py-2 text-[11px] font-medium text-foreground-muted">Relances en retard</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.commercial_id} className="border-b border-border hover:bg-surface-hover">
                  <td className="px-4 py-2 font-medium">{row.commercial_prenom} {row.commercial_nom}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.leads_attribues}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-blue-600">{row.leads_actifs}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-green-600 font-medium">{row.leads_gagnes}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600">{row.leads_perdus}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    {row.taux_conversion != null ? `${row.taux_conversion} %` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatEuro(row.commissions_figees)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatEuro(row.commissions_en_cours)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    <span className={row.relances_en_retard > 0 ? 'text-red-600 font-medium' : ''}>
                      {row.relances_en_retard}
                    </span>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-foreground-muted">Aucune donnée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PageContent>
    </>
  );
}
