"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { actionCreateSessionCours } from "../actions";
import type { TypePresence } from "@/lib/db/types";

export function CreateSessionCoursDialog() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await actionCreateSessionCours({
        titre: fd.get('titre') as string,
        date_debut: fd.get('date_debut') as string,
        date_fin: fd.get('date_fin') as string,
        type_presence: fd.get('type_presence') as TypePresence,
        lieu: (fd.get('lieu') as string) || undefined,
        formateur: (fd.get('formateur') as string) || undefined,
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
        <Button size="sm"><Plus className="h-3.5 w-3.5" />Nouvelle session</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer une session de formation</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="titre">Titre *</Label>
            <Input id="titre" name="titre" required placeholder="ex : Formation VTC — Juin 2026" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="date_debut">Date de début *</Label>
              <Input id="date_debut" name="date_debut" type="date" required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="date_fin">Date de fin *</Label>
              <Input id="date_fin" name="date_fin" type="date" required />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="type_presence">Modalité *</Label>
            <select id="type_presence" name="type_presence" required
              className="h-[30px] rounded-[5px] border border-border bg-surface px-2 text-[12px] text-foreground">
              <option value="presentiel">Présentiel</option>
              <option value="distanciel">Distanciel</option>
              <option value="hybride">Hybride</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="lieu">Lieu</Label>
              <Input id="lieu" name="lieu" placeholder="ex : Salle A" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="formateur">Formateur</Label>
              <Input id="formateur" name="formateur" placeholder="Nom du formateur" />
            </div>
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
