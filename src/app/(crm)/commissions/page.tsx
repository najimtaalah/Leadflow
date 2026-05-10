import Link from "next/link";
import { getCommissions } from "@/lib/db/leads";
import { getCurrentUser, canViewAllCommissions } from "@/lib/auth";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatEuro } from "@/lib/format";

export default async function CommissionsPage() {
  const user = await getCurrentUser();
  const commissions = getCommissions(
    canViewAllCommissions(user) ? {} : { commercial_id: user.id }
  );

  const totalFigees = commissions
    .filter(c => c.statut === 'figee')
    .reduce((s, c) => s + (c.montant ?? 0), 0);
  const totalLibres = commissions
    .filter(c => c.statut === 'libre')
    .reduce((s, c) => s + (c.montant ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Commissions"
        description={`${formatEuro(totalFigees)} figées · ${formatEuro(totalLibres)} en cours`}
      />
      <PageContent>
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Lead</th>
              {canViewAllCommissions(user) && <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Commercial</th>}
              <th className="text-right px-4 py-2 text-[11px] font-medium text-foreground-muted">Montant</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Statut</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Date figement</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map(c => (
              <tr key={c.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                <td className="px-4 py-2">
                  <Link href={`/leads/${c.lead_id}`} className="text-accent hover:underline">
                    {c.lead_prenom} {c.lead_nom}
                  </Link>
                </td>
                {canViewAllCommissions(user) && (
                  <td className="px-4 py-2 text-foreground-muted">{c.commercial_prenom} {c.commercial_nom}</td>
                )}
                <td className="px-4 py-2 text-right tabular-nums font-medium">{formatEuro(c.montant)}</td>
                <td className="px-4 py-2">
                  <Badge variant={c.statut === 'figee' ? 'gray' : 'green'}>
                    {c.statut === 'figee' ? '🔒 Figée' : 'Libre'}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-foreground-muted tabular-nums">{formatDate(c.date_figement)}</td>
              </tr>
            ))}
            {commissions.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-foreground-muted">Aucune commission</td></tr>
            )}
          </tbody>
        </table>
      </PageContent>
    </>
  );
}
