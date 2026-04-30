/**
 * webhooks/googleWebhook.ts — Google Calendar push notification management.
 *
 * Registers/renews webhook channels so Google sends us a POST
 * whenever events change on the user's primary calendar.
 */

import axios from "axios";
import { v4 as uuid } from "uuid";
import { config } from "../config";
import { updateUser } from "../db/usersTable";
import { logger } from "../utils/logger";

/**
 * Register a Google Calendar push notification channel.
 * Google will POST to our webhook URL when events change.
 *
 * @returns channelId and expiration timestamp
 */
export async function registerGoogleWebhook(
  userId: string,
  googleToken: string
): Promise<{ channelId: string; expiration: number }> {
  const channelId = uuid();
  const ttlMs = config.webhooks.googleChannelTtlMs;
  const expiration = Date.now() + ttlMs;

  const response = await axios.post(
    `${config.google.calendarBaseUrl}/calendars/primary/events/watch`,
    {
      id: channelId,
      type: "web_hook",
      address: `${config.webhooks.baseUrl}/webhooks/google`,
      token: userId, // We use userId as the channel token for identification
      expiration,
    },
    { headers: { Authorization: `Bearer ${googleToken}` } }
  );

  const actualExpiration = Number(response.data.expiration) || expiration;

  await updateUser(userId, {
    googleChannelId: channelId,
    googleChannelExpiry: actualExpiration,
  });

  logger.info("Registered Google webhook", { userId, channelId, expiration: actualExpiration });
  return { channelId, expiration: actualExpiration };
}

/**
 * Stop (unregister) a Google Calendar push notification channel.
 */
export async function stopGoogleWebhook(
  googleToken: string,
  channelId: string,
  resourceId?: string
): Promise<void> {
  try {
    await axios.post(
      "https://www.googleapis.com/calendar/v3/channels/stop",
      { id: channelId, resourceId: resourceId || "" },
      { headers: { Authorization: `Bearer ${googleToken}` } }
    );
  } catch {
    // Best-effort — channel may already be expired
  }
}
