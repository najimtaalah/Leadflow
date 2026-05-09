import { Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { AuthenticatedRequest, ROLE_HIERARCHY } from "../types";

/**
 * Vérifie que l'utilisateur a AU MOINS le niveau de rôle requis.
 * Usage : requireRole(Role.GESTIONNAIRE) — accepte Gestionnaire, Admin, SuperAdmin.
 */
export function requireRole(...roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;

    if (!userRole) {
      res.status(401).json({ success: false, error: "Non authentifié" });
      return;
    }

    const hasAccess = roles.some((requiredRole) => {
      // L'utilisateur peut accéder si son niveau >= niveau requis
      return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
    });

    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: `Accès refusé — rôle requis : ${roles.join(" ou ")}`,
      });
      return;
    }

    next();
  };
}

/**
 * Vérifie que l'utilisateur a EXACTEMENT l'un des rôles spécifiés.
 * Usage : requireExactRole(Role.ADMIN, Role.SUPER_ADMIN)
 */
export function requireExactRole(...roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;

    if (!userRole) {
      res.status(401).json({ success: false, error: "Non authentifié" });
      return;
    }

    if (!roles.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: `Accès refusé — rôle(s) autorisé(s) : ${roles.join(", ")}`,
      });
      return;
    }

    next();
  };
}
