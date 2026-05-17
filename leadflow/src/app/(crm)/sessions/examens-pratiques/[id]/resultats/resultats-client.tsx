"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FORMATION_TYPE_LABELS,
  SAISIE_RESULTAT_LABELS, SAISIE_RESULTAT_VARIANT,
  STATUT_RESULTAT_LABELS, STATUT_RESULTAT_VARIANT,
} from "@/lib/format";
import type { AffectationWithApprenantAndTentative } from "@/lib/db/types";
import { actionSaisirResultatExamen } from "../../actions";

interface Props {
  sessionId: string;
  affectations: AffectationWithApprenantAndTentative[];
  canSaisir: boolean;
  isSuperAdmin: boolean;
  sessionClosed: boolean;
}

interface RowState {
  resultat: 'admis' | 'refuse' | '';
  score: string;
  mention: string;
  saving: boolean;
  error: string;
  showDetail: boolean;
  observations: string;
}

export function ResultatsPratiqueClient({ sessionId, affectations, canSaisir, isSuperAdmin, sessionClosed }: Props) {
  const [rows, setRows] = React.useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const a of affectations) {
      init[a.dossier_id] = {
        resultat: (a.resultat_detail_resultat ?? '') as 'admis' | 'refuse' | '',
        score: a.resultat_detail_score !== null ? String(a.resultat_detail_score) : '',
        mention: a.resultat_detail_mention ?? '',
        saving: false,
        error: '',
        showDetail: false,
        observations: '',
      };
    }
    return init;
  });

  function update(dossierId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [dossierId]: { ...prev[dossierId], ...patch } }));
  }

  async function saveResultat(a: AffectationWithApprenantAndTentative) {
    const row = rows[a.dossier_id];
    if (!row.resultat || !a.tentative_id) return;
    update(a.dossier_id, { saving: true, error: '' });
    try {
      await actionSaisirResultatExamen({
        dossier_id: a.dossier_id,
        tentative_id: a.tentative_id as string,
        session_type: 'pratique',
        session_id: sessionId,
        resultat: row.resultat as 'admis' | 'refuse',
        score: row.score ? Number(row.score) : undefined,
        mention: row.mention || undefined,
        observations: row.observations || undefined,
      });
      update(a.dossier_id, { saving: false });
    } catch (e) {
      update(a.dossier_id, { saving: false, error: (e as Error).message });
    }
  }

  if (affectations.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-foreground-muted text-[12px]">
        Aucun candidat affecté à cet examen pratique
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Candidat</th>
            <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Formation</th>
            <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Tentative</th>
            <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Condition théorique</th>
            <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Statut</th>
            <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Résultat</th>
            <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Score</th>
            <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted">Mention</th>
            <th className="text-left px-4 py-2 text-[11px] font-medium text-foreground-muted"></th>
          </tr>
        </thead>
        <tbody>
          {affectations.map((a) => {
            const row = rows[a.dossier_id];
            const theoriqueOk = a.resultat_theorique === 'reussi';
            const isEditable = canSaisir && (isSuperAdmin || !sessionClosed) && !!a.tentative_id && (theoriqueOk || isSuperAdmin);
            const statutActuel = a.resultat_detail_statut;

            return (
              <React.Fragment key={a.dossier_id}>
                <tr className="border-b border-border hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/dossiers/${a.dossier_id}`} className="hover:text-accent">
                      {a.apprenant_prenom} {a.apprenant_nom}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-foreground-muted">
                    {FORMATION_TYPE_LABELS[a.dossier_formation_type] ?? a.dossier_formation_type}
                  </td>
                  <td className="px-4 py-2">
                    {a.tentative_numero !== null ? (
                      <Badge variant="secondary">#{a.tentative_numero}</Badge>
                    ) : <span className="text-foreground-subtle">—</span>}
                  </td>
                  <td className="px-4 py-2">
                    {theoriqueOk ? (
                      <span className="text-green-600 dark:text-green-400 text-[11px] font-medium">Théorique : Réussi ✓</span>
                    ) : (
                      <span className="text-orange-600 dark:text-orange-400 text-[11px]">Théorique requis ✗</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {statutActuel ? (
                      <Badge variant={STATUT_RESULTAT_VARIANT[statutActuel] as Parameters<typeof Badge>[0]['variant']}>
                        {STATUT_RESULTAT_LABELS[statutActuel]}
                      </Badge>
                    ) : <span className="text-foreground-subtle">Planifié</span>}
                  </td>
                  <td className="px-4 py-2">
                    {isEditable ? (
                      <select
                        value={row.resultat}
                        onChange={(e) => update(a.dossier_id, { resultat: e.target.value as 'admis' | 'refuse' | '' })}
                        className="text-[12px] px-2 py-1 border border-border rounded-[4px] bg-background text-foreground"
                        disabled={row.saving}
                      >
                        <option value="">— Non saisi</option>
                        <option value="admis">Admis</option>
                        <option value="refuse">Refusé</option>
                      </select>
                    ) : a.resultat_detail_resultat ? (
                      <Badge variant={SAISIE_RESULTAT_VARIANT[a.resultat_detail_resultat] as Parameters<typeof Badge>[0]['variant']}>
                        {SAISIE_RESULTAT_LABELS[a.resultat_detail_resultat]}
                      </Badge>
                    ) : <span className="text-foreground-subtle">—</span>}
                  </td>
                  <td className="px-4 py-2">
                    {isEditable ? (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={row.score}
                        onChange={(e) => update(a.dossier_id, { score: e.target.value })}
                        placeholder="Score"
                        className="w-20 text-[12px] px-2 py-1 border border-border rounded-[4px] bg-background text-foreground"
                        disabled={row.saving}
                      />
                    ) : (
                      <span className="text-foreground-muted">{a.resultat_detail_score ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isEditable ? (
                      <input
                        type="text"
                        maxLength={50}
                        value={row.mention}
                        onChange={(e) => update(a.dossier_id, { mention: e.target.value })}
                        placeholder="Mention"
                        className="w-28 text-[12px] px-2 py-1 border border-border rounded-[4px] bg-background text-foreground"
                        disabled={row.saving}
                      />
                    ) : (
                      <span className="text-foreground-muted">{a.resultat_detail_mention || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      {isEditable && row.resultat && (
                        <Button
                          size="xs"
                          onClick={() => saveResultat(a)}
                          disabled={row.saving}
                        >
                          {row.saving ? '...' : 'Enregistrer'}
                        </Button>
                      )}
                      {isEditable && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => update(a.dossier_id, { showDetail: !row.showDetail })}
                        >
                          Détail
                        </Button>
                      )}
                    </div>
                    {row.error && (
                      <p className="text-[10px] text-red-500 mt-1">{row.error}</p>
                    )}
                  </td>
                </tr>
                {row.showDetail && isEditable && (
                  <tr className="border-b border-border bg-surface-hover">
                    <td colSpan={9} className="px-4 py-3">
                      <div className="max-w-lg">
                        <p className="text-[11px] text-foreground-muted mb-1">Observations (max 2 000 car.)</p>
                        <textarea
                          maxLength={2000}
                          value={row.observations}
                          onChange={(e) => update(a.dossier_id, { observations: e.target.value })}
                          rows={3}
                          className="w-full text-[12px] px-2 py-1.5 border border-border rounded-[5px] bg-background resize-none"
                          placeholder="Observations complémentaires..."
                        />
                        <div className="flex gap-2 mt-2">
                          <Button size="xs" onClick={() => saveResultat(a)} disabled={!row.resultat || row.saving}>
                            {row.saving ? 'Enregistrement...' : 'Enregistrer avec observations'}
                          </Button>
                          <Button size="xs" variant="ghost" onClick={() => update(a.dossier_id, { showDetail: false })}>
                            Fermer
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
