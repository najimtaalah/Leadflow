import { notFound } from "next/navigation";
import Link from "next/link";
import { getActionById } from "@/lib/db/qualiopi-actions";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { ActionQualiopiForm } from "@/components/crm/qualiopi-action-form";

interface Props { params: Promise<{ id: string }> }

export default async function EditActionPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!['gestionnaire', 'admin', 'super_admin'].includes(user.role)) {
    return <div className="p-8 text-foreground-muted">Accès non autorisé.</div>;
  }

  const action = await getActionById(id);
  if (!action) notFound();

  const isResponsable = action.responsable === `${user.prenom} ${user.nom}` ||
    action.responsable === user.email;
  const isAdmin = ['admin', 'super_admin'].includes(user.role);

  if (user.role === 'gestionnaire' && !isResponsable && !isAdmin) {
    return <div className="p-8 text-foreground-muted">Vous n'êtes pas autorisé à modifier cette action.</div>;
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
            <Link href={`/qualiopi/actions/${id}`} className="text-foreground-muted hover:text-foreground text-[13px] truncate max-w-xs">
              {action.titre}
            </Link>
            <span className="text-foreground-subtle">/</span>
            <span>Modifier</span>
          </div>
        }
      />
      <PageContent>
        <div className="max-w-2xl">
          <ActionQualiopiForm
            actionId={id}
            defaultValues={{
              indicateur: action.indicateur,
              formation: action.formation ?? undefined,
              titre: action.titre,
              description: action.description ?? undefined,
              responsable: action.responsable ?? undefined,
              date_echeance: action.date_echeance ?? undefined,
              statut: action.statut,
              priorite: action.priorite,
              preuve: action.preuve ?? undefined,
              source_veille_semaine: action.source_veille_semaine ?? undefined,
            }}
            currentStatut={action.statut}
            currentUserName={`${user.prenom} ${user.nom}`}
            isEdit
          />
        </div>
      </PageContent>
    </>
  );
}
