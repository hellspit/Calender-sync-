/**
 * webhooks/microsoftWebhook.ts — Microsoft Graph subscription management.
 *
 * Registers/renews subscriptions so Microsoft sends us a POST
 * whenever events change on the user's calendar.
 */

import axios from "axios";
import { config } from "../config";
import { updateUser } from "../db/usersTable";
import { logger } from "../utils/logger";

/**
 * Register a Microsoft Graph subscription for calendar events.
 *
 * @returns subscriptionId and expiration timestamp
 */
export async function registerMicrosoftWebhook(
  userId: string,
  microsoftToken: string
): Promise<{ subscriptionId: string; expiration: number }> {
  const ttlMs = config.webhooks.microsoftSubscriptionTtlMs;
  const expirationDateTime = new Date(Date.now() + ttlMs).toISOString();

  const response = await axios.post(
    `${config.microsoft.graphBaseUrl}/subscriptions`,
    {
      changeType: "created,updated,deleted",
      notificationUrl: `${config.webhooks.baseUrl}/webhooks/microsoft`,
      resource: "me/events",
      expirationDateTime,
      clientState: userId, // We use userId for verification
    },
    {
      headers: {
        Authorization: `Bearer ${microsoftToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const sub = response.data;
  const actualExpiry = new Date(sub.expirationDateTime).getTime();

  await updateUser(userId, {
    msSubscriptionId: sub.id,
    msSubscriptionExpiry: actualExpiry,
  });

  logger.info("Registered Microsoft webhook", { userId, subscriptionId: sub.id });
  return { subscriptionId: sub.id, expiration: actualExpiry };
}

/**
 * Renew a Microsoft Graph subscription.
 */
export async function renewMicrosoftWebhook(
  microsoftToken: string,
  subscriptionId: string
): Promise<number> {
  const ttlMs = config.webhooks.microsoftSubscriptionTtlMs;
  const expirationDateTime = new Date(Date.now() + ttlMs).toISOString();

  const response = await axios.patch(
    `${config.microsoft.graphBaseUrl}/subscriptions/${subscriptionId}`,
    { expirationDateTime },
    {
      headers: {
        Authorization: `Bearer ${microsoftToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  return new Date(response.data.expirationDateTime).getTime();
}

/**
 * Delete a Microsoft Graph subscription.
 */
export async function deleteMicrosoftWebhook(
  microsoftToken: string,
  subscriptionId: string
): Promise<void> {
  try {
    await axios.delete(
      `${config.microsoft.graphBaseUrl}/subscriptions/${subscriptionId}`,
      { headers: { Authorization: `Bearer ${microsoftToken}` } }
    );
  } catch {
    // Best-effort
  }
}
