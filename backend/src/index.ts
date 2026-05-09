import express, { type Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { getEnv } from "./config/env";
import router from "./routes";
import { errorHandler } from "./middleware/errorHandler";

const env = getEnv();
const app: Application = express();

// Sécurité
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

// Rate limiting — protège les endpoints d'auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { success: false, error: "Trop de tentatives, réessayez dans 15 minutes" },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/refresh", authLimiter);

// Parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Logs
if (env.NODE_ENV !== "test") {
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
}

// Routes
app.use("/api", router);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route introuvable" });
});

// Gestion d'erreurs centralisée
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`✓ API LeadFlow+ démarrée sur le port ${env.PORT} [${env.NODE_ENV}]`);
});

export default app;
