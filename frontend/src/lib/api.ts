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
      apiRequest<{ accessToken: string; refreshToken: string; user: import("@/types").User }>(
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
      apiRequest<import("@/types").User>("/auth/me", { token }),
  },
};
