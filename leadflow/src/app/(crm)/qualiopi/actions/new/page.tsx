import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getActionById } from "@/lib/db/qualiopi-actions";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { ActionQualiopiForm } from "@/components/crm/qualiopi-action-form";

interface Props {
  searchParams: Promise<{
    indicateur?: string;
    veille?: string;
    duplicate?: string;
  }>;
}

export default async function NewActionPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!['gestionnaire', 'admin', 'super_admin'].includes(user.role)) {
    return <div className="p-8 text-foreground-muted">Accès non autorisé.</div>;
  }

  let duplicateData = null;
  if (params.duplicate) {
    const source = await getActionById(params.duplicate);
    if (!source) notFound();
    duplicateData = source;
  }

  return (
    <>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <Link href="/qualiopi/actions" className="text-foreground-muted hover:text-foreground text-[13px]">
              Actions Qualiopi
            </Link>
            <span className="text-foreground-subtle">/</span>
            <span>{duplicateData ? 'Dupliquer' : 'Nouvelle action'}</span>
          </div>
        }
      />
      <PageContent>
        <div className="max-w-2xl">
          <ActionQualiopiForm
            defaultIndicateur={params.indicateur ?? duplicateData?.indicateur}
            defaultVeille={params.veille ?? duplicateData?.source_veille_semaine ?? undefined}
            defaultValues={duplicateData ? {
              indicateur: duplicateData.indicateur,
              formation: duplicateData.formation ?? undefined,
              titre: `${duplicateData.titre} (copie)`,
              description: duplicateData.description ?? undefined,
              responsable: duplicateData.responsable ?? undefined,
              priorite: duplicateData.priorite,
              preuve: undefined,
              source_veille_semaine: duplicateData.source_veille_semaine ?? undefined,
            } : undefined}
            currentUserName={`${user.prenom} ${user.nom}`}
          />
        </div>
      </PageContent>
    </>
  );
}
