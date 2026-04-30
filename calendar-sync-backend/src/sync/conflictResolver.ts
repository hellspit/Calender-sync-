/**
 * sync/conflictResolver.ts — Per-field merge conflict resolution.
 *
 * When both Google and Outlook versions of the same event have changed
 * since the last sync, we do a field-level merge instead of naive
 * last-write-wins to prevent silent data loss.
 *
 * Each field independently takes the latest value. Attendees are unioned.
 */

import { NormalizedEvent } from "../calendar/normalizer";
import { logger } from "../utils/logger";

/**
 * The merged result to write to both calendars.
 */
export interface MergedFields {
  title: string;
  description: string | null;
  location: string | null;
  startUTC: string;
  endUTC: string;
  attendees: string[];
  isAllDay: boolean;
}

/**
 * Merge two conflicting versions of the same event.
 *
 * @param google  - Current Google version (normalized, UTC)
 * @param outlook - Current Outlook version (normalized, UTC)
 * @param lastSynced - The last-known state when both were in sync (optional snapshot)
 * @returns Merged fields to write to both calendars
 */
export function mergeConflict(
  google: NormalizedEvent,
  outlook: NormalizedEvent,
  lastSynced?: Partial<MergedFields> | null
): MergedFields {
  const gTime = google.updatedAt ? new Date(google.updatedAt).getTime() : 0;
  const oTime = outlook.updatedAt
    ? new Date(outlook.updatedAt).getTime()
    : 0;

  // Determine which version is "newer" for per-field fallback
  const googleIsNewer = gTime >= oTime;

  logger.info("Resolving conflict with field-level merge", {
    googleId: google.id,
    outlookId: outlook.id,
    googleUpdated: google.updatedAt,
    outlookUpdated: outlook.updatedAt,
  });

  // ─── Title ──────────────────────────────────────────────────────
  // If both changed from last-synced, pick the latest timestamp.
  // If only one changed, pick that one.
  const title = resolveField(
    google.title,
    outlook.title,
    lastSynced?.title,
    googleIsNewer
  );

  // ─── Description ────────────────────────────────────────────────
  const description = resolveField(
    google.description,
    outlook.description,
    lastSynced?.description,
    googleIsNewer
  );

  // ─── Location ───────────────────────────────────────────────────
  const location = resolveField(
    google.location,
    outlook.location,
    lastSynced?.location,
    googleIsNewer
  );

  // ─── Start/End Times ────────────────────────────────────────────
  const startUTC = resolveField(
    google.startUTC,
    outlook.startUTC,
    lastSynced?.startUTC,
    googleIsNewer
  )!;

  const endUTC = resolveField(
    google.endUTC,
    outlook.endUTC,
    lastSynced?.endUTC,
    googleIsNewer
  )!;

  // ─── Attendees (union merge) ────────────────────────────────────
  const attendeeSet = new Set<string>([
    ...google.attendees,
    ...outlook.attendees,
  ]);
  const attendees = Array.from(attendeeSet).filter(Boolean);

  // ─── isAllDay ───────────────────────────────────────────────────
  const isAllDay = googleIsNewer ? google.isAllDay : outlook.isAllDay;

  return { title, description, location, startUTC, endUTC, attendees, isAllDay };
}

/**
 * Resolve a single field between two versions.
 *
 * Logic:
 * - If both values are the same → return either (no conflict)
 * - If we have a last-synced snapshot:
 *   - Only Google changed → use Google's value
 *   - Only Outlook changed → use Outlook's value
 *   - Both changed → use the one from the newer timestamp
 * - If no snapshot → use the one from the newer timestamp
 */
function resolveField<T>(
  googleVal: T,
  outlookVal: T,
  lastSyncedVal: T | undefined,
  googleIsNewer: boolean
): T {
  // No conflict — values are identical
  if (googleVal === outlookVal) return googleVal;

  // If we have a last-synced reference point
  if (lastSyncedVal !== undefined) {
    const googleChanged = googleVal !== lastSyncedVal;
    const outlookChanged = outlookVal !== lastSyncedVal;

    if (googleChanged && !outlookChanged) return googleVal;
    if (!googleChanged && outlookChanged) return outlookVal;
    // Both changed — fall through to timestamp-based resolution
  }

  // Both changed (or no snapshot available) → latest timestamp wins
  return googleIsNewer ? googleVal : outlookVal;
}
