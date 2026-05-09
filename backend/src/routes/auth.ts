import { Router, type Router as ExpressRouter, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as authService from "../services/auth";
import { verifyToken } from "../middleware/auth";

const router: ExpressRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body.email, body.password);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = refreshSchema.parse(req.body);
    const result = await authService.refresh(body.refreshToken);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = refreshSchema.parse(req.body);
    await authService.logout(body.refreshToken);
    res.json({ success: true, message: "Déconnecté" });
  } catch (err) {
    next(err);
  }
});

router.get("/me", verifyToken, (req: Request, res: Response) => {
  res.json({ success: true, data: (req as any).user });
});

export default router;
