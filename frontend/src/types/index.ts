export type Role = "COMMERCIAL" | "CLOSER" | "GESTIONNAIRE" | "ADMIN" | "SUPER_ADMIN";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}
