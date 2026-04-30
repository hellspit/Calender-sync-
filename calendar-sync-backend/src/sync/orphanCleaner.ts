/**
 * sync/orphanCleaner.ts — Detect and clean orphan events.
 *
 * Verifies both sides of each mapping still exist and cleans up orphans.
 * Rate-limited to config.sync.orphanScanLimit per poll cycle per user.
 */

import { getUserMappings, getDeletedMappings, deleteMapping } from "../db/eventMappingsTable";
import { getGoogleEvent, deleteGoogleEvent } from "../calendar/googleCalendar";
import { getOutlookEvent, deleteOutlookEvent } from "../calendar/outlookCalendar";
import { config } from "../config";
import { logger } from "../utils/logger";

export async function cleanOrphans(
  userId: string,
  googleToken: string,
  outlookToken: string
): Promise<{ cleaned: number; errors: number }> {
  let cleaned = 0;
  let errors = 0;
  const limit = config.sync.orphanScanLimit;

  // 1. Process soft-deleted mappings
  const deleted = await getDeletedMappings(userId);
  for (const m of deleted.slice(0, Math.floor(limit / 2))) {
    try {
      await deleteGoogleEvent(googleToken, m.googleEventId).catch(() => {});
      await deleteOutlookEvent(outlookToken, m.outlookEventId).catch(() => {});
      await deleteMapping(userId, m.googleEventId);
      cleaned++;
    } catch (err: any) {
      logger.warn("Orphan cleanup failed", { userId, error: err.message });
      errors++;
    }
  }

  // 2. Verify active mappings
  const active = await getUserMappings(userId);
  for (const m of active.slice(0, limit - cleaned)) {
    try {
      const [gExists, oExists] = await Promise.all([
        getGoogleEvent(googleToken, m.googleEventId).then(e => !!e),
        getOutlookEvent(outlookToken, m.outlookEventId).then(e => !!e),
      ]);

      if (!gExists && !oExists) {
        await deleteMapping(userId, m.googleEventId);
        cleaned++;
      } else if (!gExists && oExists) {
        await deleteOutlookEvent(outlookToken, m.outlookEventId);
        await deleteMapping(userId, m.googleEventId);
        cleaned++;
      } else if (gExists && !oExists) {
        await deleteGoogleEvent(googleToken, m.googleEventId);
        await deleteMapping(userId, m.googleEventId);
        cleaned++;
      }
    } catch (err: any) {
      errors++;
    }
  }

  if (cleaned > 0) {
    logger.info("Orphan cleanup complete", { userId, cleaned, errors });
  }
  return { cleaned, errors };
}
