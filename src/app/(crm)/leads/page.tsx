import { getLeads } from "@/lib/db/leads";
import { getCurrentUser, getAllUsers, canViewAllLeads } from "@/lib/auth";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { LeadsListClient } from "./leads-list-client";

interface Props {
  searchParams: Promise<{
    statut?: string | string[];
    commercial?: string;
    source?: string | string[];
    pre_dossier?: string;
    en_retard?: string;
    sort?: string;
    dir?: string;
  }>;
}

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function LeadsPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const allUsers = getAllUsers();
  const commercials = allUsers.filter(u => ['commercial', 'gestionnaire'].includes(u.role));

  const leads = getLeads({
    statut: toArray(params.statut),
    commercial_id: params.commercial || undefined,
    source: toArray(params.source),
    avec_pre_dossier: params.pre_dossier === '1',
    relances_en_retard: params.en_retard === '1',
    restricted_commercial_id: !canViewAllLeads(user) ? user.id : undefined,
    sort_key: params.sort,
    sort_dir: (params.dir as 'asc' | 'desc') || 'desc',
  });

  return (
    <>
      <PageHeader
        title="Leads"
        description={`${leads.length} lead${leads.length !== 1 ? 's' : ''}`}
      />
      <PageContent>
        <LeadsListClient
          leads={leads}
          currentUser={user}
          commercials={commercials}
          currentFilters={{
            statut: toArray(params.statut),
            commercial: params.commercial || '',
            source: toArray(params.source),
            pre_dossier: params.pre_dossier === '1',
            en_retard: params.en_retard === '1',
            sort: params.sort || 'l.date_creation',
            dir: (params.dir as 'asc' | 'desc') || 'desc',
          }}
        />
      </PageContent>
    </>
  );
}
