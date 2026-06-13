"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionCreateAction, actionUpdateAction } from "@/app/(crm)/qualiopi/server-actions";
import {
  ACTION_PRIORITE_LABELS,
  ACTION_STATUT_LABELS,
  ACTION_FORMATION_LABELS,
} from "@/lib/format";
import { isValidTransition } from "@/lib/db/qualiopi-actions.logic";
import type {
  ActionQualiopiIndicateur,
  ActionQualiopiFormation,
  ActionQualiopiStatut,
  ActionQualiopiPriorite,
} from "@/lib/db/types";

interface FormValues {
  indicateur?: ActionQualiopiIndicateur;
  formation?: ActionQualiopiFormation;
  titre?: string;
  description?: string;
  responsable?: string;
  date_echeance?: string;
  statut?: ActionQualiopiStatut;
  priorite?: ActionQualiopiPriorite;
  preuve?: string;
  source_veille_semaine?: string;
}

interface Props {
  actionId?: string;
  defaultIndicateur?: string;
  defaultVeille?: string;
  defaultValues?: FormValues;
  currentStatut?: ActionQualiopiStatut;
  currentUserName: string;
  isEdit?: boolean;
}

const INDICATEURS: ActionQualiopiIndicateur[] = ['IND-23', 'IND-24', 'IND-25', 'CRIT-5', 'CRIT-6'];
const FORMATIONS = Object.entries(ACTION_FORMATION_LABELS) as [ActionQualiopiFormation, string][];
const PRIORITES = Object.entries(ACTION_PRIORITE_LABELS) as [ActionQualiopiPriorite, string][];
const ALL_STATUTS = Object.entries(ACTION_STATUT_LABELS) as [ActionQualiopiStatut, string][];

export function ActionQualiopiForm({
  actionId,
  defaultIndicateur,
  defaultVeille,
  defaultValues,
  currentStatut,
  currentUserName,
  isEdit = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const availableStatuts = isEdit && currentStatut
    ? ALL_STATUTS.filter(([k]) => k === currentStatut || isValidTransition(currentStatut, k as ActionQualiopiStatut))
    : [['a_faire', ACTION_STATUT_LABELS.a_faire] as [ActionQualiopiStatut, string]];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const v = Object.fromEntries(fd.entries()) as Record<string, string>;

    startTransition(async () => {
      try {
        if (isEdit && actionId) {
          await actionUpdateAction(actionId, {
            indicateur: v.indicateur as ActionQualiopiIndicateur,
            formation: (v.formation as ActionQualiopiFormation) || null,
            titre: v.titre,
            description: v.description || null,
            responsable: v.responsable || null,
            date_echeance: v.date_echeance || null,
            statut: v.statut as ActionQualiopiStatut,
            priorite: v.priorite as ActionQualiopiPriorite,
            preuve: v.preuve || null,
            source_veille_semaine: v.source_veille_semaine || null,
          });
          router.push(`/qualiopi/actions/${actionId}`);
        } else {
          const action = await actionCreateAction({
            indicateur: v.indicateur as ActionQualiopiIndicateur,
            formation: (v.formation as ActionQualiopiFormation) || null,
            titre: v.titre,
            description: v.description || null,
            responsable: v.responsable || null,
            date_echeance: v.date_echeance || null,
            priorite: v.priorite as ActionQualiopiPriorite,
            preuve: v.preuve || null,
            source_veille_semaine: v.source_veille_semaine || null,
          });
          router.push(`/qualiopi/actions/${action.id}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inattendue');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-[12px]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-medium text-foreground-muted mb-1">
            Indicateur <span className="text-red-500">*</span>
          </label>
          <select
            name="indicateur"
            required
            defaultValue={defaultValues?.indicateur ?? defaultIndicateur ?? ''}
            className="w-full text-[13px] border border-border rounded px-3 py-2 bg-surface text-foreground"
          >
            <option value="">Sélectionner...</option>
            {INDICATEURS.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-foreground-muted mb-1">Formation</label>
          <select
            name="formation"
            defaultValue={defaultValues?.formation ?? ''}
            className="w-full text-[13px] border border-border rounded px-3 py-2 bg-surface text-foreground"
          >
            <option value="">Aucune</option>
            {FORMATIONS.map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-foreground-muted mb-1">
          Titre <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="titre"
          required
          maxLength={255}
          defaultValue={defaultValues?.titre ?? ''}
          className="w-full text-[13px] border border-border rounded px-3 py-2 bg-surface text-foreground"
          placeholder="Titre court de l'action"
        />
      </div>

      <div>
        <label className="block text-[11px] font-medium text-foreground-muted mb-1">Description</label>
        <textarea
          name="description"
          rows={4}
          defaultValue={defaultValues?.description ?? ''}
          className="w-full text-[13px] border border-border rounded px-3 py-2 bg-surface text-foreground resize-none"
          placeholder="Description détaillée..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-medium text-foreground-muted mb-1">Responsable</label>
          <input
            type="text"
            name="responsable"
            defaultValue={defaultValues?.responsable ?? ''}
            className="w-full text-[13px] border border-border rounded px-3 py-2 bg-surface text-foreground"
            placeholder="Nom ou email"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-foreground-muted mb-1">
            Échéance{!isEdit && ' (min : aujourd\'hui)'}
          </label>
          <input
            type="date"
            name="date_echeance"
            min={!isEdit ? today : undefined}
            defaultValue={defaultValues?.date_echeance ?? ''}
            className="w-full text-[13px] border border-border rounded px-3 py-2 bg-surface text-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-medium text-foreground-muted mb-1">
            Priorité <span className="text-red-500">*</span>
          </label>
          <select
            name="priorite"
            required
            defaultValue={defaultValues?.priorite ?? 'medium'}
            className="w-full text-[13px] border border-border rounded px-3 py-2 bg-surface text-foreground"
          >
            {PRIORITES.map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {isEdit && (
          <div>
            <label className="block text-[11px] font-medium text-foreground-muted mb-1">
              Statut <span className="text-red-500">*</span>
            </label>
            <select
              name="statut"
              required
              defaultValue={defaultValues?.statut ?? 'a_faire'}
              className="w-full text-[13px] border border-border rounded px-3 py-2 bg-surface text-foreground"
            >
              {availableStatuts.map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        )}

        {!isEdit && (
          <input type="hidden" name="statut" value="a_faire" />
        )}
      </div>

      <div>
        <label className="block text-[11px] font-medium text-foreground-muted mb-1">
          Preuve {isEdit && <span className="text-foreground-subtle">(obligatoire pour passer à &quot;Fait&quot;)</span>}
        </label>
        <textarea
          name="preuve"
          rows={2}
          defaultValue={defaultValues?.preuve ?? ''}
          className="w-full text-[13px] border border-border rounded px-3 py-2 bg-surface text-foreground resize-none"
          placeholder="URL ou description de la preuve..."
        />
      </div>

      <div>
        <label className="block text-[11px] font-medium text-foreground-muted mb-1">
          Semaine de veille
        </label>
        <input
          type="text"
          name="source_veille_semaine"
          pattern="S\d{2}-\d{4}"
          defaultValue={defaultValues?.source_veille_semaine ?? defaultVeille ?? ''}
          className="w-full text-[13px] border border-border rounded px-3 py-2 bg-surface text-foreground"
          placeholder="Ex : S20-2026"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-accent text-white text-[13px] font-medium rounded-md hover:bg-accent/90 disabled:opacity-60 transition-colors"
        >
          {isPending ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer l\'action'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-border text-[13px] rounded-md hover:bg-surface-hover transition-colors"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
