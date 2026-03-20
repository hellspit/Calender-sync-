import { UnifiedEvent } from "../types/event";

/**
 * Convert a raw Google Calendar event into a UnifiedEvent.
 *
 * Google events have either:
 *   - dateTime (timed event)  e.g. "2026-03-20T10:00:00+05:30"
 *   - date     (all-day event) e.g. "2026-03-20"
 */
export function normalizeGoogleEvent(raw: any): UnifiedEvent {
  const isAllDay = !!raw.start?.date;
  const attendees: string[] = (raw.attendees ?? []).map(
    (a: any) => a.displayName || a.email || ""
  ).filter(Boolean);
  return {
    id: `g_${raw.id}`,
    title: raw.summary || "(No title)",
    start: raw.start?.dateTime || raw.start?.date || "",
    end: raw.end?.dateTime || raw.end?.date || "",
    source: "google",
    isAllDay,
    location: raw.location,
    description: raw.description,
    attendees: attendees.length > 0 ? attendees : undefined,
  };
}

/**
 * Convert a raw Microsoft Outlook event into a UnifiedEvent.
 *
 * Outlook events have:
 *   - start.dateTime  e.g. "2026-03-20T10:00:00.0000000"
 *   - start.timeZone  e.g. "India Standard Time"
 *   - isAllDay        boolean
 */
export function normalizeOutlookEvent(raw: any): UnifiedEvent {
  // Outlook dateTime values don't include offset; append Z to treat as UTC
  // (the calendarView endpoint returns UTC by default with Prefer header)
  const startStr = raw.start?.dateTime
    ? raw.start.dateTime.endsWith("Z")
      ? raw.start.dateTime
      : `${raw.start.dateTime}Z`
    : "";
  const endStr = raw.end?.dateTime
    ? raw.end.dateTime.endsWith("Z")
      ? raw.end.dateTime
      : `${raw.end.dateTime}Z`
    : "";

  const attendees: string[] = (raw.attendees ?? []).map(
    (a: any) => a.emailAddress?.name || a.emailAddress?.address || ""
  ).filter(Boolean);

  return {
    id: `m_${raw.id}`,
    title: raw.subject || "(No title)",
    start: startStr,
    end: endStr,
    source: "outlook",
    isAllDay: raw.isAllDay || false,
    location: raw.location?.displayName,
    description: raw.bodyPreview || raw.body?.content,
    attendees: attendees.length > 0 ? attendees : undefined,
  };
}

/**
 * Normalize an array of raw Google events.
 */
export function normalizeGoogleEvents(rawEvents: any[]): UnifiedEvent[] {
  return rawEvents.map(normalizeGoogleEvent);
}

/**
 * Normalize an array of raw Outlook events.
 */
export function normalizeOutlookEvents(rawEvents: any[]): UnifiedEvent[] {
  return rawEvents.map(normalizeOutlookEvent);
}
