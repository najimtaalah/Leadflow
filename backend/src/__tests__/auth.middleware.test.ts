import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../middleware/auth";
import { Role } from "@prisma/client";

// Mock env
vi.mock("../config/env", () => ({
  getEnv: () => ({
    JWT_SECRET: "test-secret-for-unit-tests-min-32-chars",
    JWT_REFRESH_SECRET: "test-refresh-secret-min-32-chars",
    JWT_ACCESS_EXPIRES_IN: "15m",
    JWT_REFRESH_EXPIRES_IN: "7d",
    PORT: 3001,
    NODE_ENV: "test",
    CORS_ORIGIN: "http://localhost:5173",
    LOG_LEVEL: "silent",
    DATABASE_URL: "postgresql://test",
  }),
}));

function mockReqResNext(overrides: Partial<Request> = {}) {
  const req = {
    headers: {},
    ...overrides,
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

const SECRET = "test-secret-for-unit-tests-min-32-chars";

describe("verifyToken middleware", () => {
  it("retourne 401 si le header Authorization est absent", () => {
    const { req, res, next } = mockReqResNext();
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("retourne 401 si le token ne commence pas par Bearer", () => {
    const { req, res, next } = mockReqResNext({
      headers: { authorization: "Basic abc" },
    });
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("appelle next() avec un token valide et attache user au req", () => {
    const payload = { sub: "user-1", email: "test@test.fr", role: Role.ADMIN };
    const token = jwt.sign(payload, SECRET, { expiresIn: "1h" });

    const { req, res, next } = mockReqResNext({
      headers: { authorization: `Bearer ${token}` },
    });

    verifyToken(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as any).user.email).toBe("test@test.fr");
    expect((req as any).user.role).toBe(Role.ADMIN);
  });

  it("retourne 401 avec un token expiré", () => {
    const payload = { sub: "user-1", email: "test@test.fr", role: Role.COMMERCIAL };
    const token = jwt.sign(payload, SECRET, { expiresIn: "-1s" });

    const { req, res, next } = mockReqResNext({
      headers: { authorization: `Bearer ${token}` },
    });

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Token expiré" }));
  });

  it("retourne 401 avec un token falsifié", () => {
    const { req, res, next } = mockReqResNext({
      headers: { authorization: "Bearer faux.token.ici" },
    });

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Token invalide" }));
  });
});
