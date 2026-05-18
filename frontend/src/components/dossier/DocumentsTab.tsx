import React, { useState, useCallback } from "react";
import {
  FileText,
  Download,
  RefreshCw,
  CheckSquare,
  Archive,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type {
  DocumentDossierView,
  DocumentDossierType,
  DocumentDossierStatut,
  AlerteDocument,
  Role,
} from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOC_LABELS: Record<DocumentDossierType, string> = {
  CONVOCATION_FORMATION: "Convocation formation",
  CONTRAT_FORMATION: "Contrat de formation",
  EMARGEMENT: "Feuille d'émargement",
  ATTESTATION_FORMATION: "Attestation de formation",
  CERTIFICAT: "Certificat",
  FACTURE: "Facture",
  CONVOCATION_EXAMEN_THEO: "Convocation examen théorique",
  CONVOCATION_EXAMEN_PRAT: "Convocation examen pratique",
};

const STATUT_CONFIG: Record<
  DocumentDossierStatut,
  { label: string; variant: "gray" | "blue" | "green" | "orange" | "red"; icon: React.ReactNode }
> = {
  NON_GENERE: {
    label: "Non généré",
    variant: "gray",
    icon: <Clock className="h-3 w-3" />,
  },
  EN_ATTENTE: {
    label: "En attente",
    variant: "orange",
    icon: <Clock className="h-3 w-3" />,
  },
  GENERE: {
    label: "Généré",
    variant: "blue",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  SIGNE: {
    label: "Signé",
    variant: "green",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  BLOQUE: {
    label: "Bloqué",
    variant: "red",
    icon: <XCircle className="h-3 w-3" />,
  },
};

const ALERTE_ICONS: Record<AlerteDocument["type"], React.ReactNode> = {
  avant_formation: <AlertTriangle className="h-3.5 w-3.5 text-status-orange shrink-0" />,
  apres_formation: <AlertTriangle className="h-3.5 w-3.5 text-status-orange shrink-0" />,
  avant_examen: <AlertTriangle className="h-3.5 w-3.5 text-status-orange shrink-0" />,
};

function canGenerate(role: Role) {
  return ["GESTIONNAIRE", "ADMIN", "SUPER_ADMIN"].includes(role);
}
function canRegenerate(role: Role) {
  return ["ADMIN", "SUPER_ADMIN"].includes(role);
}
function canExportZip(role: Role) {
  return ["ADMIN", "SUPER_ADMIN"].includes(role);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DocumentsTabProps {
  dossierId: string;
}

export function DocumentsTab({ dossierId }: DocumentsTabProps) {
  const token = useAuthStore((s) => s.accessToken) ?? "";
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? "COMMERCIAL";

  const [documents, setDocuments] = useState<DocumentDossierView[]>([]);
  const [alertes, setAlertes] = useState<AlerteDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.documents.list(dossierId, token);
      setDocuments(data.documents);
      setAlertes(data.alertes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [dossierId, token]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate(type: DocumentDossierType) {
    setActionLoading(`generate-${type}`);
    try {
      await api.documents.generate(dossierId, type, token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de génération");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSign(type: DocumentDossierType) {
    setActionLoading(`sign-${type}`);
    try {
      await api.documents.sign(dossierId, type, token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de signature");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleExportZip() {
    setActionLoading("zip");
    try {
      const { manifest } = await api.documents.zipManifest(dossierId, token);
      const included = manifest.filter((e) => e.included);
      // In production: trigger actual ZIP download via server endpoint
      console.info("ZIP manifest:", included.map((e) => e.label));
      alert(`Export ZIP : ${included.length} document(s) inclus. (Voir console pour le manifeste)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'export");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-foreground-muted text-[13px] gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement des documents…
      </div>
    );
  }

  const alertesAvant = alertes.filter((a) => a.type === "avant_formation");
  const alertesApres = alertes.filter((a) => a.type === "apres_formation");
  const alertesExamen = alertes.filter((a) => a.type === "avant_examen");

  return (
    <div className="space-y-4 p-4">
      {error && (
        <div className="rounded-md bg-status-red-bg border border-status-red/30 px-3 py-2 text-[13px] text-status-red">
          {error}
        </div>
      )}

      {/* Alertes */}
      {alertes.length > 0 && (
        <div className="rounded-md border border-status-orange/40 bg-status-orange-bg px-4 py-3 space-y-1.5">
          <p className="text-[12px] font-medium text-status-orange uppercase tracking-wide">
            Alertes de non-conformité
          </p>
          {[...alertesAvant, ...alertesApres, ...alertesExamen].map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px] text-foreground">
              {ALERTE_ICONS[a.type]}
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-foreground">Documents du dossier</h2>
        <div className="flex items-center gap-2">
          {canExportZip(role) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportZip}
              disabled={actionLoading === "zip"}
            >
              {actionLoading === "zip" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
              Exporter tout (ZIP)
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-foreground-muted text-[11px] uppercase tracking-wide">
                Type
              </th>
              <th className="text-left px-3 py-2 font-medium text-foreground-muted text-[11px] uppercase tracking-wide">
                Date de génération
              </th>
              <th className="text-left px-3 py-2 font-medium text-foreground-muted text-[11px] uppercase tracking-wide">
                Généré par
              </th>
              <th className="text-left px-3 py-2 font-medium text-foreground-muted text-[11px] uppercase tracking-wide">
                Statut
              </th>
              <th className="text-left px-3 py-2 font-medium text-foreground-muted text-[11px] uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-8 text-foreground-muted text-[13px]"
                >
                  Aucun document pour ce dossier.
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const cfg = STATUT_CONFIG[doc.statut];
                const isGenerating = actionLoading === `generate-${doc.typeDocument}`;
                const isSigning = actionLoading === `sign-${doc.typeDocument}`;

                return (
                  <tr
                    key={doc.typeDocument}
                    className="group border-b border-border last:border-0 hover:bg-accent/30 transition-colors"
                  >
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-foreground-muted shrink-0" />
                        <span className="font-medium text-foreground">
                          {DOC_LABELS[doc.typeDocument]}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-middle text-foreground-muted">
                      {formatDate(doc.genereAt)}
                    </td>
                    <td className="px-3 py-2.5 align-middle text-foreground-muted">
                      {doc.genereParNom ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <Badge variant={cfg.variant}>
                        {cfg.icon}
                        {cfg.label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Download */}
                        {(doc.statut === "GENERE" || doc.statut === "SIGNE") && doc.urlFichier && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a href={doc.urlFichier} download target="_blank" rel="noreferrer">
                              <Download className="h-3.5 w-3.5" />
                              Télécharger
                            </a>
                          </Button>
                        )}
                        {/* Generate / Regenerate */}
                        {canGenerate(role) &&
                          (doc.statut === "NON_GENERE" || doc.statut === "EN_ATTENTE" || doc.statut === "BLOQUE") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGenerate(doc.typeDocument)}
                              disabled={isGenerating}
                            >
                              {isGenerating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FileText className="h-3.5 w-3.5" />
                              )}
                              Générer
                            </Button>
                          )}
                        {canRegenerate(role) && doc.statut === "GENERE" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleGenerate(doc.typeDocument)}
                            disabled={isGenerating}
                          >
                            {isGenerating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            Régénérer
                          </Button>
                        )}
                        {/* Sign */}
                        {canGenerate(role) && doc.statut === "GENERE" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSign(doc.typeDocument)}
                            disabled={isSigning}
                          >
                            {isSigning ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckSquare className="h-3.5 w-3.5" />
                            )}
                            Marquer signé
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
