import React, { useState, useCallback, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Minus,
  Download,
  ChevronRight,
  Loader2,
  FileCheck2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DrawerRoot, DrawerContent } from "@/components/ds/Drawer";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type {
  QualiopiConformite,
  QualiopiStatut,
  CritereResult,
  HistoriqueEntry,
  Role,
} from "@/types";

// ─── Statut visuals ───────────────────────────────────────────────────────────

interface StatutVisual {
  icon: React.ReactNode;
  label: string;
  badgeVariant: "green" | "orange" | "red" | "gray";
  rowBg: string;
}

const STATUT_VISUAL: Record<QualiopiStatut, StatutVisual> = {
  VERT: {
    icon: <CheckCircle2 className="h-4 w-4 text-status-green" />,
    label: "Couvert",
    badgeVariant: "green",
    rowBg: "",
  },
  ORANGE: {
    icon: <AlertTriangle className="h-4 w-4 text-status-orange" />,
    label: "Partiel",
    badgeVariant: "orange",
    rowBg: "bg-status-orange-bg/30",
  },
  ROUGE: {
    icon: <XCircle className="h-4 w-4 text-status-red" />,
    label: "Manquant",
    badgeVariant: "red",
    rowBg: "bg-status-red-bg/30",
  },
  GRIS: {
    icon: <Minus className="h-4 w-4 text-foreground-subtle" />,
    label: "N/A",
    badgeVariant: "gray",
    rowBg: "",
  },
};

function gaugeColor(pct: number): string {
  if (pct >= 80) return "bg-status-green";
  if (pct >= 50) return "bg-status-orange";
  return "bg-status-red";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function canExport(role: Role): boolean {
  return ["ADMIN", "SUPER_ADMIN"].includes(role);
}

// ─── Criterion drawer ─────────────────────────────────────────────────────────

interface CritereDrawerProps {
  dossierId: string;
  critere: CritereResult | null;
  onClose: () => void;
}

function CritereDrawer({ dossierId, critere, onClose }: CritereDrawerProps) {
  const token = useAuthStore((s) => s.accessToken) ?? "";
  const [historique, setHistorique] = useState<HistoriqueEntry[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);

  useEffect(() => {
    if (!critere) return;
    setLoadingHist(true);
    api.qualiopi
      .historique(dossierId, critere.num, token)
      .then(setHistorique)
      .catch(() => setHistorique([]))
      .finally(() => setLoadingHist(false));
  }, [critere, dossierId, token]);

  if (!critere) return null;

  const visual = STATUT_VISUAL[critere.statut];

  return (
    <DrawerRoot open={!!critere} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent
        title={`Critère ${critere.num} — ${critere.label}`}
        description={critere.description}
        width="520px"
      >
        <div className="space-y-5">
          {/* Status */}
          <div className="flex items-center gap-2">
            {visual.icon}
            <Badge variant={visual.badgeVariant}>{visual.label}</Badge>
          </div>

          {/* Preuves */}
          <div>
            <p className="text-[11px] font-medium text-foreground-muted uppercase tracking-wide mb-2">
              Preuves attendues
            </p>
            <div className="space-y-1.5">
              {critere.preuves.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-[13px] text-foreground">
                    {p.statut === "presente" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-status-green shrink-0" />
                    ) : p.statut === "partielle" ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-status-orange shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-status-red shrink-0" />
                    )}
                    {p.label}
                  </div>
                  {p.lien && (
                    <a
                      href={p.lien}
                      className="text-[11px] text-primary hover:underline ml-2 shrink-0"
                    >
                      Voir →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions contextuelles */}
          {critere.actions.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-foreground-muted uppercase tracking-wide mb-2">
                Actions suggérées
              </p>
              <div className="space-y-1.5">
                {critere.actions.map((a, i) => (
                  <div key={i}>
                    {a.href ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={a.href}>{a.label}</a>
                      </Button>
                    ) : (
                      <div className="rounded-md border border-border px-3 py-2 text-[13px] text-foreground flex items-center gap-2">
                        <FileCheck2 className="h-3.5 w-3.5 text-foreground-muted shrink-0" />
                        {a.label}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historique */}
          <div>
            <p className="text-[11px] font-medium text-foreground-muted uppercase tracking-wide mb-2">
              Historique
            </p>
            {loadingHist ? (
              <div className="flex items-center gap-2 text-foreground-muted text-[13px] py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Chargement…
              </div>
            ) : historique.length === 0 ? (
              <p className="text-[13px] text-foreground-muted">Aucun historique pour ce critère.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {historique.map((h) => (
                  <div key={h.id} className="text-[12px] text-foreground-muted border-b border-border pb-1.5">
                    <span className="text-foreground">{formatDate(h.createdAt)}</span>
                    {h.statutAvant && (
                      <>
                        {" "}
                        — {STATUT_VISUAL[h.statutAvant].label} →{" "}
                        <span className={h.statutApres === "VERT" ? "text-status-green" : h.statutApres === "ROUGE" ? "text-status-red" : "text-status-orange"}>
                          {STATUT_VISUAL[h.statutApres].label}
                        </span>
                      </>
                    )}
                    {h.note && <div className="italic">{h.note}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </DrawerRoot>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ConformiteTabProps {
  dossierId: string;
}

export function ConformiteTab({ dossierId }: ConformiteTabProps) {
  const token = useAuthStore((s) => s.accessToken) ?? "";
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? "COMMERCIAL";

  const [conformite, setConformite] = useState<QualiopiConformite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCritere, setSelectedCritere] = useState<CritereResult | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.qualiopi.conformite(dossierId, token);
      setConformite(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [dossierId, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleExportPreuve() {
    setExporting(true);
    try {
      await api.qualiopi.exportDossierPreuve(dossierId, token);
      alert("Export dossier de preuve lancé — voir le journal d'audit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'export");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-foreground-muted text-[13px] gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Calcul de la conformité Qualiopi…
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-4 rounded-md bg-status-red-bg border border-status-red/30 px-3 py-2 text-[13px] text-status-red">
        {error}
      </div>
    );
  }

  if (!conformite) return null;

  const { tauxNumerateur, tauxDenominateur, tauxPourcent, criteres, alertesAvantFormation, alertesApresFormation } =
    conformite;

  return (
    <div className="space-y-5 p-4">
      {/* Header — taux + gauge */}
      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-foreground-muted uppercase tracking-wide">
              Taux de conformité Qualiopi
            </p>
            <p className="text-[28px] font-bold text-foreground leading-tight mt-0.5">
              {tauxNumerateur} / {tauxDenominateur}{" "}
              <span className="text-[18px] font-semibold text-foreground-muted">
                critères ({tauxPourcent}%)
              </span>
            </p>
          </div>
          {canExport(role) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPreuve}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Exporter dossier de preuve
            </Button>
          )}
        </div>
        {/* Progress bar */}
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${gaugeColor(tauxPourcent)}`}
            style={{ width: `${tauxPourcent}%` }}
          />
        </div>
      </div>

      {/* Alertes avant formation */}
      {alertesAvantFormation.length > 0 && (
        <div className="rounded-md border border-status-orange/40 bg-status-orange-bg px-4 py-3 space-y-1">
          <p className="text-[11px] font-medium text-status-orange uppercase tracking-wide">
            Critères bloquants avant formation
          </p>
          {alertesAvantFormation.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px] text-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-status-orange shrink-0" />
              {a}
            </div>
          ))}
        </div>
      )}

      {/* Alertes après formation */}
      {alertesApresFormation.length > 0 && (
        <div className="rounded-md border border-status-orange/40 bg-status-orange-bg px-4 py-3 space-y-1">
          <p className="text-[11px] font-medium text-status-orange uppercase tracking-wide">
            Critères à couvrir après formation
          </p>
          {alertesApresFormation.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px] text-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-status-orange shrink-0" />
              {a}
            </div>
          ))}
        </div>
      )}

      {/* Grid — 7 criteria */}
      <div>
        <p className="text-[11px] font-medium text-foreground-muted uppercase tracking-wide mb-2">
          Grille Qualiopi — 7 indicateurs
        </p>
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-foreground-muted text-[11px] uppercase tracking-wide w-8">
                  #
                </th>
                <th className="text-left px-3 py-2 font-medium text-foreground-muted text-[11px] uppercase tracking-wide">
                  Indicateur
                </th>
                <th className="text-left px-3 py-2 font-medium text-foreground-muted text-[11px] uppercase tracking-wide w-28">
                  Statut
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {criteres.map((c) => {
                const visual = STATUT_VISUAL[c.statut];
                return (
                  <tr
                    key={c.num}
                    className={`group border-b border-border last:border-0 hover:bg-accent/40 transition-colors cursor-pointer ${visual.rowBg}`}
                    onClick={() => setSelectedCritere(c)}
                  >
                    <td className="px-3 py-2.5 align-middle text-foreground-muted font-medium">
                      {c.num}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex items-center gap-2">
                        {visual.icon}
                        <div>
                          <p className="font-medium text-foreground">{c.label}</p>
                          <p className="text-[12px] text-foreground-muted line-clamp-1">
                            {c.description}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <Badge variant={visual.badgeVariant}>{visual.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <ChevronRight className="h-3.5 w-3.5 text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Criterion detail drawer */}
      <CritereDrawer
        dossierId={dossierId}
        critere={selectedCritere}
        onClose={() => setSelectedCritere(null)}
      />
    </div>
  );
}
