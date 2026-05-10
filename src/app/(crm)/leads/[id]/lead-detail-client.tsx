"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Phone, Mail, Calendar, Bell, FileText, FolderPlus,
  ArrowRight, X, ChevronDown, Unlock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LeadWithRelations, TimelineActivite, RelanceWithLead, User } from "@/lib/db/types";
import {
  formatDate, formatDateTime, formatEuro,
  LEAD_STATUT_LABELS, LEAD_STATUT_VARIANT,
  SOURCE_LABELS, FORMATION_TYPE_LABELS, FORMULE_LABELS, ROLE_LABELS,
  RELANCE_STATUT_LABELS, RELANCE_STATUT_VARIANT, RELANCE_TYPE_LABELS
} from "@/lib/format";
import {
  actionChangerStatutLead, actionOuvrirPreDossier,
  actionCreerRelance, actionMarquerRelanceFaite, actionUnlockCommission
} from "../actions";
import type { LeadStatut, RelanceType, FormationType, Formule } from "@/lib/db/types";

interface Props {
  lead: LeadWithRelations;
  timeline: TimelineActivite[];
  relances: RelanceWithLead[];
  currentUser: User;
  allUsers: User[];
  canEdit: boolean;
  canPreDossier: boolean;
  canUnlock: boolean;
}

const TIMELINE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  appel: Phone,
  message: Mail,
  rdv: Calendar,
  relance: Bell,
  note: FileText,
  changement_statut: ArrowRight,
  pre_dossier_ouvert: FolderPlus,
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  nouveau: ['qualifie', 'perdu'],
  qualifie: ['en_cours', 'perdu'],
  en_cours: ['perdu'],
  gagne: [],
  perdu: [],
};

export function LeadDetailClient({ lead, timeline, relances, currentUser, allUsers, canEdit, canPreDossier, canUnlock }: Props) {
  const router = useRouter();
  const [showPreDossierForm, setShowPreDossierForm] = React.useState(false);
  const [showRelanceForm, setShowRelanceForm] = React.useState(false);
  const [showUnlockModal, setShowUnlockModal] = React.useState(false);
  const [unlockMotif, setUnlockMotif] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const transitions = VALID_TRANSITIONS[lead.statut] ?? [];

  async function handleStatutChange(newStatut: string) {
    setLoading(true);
    try {
      await actionChangerStatutLead(lead.id, newStatut as LeadStatut, lead.commercial_id, lead.statut);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRelanceFaite(relanceId: string) {
    await actionMarquerRelanceFaite(relanceId, lead.id);
    router.refresh();
  }

  async function handleUnlock() {
    if (unlockMotif.length < 20) { setError('Le motif doit contenir au moins 20 caractères'); return; }
    setLoading(true);
    try {
      await actionUnlockCommission(lead.id, 'n/a', unlockMotif);
      setShowUnlockModal(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col gap-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[12px] px-3 py-2 rounded-[5px] flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X className="h-3 w-3" /></button>
        </div>
      )}

      {/* Section A – Identité & Contact */}
      <div className="rounded-[6px] border border-border bg-surface p-4">
        <h2 className="text-[12px] font-semibold text-foreground-muted uppercase tracking-wide mb-3">Identité & Contact</h2>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <Field label="Prénom" value={lead.prenom} />
          <Field label="Nom" value={lead.nom} />
          <Field label="Email" value={lead.email} />
          <Field label="Téléphone" value={lead.telephone} />
          <Field label="Source" value={SOURCE_LABELS[lead.source]} />
          {lead.notes && <Field label="Notes" value={lead.notes} className="col-span-2" />}
        </div>
      </div>

      {/* Section B – Attribution */}
      <div className="rounded-[6px] border border-border bg-surface p-4">
        <h2 className="text-[12px] font-semibold text-foreground-muted uppercase tracking-wide mb-3">Attribution</h2>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <Field label="Commercial" value={`${lead.commercial_prenom} ${lead.commercial_nom}`} />
          <Field label="Formation visée" value={lead.formation_visee ?? '—'} />
          <Field label="Créé le" value={formatDate(lead.date_creation)} />
          <div>
            <p className="text-[11px] text-foreground-muted mb-1">Statut</p>
            <div className="flex items-center gap-2">
              <Badge variant={LEAD_STATUT_VARIANT[lead.statut] as Parameters<typeof Badge>[0]['variant']}>
                {LEAD_STATUT_LABELS[lead.statut]}
              </Badge>
              {canEdit && transitions.length > 0 && (
                <div className="flex items-center gap-1">
                  {transitions.map(t => (
                    <Button
                      key={t}
                      size="xs"
                      variant={t === 'perdu' ? 'destructive' : 'secondary'}
                      onClick={() => handleStatutChange(t)}
                      disabled={loading}
                    >
                      → {LEAD_STATUT_LABELS[t]}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section C – Commission */}
      <div className="rounded-[6px] border border-border bg-surface p-4">
        <h2 className="text-[12px] font-semibold text-foreground-muted uppercase tracking-wide mb-3">Commission</h2>
        <div className="flex items-center gap-3 text-[13px]">
          <Field label="Montant" value={formatEuro(lead.commission_montant)} />
          {lead.commission_statut && (
            <div>
              <p className="text-[11px] text-foreground-muted mb-1">Statut</p>
              <Badge variant={lead.commission_statut === 'figee' ? 'gray' : 'green'}>
                {lead.commission_statut === 'figee' ? '🔒 Figée' : 'Libre'}
              </Badge>
            </div>
          )}
          {canUnlock && lead.commission_statut === 'figee' && (
            <Button size="xs" variant="outline" onClick={() => setShowUnlockModal(true)}>
              <Unlock className="h-3 w-3 mr-1" />
              Déverrouiller
            </Button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {canPreDossier && (
          <Button size="sm" onClick={() => setShowPreDossierForm(true)}>
            <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
            Ouvrir pré-dossier
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setShowRelanceForm(true)}>
          <Bell className="h-3.5 w-3.5 mr-1.5" />
          Programmer relance
        </Button>
      </div>

      {/* Relances */}
      {relances.length > 0 && (
        <div className="rounded-[6px] border border-border bg-surface p-4">
          <h2 className="text-[12px] font-semibold text-foreground-muted uppercase tracking-wide mb-3">Relances</h2>
          <div className="flex flex-col gap-1.5">
            {relances.map(r => (
              <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant={RELANCE_STATUT_VARIANT[r.statut] as Parameters<typeof Badge>[0]['variant']}>
                    {RELANCE_STATUT_LABELS[r.statut]}
                  </Badge>
                  <span className="text-[12px]">{RELANCE_TYPE_LABELS[r.type]}</span>
                  <span className="text-[12px] text-foreground-muted">{formatDate(r.date_prevue)}</span>
                  {r.notes && <span className="text-[11px] text-foreground-subtle">{r.notes}</span>}
                </div>
                {r.statut !== 'faite' && (
                  <Button size="xs" variant="ghost" onClick={() => handleRelanceFaite(r.id)}>
                    ✓ Faite
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-[6px] border border-border bg-surface p-4">
        <h2 className="text-[12px] font-semibold text-foreground-muted uppercase tracking-wide mb-3">Timeline</h2>
        {timeline.length === 0 ? (
          <p className="text-[12px] text-foreground-muted">Aucune activité enregistrée</p>
        ) : (
          <div className="flex flex-col gap-0">
            {timeline.map((entry, i) => {
              const Icon = TIMELINE_ICONS[entry.type] ?? FileText;
              return (
                <div key={entry.id} className="flex gap-3 py-2 relative">
                  {i < timeline.length - 1 && (
                    <div className="absolute left-[11px] top-[28px] bottom-0 w-px bg-border" />
                  )}
                  <div className="w-[22px] h-[22px] rounded-full bg-surface-hover flex items-center justify-center shrink-0 z-10">
                    <Icon className="h-[11px] w-[11px] text-foreground-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-foreground">{entry.description ?? entry.type}</p>
                    <p className="text-[11px] text-foreground-subtle">
                      {entry.auteur_prenom ? `${entry.auteur_prenom} ${entry.auteur_nom}` : 'Système'} · {formatDateTime(entry.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pré-dossier form drawer */}
      {showPreDossierForm && (
        <PreDossierModal
          lead={lead}
          onClose={() => setShowPreDossierForm(false)}
          onSuccess={() => { setShowPreDossierForm(false); router.refresh(); }}
        />
      )}

      {/* Relance form */}
      {showRelanceForm && (
        <RelanceModal
          leadId={lead.id}
          currentUserId={currentUser.id}
          onClose={() => setShowRelanceForm(false)}
          onSuccess={() => { setShowRelanceForm(false); router.refresh(); }}
        />
      )}

      {/* Unlock commission modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-[8px] border border-border shadow-xl w-full max-w-sm p-5">
            <h3 className="text-[14px] font-semibold mb-3">Déverrouiller la commission</h3>
            <p className="text-[12px] text-foreground-muted mb-3">Cette action sera tracée dans le journal d'audit.</p>
            <textarea
              value={unlockMotif}
              onChange={e => setUnlockMotif(e.target.value)}
              placeholder="Motif obligatoire (min. 20 caractères)"
              className="w-full h-[80px] text-[12px] px-2 py-1.5 border border-border rounded-[5px] bg-background resize-none"
            />
            <p className="text-[11px] text-foreground-muted mt-1">{unlockMotif.length}/20 caractères minimum</p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleUnlock} disabled={loading || unlockMotif.length < 20}>
                Déverrouiller
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowUnlockModal(false)}>Annuler</Button>
            </div>
          </div>
        </div>
      )}
    </div>
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

function PreDossierModal({ lead, onClose, onSuccess }: { lead: LeadWithRelations; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const fd = new FormData(e.currentTarget);
      await actionOuvrirPreDossier(fd);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-[8px] border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold">Ouvrir un pré-dossier</h3>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {error && <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-[12px] px-3 py-2 rounded-[5px] mb-3">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="lead_id" value={lead.id} />

          <div className="bg-surface-hover rounded-[5px] px-3 py-2 text-[11px] text-foreground-muted">
            Lead source : {lead.prenom} {lead.nom} · {SOURCE_LABELS[lead.source]}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Prénom *" name="prenom" defaultValue={lead.prenom} required />
            <FormField label="Nom *" name="nom" defaultValue={lead.nom} required />
            <FormField label="Email *" name="email" type="email" defaultValue={lead.email} required />
            <FormField label="Téléphone *" name="telephone" defaultValue={lead.telephone} required />
            <FormField label="Date de naissance *" name="date_naissance" type="date" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-foreground-muted block mb-1">Type de formation *</label>
              <select name="formation_type" required className="w-full h-[30px] px-2 text-[12px] rounded-[5px] border border-border bg-background">
                {Object.entries(FORMATION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-foreground-muted block mb-1">Formule *</label>
              <select name="formule" required className="w-full h-[30px] px-2 text-[12px] rounded-[5px] border border-border bg-background">
                {Object.entries(FORMULE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <FormField label="Commission proposée (€)" name="commission" type="number" step="0.01" min="0" />

          <div>
            <label className="text-[11px] text-foreground-muted block mb-1">Notes initiales</label>
            <textarea name="notes" rows={2} className="w-full text-[12px] px-2 py-1.5 border border-border rounded-[5px] bg-background resize-none" />
          </div>

          <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 text-[11px] px-3 py-2 rounded-[5px]">
            Cette action créera un apprenant et un dossier. Elle est irréversible.
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Création...' : 'Créer le pré-dossier'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>Annuler</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RelanceModal({ leadId, currentUserId, onClose, onSuccess }: { leadId: string; currentUserId: string; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    await actionCreerRelance({
      lead_id: leadId,
      type: fd.get('type') as RelanceType,
      date_prevue: fd.get('date_prevue') as string,
      notes: (fd.get('notes') as string) || undefined,
      commercial_id: currentUserId,
    });
    setLoading(false);
    onSuccess();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-[8px] border border-border shadow-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold">Programmer une relance</h3>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-[11px] text-foreground-muted block mb-1">Type *</label>
            <select name="type" required className="w-full h-[30px] px-2 text-[12px] rounded-[5px] border border-border bg-background">
              {Object.entries(RELANCE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <FormField label="Date prévue *" name="date_prevue" type="date" defaultValue={today} required />
          <div>
            <label className="text-[11px] text-foreground-muted block mb-1">Notes</label>
            <input name="notes" type="text" maxLength={200} className="w-full h-[30px] px-2 text-[12px] rounded-[5px] border border-border bg-background" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={loading}>Programmer</Button>
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>Annuler</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, name, type = 'text', defaultValue = '', required = false, step, min }: {
  label: string; name: string; type?: string; defaultValue?: string; required?: boolean; step?: string; min?: string;
}) {
  return (
    <div>
      <label className="text-[11px] text-foreground-muted block mb-1">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        required={required}
        step={step}
        min={min}
        className="w-full h-[30px] px-2 text-[12px] rounded-[5px] border border-border bg-background"
      />
    </div>
  );
}
