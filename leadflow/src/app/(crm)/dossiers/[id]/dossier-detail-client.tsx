"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, AlertTriangle, XCircle, Minus, Upload, X, Play, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DossierWithRelations, PieceJustificative, AuditLog, User } from "@/lib/db/types";
import type { QualiopiCritere } from "@/lib/db/dossiers";
import {
  formatDate, formatDateTime, formatEuro,
  DOSSIER_STATUT_LABELS, DOSSIER_STATUT_VARIANT,
  BLOC_STATUT_LABELS, BLOC_STATUT_VARIANT,
  FINANCEMENT_LABELS, FINANCEMENT_VARIANT,
  FORMATION_TYPE_LABELS, FORMULE_LABELS,
  PIECE_STATUT_LABELS, PIECE_STATUT_VARIANT, PIECE_TYPE_LABELS,
  RELANCE_TYPE_LABELS
} from "@/lib/format";
import { actionUpdateBlocStatut, actionActiverApprenant } from "./actions";

type TabId = 'infos' | 'admin' | 'financier' | 'sessions' | 'examens' | 'documents' | 'facturation' | 'historique' | 'qualiopi';

const TABS: { id: TabId; label: string; lot?: number }[] = [
  { id: 'infos', label: 'Informations' },
  { id: 'admin', label: 'Bloc Admin' },
  { id: 'financier', label: 'Bloc Financier' },
  { id: 'sessions', label: 'Sessions', lot: 3 },
  { id: 'examens', label: 'Examens', lot: 5 },
  { id: 'documents', label: 'Documents', lot: 4 },
  { id: 'facturation', label: 'Facturation', lot: 6 },
  { id: 'historique', label: 'Historique' },
  { id: 'qualiopi', label: 'Conformité Qualiopi' },
];

interface Permissions {
  canValidateBlocAdmin: boolean;
  canValidateBlocFinancier: boolean;
  canSaisieBlocFinancier: boolean;
  canActivateApprenant: boolean;
  canViewAll: boolean;
}

interface Props {
  dossier: DossierWithRelations;
  pieces: PieceJustificative[];
  auditLog: AuditLog[];
  qualiopi: QualiopiCritere[];
  currentUser: User;
  allUsers: User[];
  permissions: Permissions;
}

export function DossierDetailClient({ dossier, pieces, auditLog, qualiopi, currentUser, allUsers, permissions }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<TabId>('infos');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [showActivationModal, setShowActivationModal] = React.useState(false);

  async function handleBlocAction(bloc: 'admin' | 'financier', action: 'soumettre' | 'valider' | 'rejeter', motif?: string) {
    setLoading(true);
    setError('');
    try {
      await actionUpdateBlocStatut(dossier.id, bloc, action, motif);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleActivation() {
    setLoading(true);
    setError('');
    try {
      await actionActiverApprenant(dossier.id);
      setShowActivationModal(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setShowActivationModal(false);
    } finally {
      setLoading(false);
    }
  }

  const qualiopiAlerts = qualiopi.filter(q => q.statut === 'error');
  const qualiopiWarnings = qualiopi.filter(q => q.statut === 'warning');
  const applicableCount = qualiopi.filter(q => q.statut !== 'na').length;
  const coveredCount = qualiopi.filter(q => q.statut === 'ok').length;
  const qualiopiPct = applicableCount > 0 ? Math.round((coveredCount / applicableCount) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-border shrink-0 px-4 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1 px-3 h-[38px] text-[12px] border-b-2 transition-colors shrink-0 ${
              activeTab === tab.id
                ? 'border-accent text-foreground font-medium'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.lot && (
              <span className="text-[10px] text-foreground-subtle bg-surface-hover px-1 rounded">L{tab.lot}</span>
            )}
            {tab.id === 'qualiopi' && qualiopiAlerts.length > 0 && (
              <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 px-1 rounded">{qualiopiAlerts.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Actions bar */}
      {(permissions.canActivateApprenant || error) && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface-hover shrink-0">
          {error && (
            <div className="flex items-center gap-1 text-red-700 dark:text-red-300 text-[12px]">
              <XCircle className="h-3 w-3" />
              {error}
              <button onClick={() => setError('')}><X className="h-3 w-3 ml-1" /></button>
            </div>
          )}
          {permissions.canActivateApprenant && (
            <Button size="sm" onClick={() => setShowActivationModal(true)} className="ml-auto">
              <Play className="h-3 w-3 mr-1.5" />
              Activer l'apprenant
            </Button>
          )}
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'infos' && <TabInfos dossier={dossier} permissions={permissions} />}
        {activeTab === 'admin' && (
          <TabBlocAdmin
            dossier={dossier}
            pieces={pieces.filter(p => !['evaluation_positionnement', 'programme_formation'].includes(p.type_piece))}
            permissions={permissions}
            onAction={handleBlocAction}
            loading={loading}
          />
        )}
        {activeTab === 'financier' && (
          <TabBlocFinancier
            dossier={dossier}
            permissions={permissions}
            onAction={handleBlocAction}
            loading={loading}
          />
        )}
        {activeTab === 'sessions' && <TabLotFutur label="Sessions" lot={3} />}
        {activeTab === 'examens' && <TabLotFutur label="Examens" lot={5} />}
        {activeTab === 'documents' && <TabLotFutur label="Documents" lot={4} />}
        {activeTab === 'facturation' && <TabLotFutur label="Facturation" lot={6} />}
        {activeTab === 'historique' && <TabHistorique auditLog={auditLog} />}
        {activeTab === 'qualiopi' && (
          <TabQualiopi
            criteres={qualiopi}
            pct={qualiopiPct}
            covered={coveredCount}
            applicable={applicableCount}
            dossierId={dossier.id}
            canExport={['non_planifie', 'planifie'].includes(dossier.statut) && permissions.canViewAll}
          />
        )}
      </div>

      {/* Activation modal */}
      {showActivationModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-[8px] border border-border shadow-2xl w-full max-w-md p-6">
            <h3 className="text-[15px] font-semibold mb-4">Activer l'apprenant ?</h3>
            <div className="bg-surface-hover rounded-[5px] p-3 text-[12px] flex flex-col gap-1.5 mb-4">
              <p><span className="text-foreground-muted">Apprenant :</span> {dossier.apprenant_prenom} {dossier.apprenant_nom}</p>
              <p><span className="text-foreground-muted">Formation :</span> {FORMATION_TYPE_LABELS[dossier.formation_type]} · {FORMULE_LABELS[dossier.formule]}</p>
              {dossier.montant_vendu && <p><span className="text-foreground-muted">Montant :</span> {formatEuro(dossier.montant_vendu)} · {dossier.type_financement ? FINANCEMENT_LABELS[dossier.type_financement] : '—'}</p>}
              {dossier.commercial_prenom && <p><span className="text-foreground-muted">Commercial :</span> {dossier.commercial_prenom} {dossier.commercial_nom}</p>}
            </div>
            <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 text-[11px] px-3 py-2 rounded-[5px] mb-4">
              ⚠ Cette action est irréversible. L'apprenant sera activé, le lead marqué Gagné et la commission figée.
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleActivation} disabled={loading}>
                {loading ? 'Activation...' : 'Confirmer l\'activation'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowActivationModal(false)}>Annuler</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabInfos({ dossier, permissions }: { dossier: DossierWithRelations; permissions: Permissions }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <div className="rounded-[6px] border border-border bg-surface p-4">
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <Field label="ID Dossier" value={dossier.id} className="col-span-2 font-mono text-[11px]" />
          {dossier.id_lead_origine && (
            <div>
              <p className="text-[11px] text-foreground-muted mb-0.5">Lead d'origine</p>
              <Link href={`/leads/${dossier.id_lead_origine}`} className="text-accent text-[13px] hover:underline">
                Voir le lead →
              </Link>
            </div>
          )}
          <div>
            <p className="text-[11px] text-foreground-muted mb-0.5">Apprenant</p>
            <Link href={`/apprenants/${dossier.id_apprenant}`} className="text-accent text-[13px] hover:underline">
              {dossier.apprenant_prenom} {dossier.apprenant_nom} →
            </Link>
          </div>
          <Field label="Formation" value={FORMATION_TYPE_LABELS[dossier.formation_type]} />
          <Field label="Formule" value={FORMULE_LABELS[dossier.formule]} />
          {dossier.numero_cma && <Field label="Numéro CMA" value={dossier.numero_cma} />}
          <div>
            <p className="text-[11px] text-foreground-muted mb-0.5">Statut</p>
            <Badge variant={DOSSIER_STATUT_VARIANT[dossier.statut] as Parameters<typeof Badge>[0]['variant']}>
              {DOSSIER_STATUT_LABELS[dossier.statut]}
            </Badge>
          </div>
          <Field label="Créé le" value={formatDate(dossier.date_creation)} />
          {dossier.date_activation && <Field label="Activé le" value={formatDate(dossier.date_activation)} />}
          {dossier.commercial_prenom && <Field label="Commercial" value={`${dossier.commercial_prenom} ${dossier.commercial_nom}`} />}
          {permissions.canViewAll && dossier.gestionnaire_prenom && <Field label="Gestionnaire" value={`${dossier.gestionnaire_prenom} ${dossier.gestionnaire_nom}`} />}
          {dossier.notes && <Field label="Notes" value={dossier.notes} className="col-span-2" />}
        </div>
      </div>
    </div>
  );
}

function TabBlocAdmin({ dossier, pieces, permissions, onAction, loading }: {
  dossier: DossierWithRelations;
  pieces: PieceJustificative[];
  permissions: Permissions;
  onAction: (bloc: 'admin' | 'financier', action: 'soumettre' | 'valider' | 'rejeter', motif?: string) => Promise<void>;
  loading: boolean;
}) {
  const [rejectMotif, setRejectMotif] = React.useState('');
  const [showReject, setShowReject] = React.useState(false);

  const piecesMissing = pieces.filter(p => p.statut === 'a_fournir');
  const canSubmit = piecesMissing.length === 0 && dossier.statut_bloc_admin !== 'soumis' && dossier.statut_bloc_admin !== 'valide';

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
      {/* Status */}
      <div className="rounded-[6px] border border-border bg-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[12px] font-semibold text-foreground-muted uppercase tracking-wide">Bloc Administratif</h2>
            <Badge variant={BLOC_STATUT_VARIANT[dossier.statut_bloc_admin] as Parameters<typeof Badge>[0]['variant']}>
              {BLOC_STATUT_LABELS[dossier.statut_bloc_admin]}
            </Badge>
          </div>
          <div className="flex gap-2">
            {dossier.statut_bloc_admin !== 'valide' && canSubmit && (
              <Button size="xs" onClick={() => onAction('admin', 'soumettre')} disabled={loading}>
                Soumettre pour validation
              </Button>
            )}
            {permissions.canValidateBlocAdmin && dossier.statut_bloc_admin === 'soumis' && (
              <>
                <Button size="xs" onClick={() => onAction('admin', 'valider')} disabled={loading}>✓ Valider</Button>
                <Button size="xs" variant="destructive" onClick={() => setShowReject(true)} disabled={loading}>✗ Rejeter</Button>
              </>
            )}
          </div>
        </div>

        {piecesMissing.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[11px] px-3 py-2 rounded-[5px] mb-3">
            Pièces manquantes : {piecesMissing.map(p => PIECE_TYPE_LABELS[p.type_piece] || p.type_piece).join(', ')}
          </div>
        )}

        {showReject && (
          <div className="bg-surface-hover rounded-[5px] p-3 mb-3">
            <textarea
              value={rejectMotif}
              onChange={e => setRejectMotif(e.target.value)}
              placeholder="Motif du rejet (min. 20 caractères)"
              className="w-full h-[60px] text-[12px] px-2 py-1.5 border border-border rounded-[5px] bg-background resize-none mb-2"
            />
            <div className="flex gap-2">
              <Button size="xs" variant="destructive" onClick={() => { onAction('admin', 'rejeter', rejectMotif); setShowReject(false); }} disabled={rejectMotif.length < 20}>
                Confirmer le rejet
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setShowReject(false)}>Annuler</Button>
            </div>
          </div>
        )}
      </div>

      {/* Pièces justificatives */}
      <div className="rounded-[6px] border border-border bg-surface p-4">
        <h2 className="text-[12px] font-semibold text-foreground-muted uppercase tracking-wide mb-3">Pièces justificatives</h2>
        <div className="flex flex-col gap-2">
          {pieces.map(p => (
            <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                <Badge variant={PIECE_STATUT_VARIANT[p.statut] as Parameters<typeof Badge>[0]['variant']}>
                  {PIECE_STATUT_LABELS[p.statut]}
                </Badge>
                <span className="text-[12px]">{PIECE_TYPE_LABELS[p.type_piece] || p.type_piece}</span>
              </div>
              <div className="flex items-center gap-2">
                {p.fichier_nom && <span className="text-[11px] text-foreground-muted">{p.fichier_nom}</span>}
                {p.statut === 'a_fournir' && (
                  <Button size="xs" variant="outline">
                    <Upload className="h-3 w-3 mr-1" />
                    Téléverser
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabBlocFinancier({ dossier, permissions, onAction, loading }: {
  dossier: DossierWithRelations;
  permissions: Permissions;
  onAction: (bloc: 'admin' | 'financier', action: 'soumettre' | 'valider' | 'rejeter', motif?: string) => Promise<void>;
  loading: boolean;
}) {
  const [showReject, setShowReject] = React.useState(false);
  const [rejectMotif, setRejectMotif] = React.useState('');

  const resteAPayer = dossier.montant_vendu != null
    ? (dossier.montant_vendu || 0) - (dossier.apport_personnel || 0) - (dossier.montant_prise_en_charge || 0)
    : null;
  const resteNeg = resteAPayer != null && resteAPayer < 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
      <div className="rounded-[6px] border border-border bg-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[12px] font-semibold text-foreground-muted uppercase tracking-wide">Bloc Financier</h2>
            <Badge variant={BLOC_STATUT_VARIANT[dossier.statut_bloc_financier] as Parameters<typeof Badge>[0]['variant']}>
              {BLOC_STATUT_LABELS[dossier.statut_bloc_financier]}
            </Badge>
          </div>
          <div className="flex gap-2">
            {!['soumis', 'valide'].includes(dossier.statut_bloc_financier) && (
              <Button size="xs" onClick={() => onAction('financier', 'soumettre')} disabled={loading || resteNeg}>
                Soumettre
              </Button>
            )}
            {permissions.canValidateBlocFinancier && dossier.statut_bloc_financier === 'soumis' && (
              <>
                <Button size="xs" onClick={() => onAction('financier', 'valider')} disabled={loading}>✓ Valider</Button>
                <Button size="xs" variant="destructive" onClick={() => setShowReject(true)} disabled={loading}>✗ Rejeter</Button>
              </>
            )}
          </div>
        </div>

        {resteNeg && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[11px] px-3 py-2 rounded-[5px] mb-3">
            Les montants sont incohérents — reste à payer négatif
          </div>
        )}

        {showReject && (
          <div className="bg-surface-hover rounded-[5px] p-3 mb-3">
            <textarea
              value={rejectMotif}
              onChange={e => setRejectMotif(e.target.value)}
              placeholder="Motif du rejet (min. 20 caractères)"
              className="w-full h-[60px] text-[12px] px-2 py-1.5 border border-border rounded-[5px] bg-background resize-none mb-2"
            />
            <div className="flex gap-2">
              <Button size="xs" variant="destructive" onClick={() => { onAction('financier', 'rejeter', rejectMotif); setShowReject(false); }} disabled={rejectMotif.length < 20}>
                Confirmer le rejet
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setShowReject(false)}>Annuler</Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <p className="text-[11px] text-foreground-muted mb-0.5">Type de financement</p>
            {dossier.type_financement ? (
              <Badge variant={FINANCEMENT_VARIANT[dossier.type_financement] as Parameters<typeof Badge>[0]['variant']}>
                {FINANCEMENT_LABELS[dossier.type_financement]}
              </Badge>
            ) : <span className="text-foreground-subtle">—</span>}
          </div>
          {dossier.reference_financeur && (
            <Field label="Référence financeur" value={dossier.reference_financeur} />
          )}
          <Field label="Montant vendu" value={formatEuro(dossier.montant_vendu)} />
          <Field label="Apport personnel" value={formatEuro(dossier.apport_personnel)} />
          <Field label="Prise en charge financeur" value={formatEuro(dossier.montant_prise_en_charge)} />
          <div>
            <p className="text-[11px] text-foreground-muted mb-0.5">Reste à payer</p>
            <p className={`text-[13px] font-medium ${resteNeg ? 'text-red-600' : 'text-foreground'}`}>
              {resteAPayer != null ? formatEuro(resteAPayer) : '—'}
            </p>
          </div>
          {dossier.notes_financier && <Field label="Notes" value={dossier.notes_financier} className="col-span-2" />}
        </div>
      </div>
    </div>
  );
}

function TabHistorique({ auditLog }: { auditLog: AuditLog[] }) {
  const ACTION_LABELS: Record<string, string> = {
    creation_dossier: 'Création dossier',
    modification_champ: 'Modification champ',
    piece_deposee: 'Pièce déposée',
    piece_rejetee: 'Pièce rejetée',
    bloc_soumis: 'Bloc soumis',
    bloc_valide: 'Bloc validé',
    bloc_rejete: 'Bloc rejeté',
    apprenant_active: 'Apprenant activé',
    session_affectee: 'Session affectée',
    document_genere: 'Document généré',
    commission_deverrouillee: 'Commission déverrouillée',
    reclamation: 'Réclamation',
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <div className="rounded-[6px] border border-border bg-surface">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Date / Heure</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Auteur</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Action</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Détail</th>
            </tr>
          </thead>
          <tbody>
            {auditLog.map(entry => (
              <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                <td className="px-4 py-2 tabular-nums text-foreground-muted">{formatDateTime(entry.created_at)}</td>
                <td className="px-4 py-2">{entry.auteur_prenom ? `${entry.auteur_prenom} ${entry.auteur_nom}` : 'Système'}</td>
                <td className="px-4 py-2">{ACTION_LABELS[entry.type_action] || entry.type_action}</td>
                <td className="px-4 py-2 text-foreground-muted">{entry.detail ?? '—'}</td>
              </tr>
            ))}
            {auditLog.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-foreground-muted">Aucune entrée</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabQualiopi({ criteres, pct, covered, applicable, dossierId, canExport }: {
  criteres: QualiopiCritere[];
  pct: number;
  covered: number;
  applicable: number;
  dossierId: string;
  canExport: boolean;
}) {
  const ICONS = {
    ok: <CheckCircle className="h-4 w-4 text-green-600" />,
    warning: <AlertTriangle className="h-4 w-4 text-orange-500" />,
    error: <XCircle className="h-4 w-4 text-red-600" />,
    na: <Minus className="h-4 w-4 text-foreground-subtle" />,
  };

  const barColor = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-orange-400' : 'bg-red-500';
  const alerts = criteres.filter(c => c.statut === 'error');
  const warnings = criteres.filter(c => c.statut === 'warning');

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
      {/* Header */}
      <div className="rounded-[6px] border border-border bg-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[13px] font-semibold">{covered} / {applicable} critères couverts ({pct} %)</p>
            <p className="text-[11px] text-foreground-muted">Taux de conformité Qualiopi</p>
          </div>
          {canExport && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { window.location.href = `/api/dossiers/${dossierId}/export-zip`; }}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exporter dossier de preuve (ZIP)
            </Button>
          )}
        </div>
        <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Alertes */}
      {alerts.length > 0 && (
        <div className="rounded-[6px] border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4">
          <p className="text-[11px] font-semibold text-red-700 dark:text-red-300 uppercase mb-2">Bloquants</p>
          {alerts.map(a => (
            <div key={a.id} className="flex items-center gap-2 text-[12px] text-red-700 dark:text-red-300 py-1">
              <XCircle className="h-3 w-3 shrink-0" />
              <span>[{a.id}] {a.label}</span>
            </div>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-[6px] border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950 p-4">
          <p className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 uppercase mb-2">À couvrir</p>
          {warnings.map(w => (
            <div key={w.id} className="flex items-center gap-2 text-[12px] text-orange-700 dark:text-orange-300 py-1">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>[{w.id}] {w.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tableau */}
      <div className="rounded-[6px] border border-border bg-surface">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted w-12">ID</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Indicateur RNQ</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Source</th>
              <th className="text-center px-4 py-2 text-[11px] font-medium text-foreground-muted w-16">Statut</th>
            </tr>
          </thead>
          <tbody>
            {criteres.map(c => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                <td className="px-4 py-2 font-mono text-foreground-muted">{c.id}</td>
                <td className="px-4 py-2">{c.label}</td>
                <td className="px-4 py-2 text-foreground-muted text-[11px]">{c.source}</td>
                <td className="px-4 py-2 flex justify-center">{ICONS[c.statut]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabLotFutur({ label, lot }: { label: string; lot: number }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <p className="text-[13px] font-medium text-foreground-muted">{label}</p>
        <p className="text-[12px] text-foreground-subtle mt-1">Disponible dans le Lot {lot}</p>
      </div>
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
