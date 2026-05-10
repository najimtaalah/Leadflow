import { notFound } from "next/navigation";
import Link from "next/link";
import { getLeadById, getLeadTimeline, getRelances } from "@/lib/db/leads";
import { getCurrentUser, canModifyLead, canOpenPreDossier, canUnlockCommission, getAllUsers } from "@/lib/auth";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { Badge } from "@/components/ui/badge";
import { LeadDetailClient } from "./lead-detail-client";
import {
  formatDate, formatDateTime,
  LEAD_STATUT_LABELS, LEAD_STATUT_VARIANT,
  SOURCE_LABELS, ROLE_LABELS
} from "@/lib/format";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LeadPage({ params }: Props) {
  const { id } = await params;
  const [lead, user, timeline] = await Promise.all([
    getLeadById(id),
    getCurrentUser(),
    getLeadTimeline(id),
  ]);

  if (!lead) notFound();

  const canEdit = canModifyLead(user, lead.commercial_id);
  const canPreDossier = canOpenPreDossier(user) && !lead.badge_pre_dossier && !['gagne', 'perdu'].includes(lead.statut);
  const canUnlock = canUnlockCommission(user);
  const allUsers = await getAllUsers();
  const relances = (await getRelances({ restricted_commercial_id: undefined })).filter(r => r.lead_id === id);

  return (
    <>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <Link href="/leads" className="text-foreground-muted hover:text-foreground text-[13px] transition-colors">Leads</Link>
            <span className="text-foreground-subtle">/</span>
            <span>{lead.prenom} {lead.nom}</span>
            <Badge variant={LEAD_STATUT_VARIANT[lead.statut] as Parameters<typeof Badge>[0]['variant']}>
              {LEAD_STATUT_LABELS[lead.statut]}
            </Badge>
            {lead.badge_pre_dossier && (
              <Badge variant="outline" className="text-indigo-600 border-indigo-300 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-400 text-[10px]">
                Pré-dossier ouvert
              </Badge>
            )}
          </div>
        }
      />
      <PageContent className="overflow-auto">
        <LeadDetailClient
          lead={lead}
          timeline={timeline}
          relances={relances}
          currentUser={user}
          allUsers={allUsers}
          canEdit={canEdit}
          canPreDossier={canPreDossier}
          canUnlock={canUnlock}
        />
      </PageContent>
    </>
  );
}
