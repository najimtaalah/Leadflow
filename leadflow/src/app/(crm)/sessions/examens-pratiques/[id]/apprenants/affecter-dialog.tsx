"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { UserPlus } from "lucide-react";
import { actionAffecterSession } from "../../../actions";

interface Props {
  sessionType: 'cours' | 'edof' | 'theorique' | 'pratique';
  sessionId: string;
}

export function AffecterDialog({ sessionType, sessionId }: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const dossierId = (fd.get('dossier_id') as string).trim();
    if (!dossierId) { setError('ID dossier requis'); setLoading(false); return; }
    try {
      await actionAffecterSession(dossierId, sessionType, sessionId);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><UserPlus className="h-3.5 w-3.5" />Affecter un apprenant</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Affecter un apprenant à cet examen pratique</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="dossier_id">ID du dossier *</Label>
            <Input id="dossier_id" name="dossier_id" required placeholder="UUID du dossier apprenant" />
            <p className="text-[11px] text-foreground-muted">
              L&apos;apprenant doit avoir réussi l&apos;examen théorique (RM-L4-05).
            </p>
          </div>
          {error && <p className="text-[12px] text-status-red">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? 'Affectation…' : 'Affecter'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
