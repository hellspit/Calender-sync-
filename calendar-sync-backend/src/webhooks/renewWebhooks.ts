/**
 * webhooks/renewWebhooks.ts — Renew expiring webhook channels/subscriptions.
 *
 * Runs on a cron schedule. Includes retry logic and graceful degradation
 * to poll-only mode if renewal permanently fails.
 */

import { getUsersWithExpiringWebhooks, updateUser, UserRecord } from "../db/usersTable";
import { refreshGoogleAccessToken } from "../auth/googleTokens";
import { refreshMicrosoftAccessToken } from "../auth/microsoftTokens";
import { registerGoogleWebhook, stopGoogleWebhook } from "./googleWebhook";
import { renewMicrosoftWebhook, registerMicrosoftWebhook } from "./microsoftWebhook";
import { config } from "../config";
import { logger } from "../utils/logger";

export async function renewAllWebhooks(): Promise<void> {
  const users = await getUsersWithExpiringWebhooks();

  if (users.length === 0) {
    logger.debug("No webhooks need renewal");
    return;
  }

  logger.info("Renewing webhooks", { userCount: users.length });

  for (const user of users) {
    await renewUserWebhooks(user);
  }
}

async function renewUserWebhooks(user: UserRecord): Promise<void> {
  const now = Date.now();
  const userId = user.userId;

  try {
    // ── Google Channel ──
    if (user.googleChannelExpiry && user.googleChannelExpiry < now + config.webhooks.googleRenewalGraceMs) {
      if (!user.googleRefreshToken) return;
      const gResult = await refreshGoogleAccessToken(user.googleRefreshToken);
      if (!gResult) {
        await handleRenewalFailure(user, "Google token expired");
        return;
      }

      // Stop old channel, register new one
      if (user.googleChannelId) {
        await stopGoogleWebhook(gResult.accessToken, user.googleChannelId);
      }
      await registerGoogleWebhook(userId, gResult.accessToken);
      logger.info("Renewed Google webhook", { userId });
    }

    // ── Microsoft Subscription ──
    if (user.msSubscriptionExpiry && user.msSubscriptionExpiry < now + config.webhooks.microsoftRenewalGraceMs) {
      if (!user.microsoftRefreshToken) return;
      const mResult = await refreshMicrosoftAccessToken(user.microsoftRefreshToken);
      if (!mResult) {
        await handleRenewalFailure(user, "Microsoft token expired");
        return;
      }

      try {
        if (user.msSubscriptionId) {
          const newExpiry = await renewMicrosoftWebhook(mResult.accessToken, user.msSubscriptionId);
          await updateUser(userId, { msSubscriptionExpiry: newExpiry, webhookRetryCount: 0 });
          logger.info("Renewed Microsoft webhook", { userId });
        }
      } catch {
        // Subscription may be gone — re-register
        await registerMicrosoftWebhook(userId, mResult.accessToken);
        logger.info("Re-registered Microsoft webhook", { userId });
      }
    }

    // Reset retry count on success
    await updateUser(userId, { webhookRetryCount: 0 });
  } catch (err: any) {
    await handleRenewalFailure(user, err.message);
  }
}

async function handleRenewalFailure(user: UserRecord, error: string): Promise<void> {
  const newCount = (user.webhookRetryCount ?? 0) + 1;
  logger.warn("Webhook renewal failed", { userId: user.userId, attempt: newCount, error });

  if (newCount >= 5) {
    // Degrade to poll-only mode
    await updateUser(user.userId, {
      webhookRetryCount: newCount,
      syncStatus: "degraded",
      lastError: `Webhook renewal failed: ${error}`,
      lastErrorAt: Date.now(),
    });
    logger.error("Webhook renewal permanently failed — degraded to poll-only", { userId: user.userId });
  } else {
    await updateUser(user.userId, { webhookRetryCount: newCount });
  }
}
