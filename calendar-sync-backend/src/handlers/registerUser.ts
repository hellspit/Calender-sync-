/**
 * handlers/registerUser.ts — POST /api/register
 *
 * Mobile app calls this after user connects both calendars.
 * Stores tokens, registers webhooks, triggers initial sync.
 */

import { Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { createUser, getUser, updateUser } from "../db/usersTable";
import { refreshGoogleAccessToken } from "../auth/googleTokens";
import { refreshMicrosoftAccessToken } from "../auth/microsoftTokens";
import { registerGoogleWebhook } from "../webhooks/googleWebhook";
import { registerMicrosoftWebhook } from "../webhooks/microsoftWebhook";
import { syncGoogleToOutlook, syncOutlookToGoogle } from "../sync/syncEngine";
import { logger } from "../utils/logger";

export async function handleRegister(req: Request, res: Response): Promise<void> {
  const { googleRefreshToken, microsoftRefreshToken, userId: existingId } = req.body;

  if (!googleRefreshToken || !microsoftRefreshToken) {
    res.status(400).json({ error: "Both googleRefreshToken and microsoftRefreshToken are required" });
    return;
  }

  try {
    // Verify tokens are valid by attempting refresh
    const [gResult, mResult] = await Promise.all([
      refreshGoogleAccessToken(googleRefreshToken),
      refreshMicrosoftAccessToken(microsoftRefreshToken),
    ]);

    if (!gResult) {
      res.status(400).json({ error: "Invalid Google refresh token" });
      return;
    }
    if (!mResult) {
      res.status(400).json({ error: "Invalid Microsoft refresh token" });
      return;
    }

    // Create or update user
    let userId = existingId;
    if (userId) {
      const existing = await getUser(userId);
      if (existing) {
        await updateUser(userId, {
          googleRefreshToken,
          microsoftRefreshToken,
          syncEnabled: true,
          syncStatus: "healthy",
          syncRetryCount: 0,
          lastError: null,
        });
      } else {
        userId = null; // Force create
      }
    }

    if (!userId) {
      userId = uuid();
      await createUser(userId, googleRefreshToken, microsoftRefreshToken);
    }

    // Register webhooks (best-effort — sync works via polling if these fail)
    try {
      await registerGoogleWebhook(userId, gResult.accessToken);
    } catch (err: any) {
      logger.warn("Failed to register Google webhook (will use polling)", { userId, error: err.message });
    }

    try {
      await registerMicrosoftWebhook(userId, mResult.accessToken);
    } catch (err: any) {
      logger.warn("Failed to register Microsoft webhook (will use polling)", { userId, error: err.message });
    }

    // Trigger initial sync (async — don't block the response)
    setImmediate(async () => {
      try {
        await syncGoogleToOutlook(userId!);
        await syncOutlookToGoogle(userId!);
      } catch (err: any) {
        logger.error("Initial sync failed", { userId, error: err.message });
      }
    });

    res.json({
      userId,
      syncEnabled: true,
      message: "Two-way sync activated. Initial sync is running in the background.",
    });

    logger.info("User registered for sync", { userId });
  } catch (err: any) {
    logger.error("Registration failed", { error: err.message });
    res.status(500).json({ error: "Registration failed: " + err.message });
  }
}
