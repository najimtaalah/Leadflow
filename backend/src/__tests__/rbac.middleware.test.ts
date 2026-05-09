import { describe, it, expect, vi } from "vitest";
import { Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { requireRole, requireExactRole } from "../middleware/rbac";
import { AuthenticatedRequest } from "../types";

function mockAuthedReq(role: Role): AuthenticatedRequest {
  return {
    user: { sub: "user-1", email: "test@test.fr", role },
  } as unknown as AuthenticatedRequest;
}

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("requireRole middleware (hiérarchique)", () => {
  it("laisse passer un SUPER_ADMIN pour n'importe quel rôle requis", () => {
    const next = vi.fn() as NextFunction;
    const res = mockRes();
    requireRole(Role.COMMERCIAL)(mockAuthedReq(Role.SUPER_ADMIN), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("laisse passer un ADMIN pour GESTIONNAIRE requis", () => {
    const next = vi.fn() as NextFunction;
    const res = mockRes();
    requireRole(Role.GESTIONNAIRE)(mockAuthedReq(Role.ADMIN), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("bloque un COMMERCIAL quand GESTIONNAIRE est requis", () => {
    const next = vi.fn() as NextFunction;
    const res = mockRes();
    requireRole(Role.GESTIONNAIRE)(mockAuthedReq(Role.COMMERCIAL), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("retourne 401 si user n'est pas sur le req", () => {
    const next = vi.fn() as NextFunction;
    const res = mockRes();
    const req = {} as AuthenticatedRequest;
    requireRole(Role.COMMERCIAL)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("requireExactRole middleware", () => {
  it("laisse passer si le rôle correspond exactement", () => {
    const next = vi.fn() as NextFunction;
    const res = mockRes();
    requireExactRole(Role.ADMIN, Role.SUPER_ADMIN)(mockAuthedReq(Role.ADMIN), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("bloque si le rôle ne correspond pas", () => {
    const next = vi.fn() as NextFunction;
    const res = mockRes();
    requireExactRole(Role.ADMIN)(mockAuthedReq(Role.GESTIONNAIRE), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
