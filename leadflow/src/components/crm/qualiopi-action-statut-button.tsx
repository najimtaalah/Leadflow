"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionChangeStatut } from "@/app/(crm)/qualiopi/server-actions";
import { ACTION_STATUT_LABELS, ACTION_STATUT_VARIANT } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { isValidTransition } from "@/lib/db/qualiopi-actions.logic";
import type { ActionQualiopi, ActionQualiopiStatut } from "@/lib/db/types";

const ALL_STATUTS: ActionQualiopiStatut[] = ['a_faire', 'en_cours', 'fait', 'en_retard', 'annule'];

interface Props {
  action: ActionQualiopi;
}

export function ActionChangeStatutButton({ action }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedStatut, setSelectedStatut] = useState<ActionQualiopiStatut | null>(null);
  const [note, setNote] = useState('');
  const [showNoteFor, setShowNoteFor] = useState<ActionQualiopiStatut | null>(null);

  const validNext = ALL_STATUTS.filter(
    (s) => s !== action.statut && isValidTransition(action.statut, s),
  );

  function handleClick(statut: ActionQualiopiStatut) {
    if (statut === 'fait') {
      setShowNoteFor(statut);
      setSelectedStatut(statut);
    } else {
      setSelectedStatut(statut);
      setShowNoteFor(null);
      commit(statut, '');
    }
  }

  function commit(statut: ActionQualiopiStatut, noteText: string) {
    setError(null);
    startTransition(async () => {
      try {
        await actionChangeStatut(action.id, statut, noteText || undefined);
        router.refresh();
        setShowNoteFor(null);
        setSelectedStatut(null);
        setNote('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }

  if (validNext.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {validNext.map((s) => (
          <button
            key={s}
            onClick={() => handleClick(s)}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-border rounded-md hover:bg-surface-hover disabled:opacity-60 transition-colors"
          >
            <span>→</span>
            <Badge variant={ACTION_STATUT_VARIANT[s] as Parameters<typeof Badge>[0]['variant']} className="text-[10px]">
              {ACTION_STATUT_LABELS[s]}
            </Badge>
          </button>
        ))}
      </div>

      {showNoteFor === 'fait' && (
        <div className="space-y-2">
          <p className="text-[11px] text-foreground-muted">
            Note de clôture (la preuve doit être renseignée sur la fiche)
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Note optionnelle..."
            className="w-full text-[12px] border border-border rounded px-2 py-1.5 bg-surface resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => commit('fait', note)}
              disabled={isPending}
              className="px-3 py-1.5 text-[12px] bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-60"
            >
              {isPending ? 'En cours...' : 'Confirmer clôture'}
            </button>
            <button
              onClick={() => { setShowNoteFor(null); setSelectedStatut(null); }}
              className="px-3 py-1.5 text-[12px] border border-border rounded hover:bg-surface-hover"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-[11px] text-red-600">{error}</p>
      )}
    </div>
  );
}
