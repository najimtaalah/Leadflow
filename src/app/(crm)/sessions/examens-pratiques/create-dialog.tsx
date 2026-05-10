"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { actionCreateSessionExamenPratique } from "../actions";

export function CreateSessionExamenPratiqueDialog() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await actionCreateSessionExamenPratique({
        date_examen: fd.get('date_examen') as string,
        lieu: (fd.get('lieu') as string) || undefined,
        organisme: (fd.get('organisme') as string) || undefined,
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
        <Button size="sm"><Plus className="h-3.5 w-3.5" />Nouvel examen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer une session d&apos;examen pratique</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="date_examen">Date d&apos;examen *</Label>
            <Input id="date_examen" name="date_examen" type="date" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="lieu">Lieu</Label>
              <Input id="lieu" name="lieu" placeholder="ex : Piste d'examen" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="organisme">Organisme</Label>
              <Input id="organisme" name="organisme" placeholder="ex : Préfecture" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="capacite_max">Capacité max</Label>
            <Input id="capacite_max" name="capacite_max" type="number" min={1} defaultValue={10} />
          </div>
          {error && <p className="text-[12px] text-status-red">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? 'Création…' : 'Créer la session'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
