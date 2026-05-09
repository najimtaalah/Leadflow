import { Role } from "@prisma/client";
import { Request } from "express";

export { Role };

export interface JwtPayload {
  sub: string;     // userId
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.COMMERCIAL]: 1,
  [Role.CLOSER]: 2,
  [Role.GESTIONNAIRE]: 3,
  [Role.ADMIN]: 4,
  [Role.SUPER_ADMIN]: 5,
};
