/**
 * handlers/unregisterUser.ts — POST /api/unregister
 * handlers/syncStatus.ts  — GET /api/status/:userId
 * handlers/webhookHandler.ts — POST /webhooks/google, /webhooks/microsoft
 * handlers/pollSync.ts    — Triggered by EventBridge cron
 */

import { Request, Response } from "express";
import { getUser, updateUser, getUsersNeedingPoll } from "../db/usersTable";
import { countUserMappings } from "../db/eventMappingsTable";
import { refreshGoogleAccessToken } from "../auth/googleTokens";
import { refreshMicrosoftAccessToken } from "../auth/microsoftTokens";
import { stopGoogleWebhook } from "../webhooks/googleWebhook";
import { deleteMicrosoftWebhook } from "../webhooks/microsoftWebhook";
import { syncGoogleToOutlook, syncOutlookToGoogle } from "../sync/syncEngine";
import { cleanOrphans } from "../sync/orphanCleaner";
import { renewAllWebhooks } from "../webhooks/renewWebhooks";
import { logger } from "../utils/logger";

// ─── Unregister ───────────────────────────────────────────────────

export async function handleUnregister(req: Request, res: Response): Promise<void> {
  const { userId } = req.body;
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }

  const user = await getUser(userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  try {
    // Stop webhooks
    if (user.googleRefreshToken && user.googleChannelId) {
      const g = await refreshGoogleAccessToken(user.googleRefreshToken).catch(() => null);
      if (g) await stopGoogleWebhook(g.accessToken, user.googleChannelId);
    }
    if (user.microsoftRefreshToken && user.msSubscriptionId) {
      const m = await refreshMicrosoftAccessToken(user.microsoftRefreshToken).catch(() => null);
      if (m) await deleteMicrosoftWebhook(m.accessToken, user.msSubscriptionId);
    }

    await updateUser(userId, {
      syncEnabled: false,
      syncStatus: "healthy",
      googleChannelId: null,
      googleChannelExpiry: null,
      msSubscriptionId: null,
      msSubscriptionExpiry: null,
    });

    res.json({ message: "Sync stopped" });
    logger.info("User unregistered", { userId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Status ───────────────────────────────────────────────────────

export async function handleSyncStatus(req: Request, res: Response): Promise<void> {
  const userId = req.params.userId as string;
  const user = await getUser(userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const now = Date.now();
  const mappedCount = await countUserMappings(userId);

  res.json({
    syncEnabled: user.syncEnabled,
    syncStatus: user.syncStatus,
    lastSyncAt: user.lastSyncAt ? new Date(user.lastSyncAt).toISOString() : null,
    googleWebhookActive: !!(user.googleChannelExpiry && user.googleChannelExpiry > now),
    microsoftWebhookActive: !!(user.msSubscriptionExpiry && user.msSubscriptionExpiry > now),
    webhookStatus: user.syncStatus === "degraded" ? "degraded" : "active",
    mappedEventsCount: mappedCount,
    lastError: user.lastError,
    syncRetryCount: user.syncRetryCount,
  });
}

// ─── Google Webhook ───────────────────────────────────────────────

export async function handleGoogleWebhook(req: Request, res: Response): Promise<void> {
  // Google sends userId in the X-Goog-Channel-Token header
  const userId = req.headers["x-goog-channel-token"] as string | undefined;
  if (!userId) { res.status(200).send("OK"); return; } // Acknowledge but ignore

  res.status(200).send("OK"); // Respond immediately (Google requires fast response)

  // Process async
  setImmediate(async () => {
    try {
      await syncGoogleToOutlook(userId);
    } catch (err: any) {
      logger.error("Google webhook sync failed", { userId, error: err.message });
    }
  });
}

// ─── Microsoft Webhook ────────────────────────────────────────────

export async function handleMicrosoftWebhook(req: Request, res: Response): Promise<void> {
  // Microsoft validation handshake
  const validationToken = req.query.validationToken as string | undefined;
  if (validationToken) {
    res.status(200).contentType("text/plain").send(validationToken);
    return;
  }

  res.status(202).send("Accepted");

  // Process notifications async
  setImmediate(async () => {
    const notifications = req.body?.value;
    if (!Array.isArray(notifications)) return;

    for (const notif of notifications) {
      const userId = notif.clientState;
      if (!userId) continue;

      try {
        await syncOutlookToGoogle(userId);
      } catch (err: any) {
        logger.error("Microsoft webhook sync failed", { userId, error: err.message });
      }
    }
  });
}

// ─── Poll Sync (Smart) ───────────────────────────────────────────

export async function handlePollSync(): Promise<void> {
  const users = await getUsersNeedingPoll();
  logger.info("Poll sync triggered", { usersToSync: users.length });

  for (const user of users) {
    try {
      await syncGoogleToOutlook(user.userId);
      await syncOutlookToGoogle(user.userId);

      // Orphan cleanup (rate-limited)
      if (user.googleRefreshToken && user.microsoftRefreshToken) {
        const g = await refreshGoogleAccessToken(user.googleRefreshToken);
        const m = await refreshMicrosoftAccessToken(user.microsoftRefreshToken);
        if (g && m) {
          await cleanOrphans(user.userId, g.accessToken, m.accessToken);
        }
      }
    } catch (err: any) {
      logger.error("Poll sync failed for user", { userId: user.userId, error: err.message });
    }
  }
}

// ─── Webhook Renewal (Cron) ──────────────────────────────────────

export async function handleRenewWebhooks(): Promise<void> {
  await renewAllWebhooks();
}
