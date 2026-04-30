/**
 * server.ts — Local Express development server.
 *
 * Run with: npm run dev
 * Provides all API endpoints locally before deploying to AWS Lambda.
 */

import express from "express";
import cors from "cors";
import { config } from "./config";
import { hmacAuth } from "./middleware/authMiddleware";
import { handleRegister } from "./handlers/registerUser";
import {
  handleUnregister,
  handleSyncStatus,
  handleGoogleWebhook,
  handleMicrosoftWebhook,
  handlePollSync,
  handleRenewWebhooks,
} from "./handlers/handlers";
import { logger } from "./utils/logger";

const app = express();

// ─── Middleware ────────────────────────────────────────────────────

// Capture raw body for HMAC verification, then parse JSON
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString("utf-8");
    },
  })
);
app.use(cors());

// ─── Health Check ─────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Authenticated API Endpoints ──────────────────────────────────

app.post("/api/register", hmacAuth, handleRegister);
app.post("/api/unregister", hmacAuth, handleUnregister);
app.get("/api/status/:userId", hmacAuth, handleSyncStatus);

// ─── Webhook Endpoints (provider-authenticated, not HMAC) ─────────

app.post("/webhooks/google", handleGoogleWebhook);
app.post("/webhooks/microsoft", handleMicrosoftWebhook);

// ─── Manual Triggers (for local dev/testing) ──────────────────────

app.post("/dev/poll", async (_req, res) => {
  try {
    await handlePollSync();
    res.json({ message: "Poll sync completed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/dev/renew-webhooks", async (_req, res) => {
  try {
    await handleRenewWebhooks();
    res.json({ message: "Webhook renewal completed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start Server ─────────────────────────────────────────────────

app.listen(config.port, () => {
  logger.info(`Calendar Sync Backend running on port ${config.port}`, {
    endpoints: {
      health: `http://localhost:${config.port}/health`,
      register: `POST http://localhost:${config.port}/api/register`,
      unregister: `POST http://localhost:${config.port}/api/unregister`,
      status: `GET http://localhost:${config.port}/api/status/:userId`,
      googleWebhook: `POST http://localhost:${config.port}/webhooks/google`,
      microsoftWebhook: `POST http://localhost:${config.port}/webhooks/microsoft`,
      devPoll: `POST http://localhost:${config.port}/dev/poll`,
    },
  });
});

export default app;
