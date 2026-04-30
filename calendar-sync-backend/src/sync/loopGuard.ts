/**
 * sync/loopGuard.ts — Prevent infinite sync loops.
 *
 * When we create/update an event on Calendar B, that change triggers
 * a webhook notification from Calendar B. Without a loop guard,
 * we'd sync it back to Calendar A → trigger A's webhook → infinite loop.
 *
 * Strategy: Use the event mappings table as the source of truth.
 * - Before creating: check if mapping already exists
 * - After creating: immediately store the mapping with current etag/changeKey
 * - On incoming change: check if the event's etag/changeKey matches what we last wrote
 *   - If yes → this is OUR OWN change, skip it
 *   - If no → this is a genuine USER change, sync it
 */

import { getMapping, getMappingByOutlookId, EventMapping } from "../db/eventMappingsTable";
import { logger } from "../utils/logger";

/**
 * Check if a Google Calendar change was caused by our sync (not the user).
 *
 * @param userId      - The user
 * @param googleEventId - The Google event that changed
 * @param currentEtag - The current etag of the event
 * @returns true if this change should be SKIPPED (it's our own sync)
 */
export async function isOurGoogleChange(
  userId: string,
  googleEventId: string,
  currentEtag: string | null
): Promise<boolean> {
  const mapping = await getMapping(userId, googleEventId);
  if (!mapping) return false; // No mapping = new event, not our change

  // If the etag matches what we last wrote, this is our own sync
  if (currentEtag && mapping.lastGoogleEtag === currentEtag) {
    logger.debug("Loop guard: skipping our own Google change", {
      userId,
      googleEventId,
      etag: currentEtag,
    });
    return true;
  }

  return false;
}

/**
 * Check if an Outlook Calendar change was caused by our sync (not the user).
 *
 * @param userId        - The user
 * @param outlookEventId - The Outlook event that changed
 * @param currentChangeKey - The current changeKey of the event
 * @returns true if this change should be SKIPPED (it's our own sync)
 */
export async function isOurOutlookChange(
  userId: string,
  outlookEventId: string,
  currentChangeKey: string | null
): Promise<boolean> {
  const mapping = await getMappingByOutlookId(userId, outlookEventId);
  if (!mapping) return false;

  if (currentChangeKey && mapping.lastOutlookChangeKey === currentChangeKey) {
    logger.debug("Loop guard: skipping our own Outlook change", {
      userId,
      outlookEventId,
      changeKey: currentChangeKey,
    });
    return true;
  }

  return false;
}

/**
 * Get the existing mapping for a Google event (if any).
 */
export async function getMappingForGoogle(
  userId: string,
  googleEventId: string
): Promise<EventMapping | null> {
  return getMapping(userId, googleEventId);
}

/**
 * Get the existing mapping for an Outlook event (if any).
 */
export async function getMappingForOutlook(
  userId: string,
  outlookEventId: string
): Promise<EventMapping | null> {
  return getMappingByOutlookId(userId, outlookEventId);
}
