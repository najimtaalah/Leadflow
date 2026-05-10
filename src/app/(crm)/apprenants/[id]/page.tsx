import { notFound } from "next/navigation";
import Link from "next/link";
import { getApprenantById } from "@/lib/db/dossiers";
import { getDossiers } from "@/lib/db/dossiers";
import { getCurrentUser, canViewAllLeads } from "@/lib/auth";
import { PageHeader, PageContent } from "@/components/ds/app-layout";
import { Badge } from "@/components/ui/badge";
import {
  formatDate, DOSSIER_STATUT_LABELS, DOSSIER_STATUT_VARIANT,
  FORMATION_TYPE_LABELS, FORMULE_LABELS
} from "@/lib/format";

interface Props { params: Promise<{ id: string }>; }

export default async function ApprenantDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  const [apprenant, dossiers] = await Promise.all([
    getApprenantById(id),
    getDossiers({ restricted_commercial_id: undefined }).then(all => all.filter(d => d.id_apprenant === id)),
  ]);
  if (!apprenant) notFound();

  return (
    <>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <Link href="/apprenants" className="text-foreground-muted hover:text-foreground text-[13px]">Apprenants</Link>
            <span className="text-foreground-subtle">/</span>
            <span>{apprenant.prenom} {apprenant.nom}</span>
            <Badge variant={apprenant.statut === 'actif' ? 'green' : 'gray'}>
              {apprenant.statut === 'actif' ? 'Actif' : 'Pré-actif'}
            </Badge>
          </div>
        }
      />
      <PageContent className="overflow-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col gap-4">
          {/* Section A – Identité */}
          <div className="rounded-[6px] border border-border bg-surface p-4">
            <h2 className="text-[12px] font-semibold text-foreground-muted uppercase tracking-wide mb-3">Identité</h2>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <Field label="ID Apprenant" value={apprenant.id} className="col-span-2 font-mono text-[11px]" />
              {apprenant.id_lead_origine && (
                <div>
                  <p className="text-[11px] text-foreground-muted mb-0.5">Lead d'origine</p>
                  <Link href={`/leads/${apprenant.id_lead_origine}`} className="text-accent text-[13px] hover:underline">
                    {apprenant.lead_prenom} {apprenant.lead_nom}
                  </Link>
                </div>
              )}
              <Field label="Prénom" value={apprenant.prenom} />
              <Field label="Nom" value={apprenant.nom} />
              <Field label="Date de naissance" value={formatDate(apprenant.date_naissance)} />
              <Field label="Lieu de naissance" value={apprenant.lieu_naissance ?? '—'} />
              <Field label="Nationalité" value={apprenant.nationalite ?? '—'} />
            </div>
          </div>

          {/* Section B – Contact */}
          <div className="rounded-[6px] border border-border bg-surface p-4">
            <h2 className="text-[12px] font-semibold text-foreground-muted uppercase tracking-wide mb-3">Contact</h2>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <Field label="Email" value={apprenant.email} />
              <Field label="Téléphone" value={apprenant.telephone} />
              <Field label="Adresse" value={apprenant.adresse ?? '—'} />
              <Field label="Code postal" value={apprenant.code_postal ?? '—'} />
              <Field label="Ville" value={apprenant.ville ?? '—'} />
            </div>
          </div>

          {/* Section C – Dossiers */}
          <div className="rounded-[6px] border border-border bg-surface p-4">
            <h2 className="text-[12px] font-semibold text-foreground-muted uppercase tracking-wide mb-3">
              Dossiers ({dossiers.length})
            </h2>
            {dossiers.length === 0 ? (
              <p className="text-[12px] text-foreground-muted">Aucun dossier</p>
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 text-[11px] font-medium text-foreground-muted">Formation</th>
                    <th className="text-left py-1.5 text-[11px] font-medium text-foreground-muted">Statut</th>
                    <th className="text-left py-1.5 text-[11px] font-medium text-foreground-muted">Créé le</th>
                    <th className="text-left py-1.5 text-[11px] font-medium text-foreground-muted"></th>
                  </tr>
                </thead>
                <tbody>
                  {dossiers.map(d => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <td className="py-1.5">{FORMATION_TYPE_LABELS[d.formation_type]} · {FORMULE_LABELS[d.formule]}</td>
                      <td className="py-1.5">
                        <Badge variant={DOSSIER_STATUT_VARIANT[d.statut] as Parameters<typeof Badge>[0]['variant']}>
                          {DOSSIER_STATUT_LABELS[d.statut]}
                        </Badge>
                      </td>
                      <td className="py-1.5 text-foreground-muted">{formatDate(d.date_creation)}</td>
                      <td className="py-1.5">
                        <Link href={`/dossiers/${d.id}`} className="text-accent text-[11px] hover:underline">Voir →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </PageContent>
    </>
  );
}

function Field({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[11px] text-foreground-muted mb-0.5">{label}</p>
      <p className="text-[13px] text-foreground">{value}</p>
    </div>
  );
}
