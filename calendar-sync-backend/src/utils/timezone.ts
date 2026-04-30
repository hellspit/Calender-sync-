/**
 * utils/timezone.ts — UTC normalization helpers.
 *
 * Key principle: EVERYTHING is UTC internally.
 * Timezone conversion only happens at the boundary — when reading from
 * or writing to the Google/Microsoft APIs.
 *
 * A meeting at 10:00 AM Tokyo stays at 10:00 AM Tokyo regardless of
 * where the user travels. The sync preserves the absolute moment in time.
 */

/**
 * Convert any datetime string to a UTC ISO string.
 *
 * Handles:
 *  - ISO with offset:  "2026-03-20T10:00:00+05:30"  → UTC
 *  - ISO with Z:       "2026-03-20T10:00:00Z"       → as-is
 *  - Naive datetime:   "2026-03-20T10:00:00"         → treated as UTC (append Z)
 *  - Outlook naive:    "2026-03-20T10:00:00.0000000" → treated as UTC (append Z)
 */
export function toUTC(dateTime: string): string {
  if (!dateTime) return "";

  // All-day dates like "2026-03-20" — return as-is (no time component)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTime)) {
    return dateTime;
  }

  // Strip trailing fractional seconds from Outlook (e.g., ".0000000")
  const cleaned = dateTime.replace(/\.\d+$/, "");

  // Parse into Date object — JS Date handles offset strings natively
  const d = new Date(cleaned.endsWith("Z") ? cleaned : cleaned + "Z");

  if (isNaN(d.getTime())) {
    // Fallback: if parsing fails, try as-is with Z
    return dateTime.endsWith("Z") ? dateTime : dateTime + "Z";
  }

  return d.toISOString();
}

/**
 * Convert a UTC ISO string to Google Calendar dateTime format.
 * Google accepts ISO with offset or Z suffix.
 *
 * @returns ISO string with Z suffix (UTC)
 */
export function utcToGoogleDateTime(utcISO: string): string {
  if (!utcISO) return "";
  // Google Calendar API is happy with Z-suffix UTC
  const d = new Date(utcISO);
  return d.toISOString();
}

/**
 * Convert a UTC ISO string to the naive datetime format Outlook expects.
 * Outlook wants: "2026-03-20T10:00:00" with a separate timeZone field.
 *
 * We always send as UTC with timeZone: "UTC" to Outlook.
 * This way, the calendar app displays it in the user's local timezone.
 *
 * @returns Naive datetime string without offset (e.g., "2026-03-20T10:00:00")
 */
export function utcToOutlookNaive(utcISO: string): string {
  if (!utcISO) return "";
  const d = new Date(utcISO);
  const Y = d.getUTCFullYear();
  const M = String(d.getUTCMonth() + 1).padStart(2, "0");
  const D = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${Y}-${M}-${D}T${h}:${m}:${s}`;
}

/**
 * Get the current time in UTC as an ISO string.
 */
export function nowUTC(): string {
  return new Date().toISOString();
}

/**
 * Get current UTC epoch in milliseconds.
 */
export function nowMs(): number {
  return Date.now();
}
