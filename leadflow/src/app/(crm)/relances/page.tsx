import Link from "next/link";
import { getRelances, countRelancesEnRetard } from "@/lib/db/leads";
import { getCurrentUser, getAllUsers, canViewAllLeads } from "@/lib/auth";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { Badge } from "@/components/ui/badge";
import {
  formatDate, RELANCE_STATUT_LABELS, RELANCE_STATUT_VARIANT, RELANCE_TYPE_LABELS
} from "@/lib/format";

export default async function RelancesPage() {
  const user = await getCurrentUser();
  const allUsers = await getAllUsers();
  const commercials = allUsers.filter(u => ['commercial', 'gestionnaire'].includes(u.role));

  const relances = await getRelances({
    restricted_commercial_id: !canViewAllLeads(user) ? user.id : undefined,
  });

  const enRetard = relances.filter(r => r.statut === 'en_retard');
  const aFaire = relances.filter(r => r.statut === 'a_faire');
  const faites = relances.filter(r => r.statut === 'faite');

  return (
    <>
      <PageHeader
        title="Relances"
        description={`${enRetard.length} en retard · ${aFaire.length} à faire`}
      />
      <PageContent>
        {enRetard.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800 px-4 py-2 text-[12px] text-red-700 dark:text-red-300">
            ⚠ {enRetard.length} relance{enRetard.length > 1 ? 's' : ''} en retard
          </div>
        )}

        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Lead</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Type</th>
              {canViewAllLeads(user) && <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Commercial</th>}
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Date prévue</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Statut</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Notes</th>
            </tr>
          </thead>
          <tbody>
            {relances.map(r => (
              <tr key={r.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                <td className="px-4 py-2">
                  <Link href={`/leads/${r.lead_id}`} className="text-accent hover:underline">
                    {r.lead_prenom} {r.lead_nom}
                  </Link>
                </td>
                <td className="px-4 py-2">{RELANCE_TYPE_LABELS[r.type]}</td>
                {canViewAllLeads(user) && <td className="px-4 py-2 text-foreground-muted">{r.commercial_prenom} {r.commercial_nom}</td>}
                <td className="px-4 py-2 tabular-nums">
                  <span className={r.statut === 'en_retard' ? 'text-red-600 font-medium' : ''}>{formatDate(r.date_prevue)}</span>
                </td>
                <td className="px-4 py-2">
                  <Badge variant={RELANCE_STATUT_VARIANT[r.statut] as Parameters<typeof Badge>[0]['variant']}>
                    {RELANCE_STATUT_LABELS[r.statut]}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-foreground-muted">{r.notes ?? '—'}</td>
              </tr>
            ))}
            {relances.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-foreground-muted">Aucune relance</td></tr>
            )}
          </tbody>
        </table>
      </PageContent>
    </>
  );
}
