"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { actionCreateSessionEdof } from "../actions";

export function CreateSessionEdofDialog() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await actionCreateSessionEdof({
        reference_edof: (fd.get('reference_edof') as string) || undefined,
        date_debut: fd.get('date_debut') as string,
        date_fin: fd.get('date_fin') as string,
        date_fin_cpf: (fd.get('date_fin_cpf') as string) || undefined,
        capacite_max: fd.get('capacite_max') ? Number(fd.get('capacite_max')) : undefined,
        notes: (fd.get('notes') as string) || undefined,
      });
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
        <Button size="sm"><Plus className="h-3.5 w-3.5" />Nouvelle session EDOF</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer une session EDOF / CPF</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="reference_edof">Référence EDOF</Label>
            <Input id="reference_edof" name="reference_edof" placeholder="ex : EDOF-2026-001" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="date_debut">Date de début *</Label>
              <Input id="date_debut" name="date_debut" type="date" required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="date_fin">Date de fin * (RM-L3-05)</Label>
              <Input id="date_fin" name="date_fin" type="date" required />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="date_fin_cpf">Date de fin dossier CPF</Label>
            <Input id="date_fin_cpf" name="date_fin_cpf" type="date" />
            <p className="text-[11px] text-foreground-muted">La date de fin session doit être ≤ à cette date (RM-L3-05).</p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="capacite_max">Capacité max</Label>
            <Input id="capacite_max" name="capacite_max" type="number" min={1} defaultValue={20} />
          </div>
          {error && <p className="text-[12px] text-status-red">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? 'Création…' : 'Créer la session'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
