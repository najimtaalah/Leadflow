import { Router, type Router as ExpressRouter } from "express";
import authRouter from "./auth";

const router: ExpressRouter = Router();

router.use("/auth", authRouter);

// Healthcheck
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
