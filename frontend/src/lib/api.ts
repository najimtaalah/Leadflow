import type {
  User,
  DocumentDossierType,
  DocumentDossierView,
  AlerteDocument,
  ZipManifestEntry,
  QualiopiConformite,
  HistoriqueEntry,
} from "@/types";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface ApiOptions extends RequestInit {
  token?: string;
}

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { token, ...init } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error ?? "Erreur réseau");
  }

  return json.data as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiRequest<{ accessToken: string; refreshToken: string; user: User }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) },
      ),

    refresh: (refreshToken: string) =>
      apiRequest<{ accessToken: string }>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }),

    logout: (token: string, refreshToken: string) =>
      apiRequest("/auth/logout", {
        method: "POST",
        token,
        body: JSON.stringify({ refreshToken }),
      }),

    me: (token: string) =>
      apiRequest<User>("/auth/me", { token }),
  },

  documents: {
    list: (dossierId: string, token: string) =>
      apiRequest<{ documents: DocumentDossierView[]; alertes: AlerteDocument[] }>(
        `/dossiers/${dossierId}/documents`,
        { token },
      ),

    get: (dossierId: string, type: DocumentDossierType, token: string) =>
      apiRequest<{ document: DocumentDossierView | null; prereqsMissing: string[]; canGenerate: boolean }>(
        `/dossiers/${dossierId}/documents/${type}`,
        { token },
      ),

    generate: (dossierId: string, type: DocumentDossierType, token: string) =>
      apiRequest<{ id: string; urlFichier: string }>(
        `/dossiers/${dossierId}/documents/${type}/generate`,
        { method: "POST", token },
      ),

    sign: (dossierId: string, type: DocumentDossierType, token: string) =>
      apiRequest<void>(
        `/dossiers/${dossierId}/documents/${type}/sign`,
        { method: "POST", token },
      ),

    zipManifest: (dossierId: string, token: string) =>
      apiRequest<{ manifest: ZipManifestEntry[]; includedCount: number }>(
        `/dossiers/${dossierId}/documents/export/zip-manifest`,
        { token },
      ),
  },

  qualiopi: {
    conformite: (dossierId: string, token: string) =>
      apiRequest<QualiopiConformite>(
        `/dossiers/${dossierId}/conformite`,
        { token },
      ),

    historique: (dossierId: string, critereNum: number, token: string) =>
      apiRequest<HistoriqueEntry[]>(
        `/dossiers/${dossierId}/conformite/${critereNum}/historique`,
        { token },
      ),

    exportDossierPreuve: (dossierId: string, token: string) =>
      apiRequest<QualiopiConformite>(
        `/dossiers/${dossierId}/conformite/export-dossier-preuve`,
        { method: "POST", token },
      ),
  },
};
