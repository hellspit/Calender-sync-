import { UnifiedEvent, FreeSlot } from "../types/event";

/**
 * Find free time slots in a day, given a sorted list of events.
 *
 * @param events  – events for the day, sorted by start time
 * @param dayStart – start of working day as ISO string (e.g. "2026-03-20T09:00:00")
 * @param dayEnd   – end of working day as ISO string   (e.g. "2026-03-20T21:00:00")
 */
export function findFreeSlots(
  events: UnifiedEvent[],
  dayStart: string,
  dayEnd: string
): FreeSlot[] {
  const slots: FreeSlot[] = [];

  // Filter out all-day events — they don't block specific time
  const timedEvents = events.filter((e) => !e.isAllDay);

  if (timedEvents.length === 0) {
    // Entire day is free
    const durationMinutes = diffMinutes(dayStart, dayEnd);
    if (durationMinutes > 0) {
      slots.push({ start: dayStart, end: dayEnd, durationMinutes });
    }
    return slots;
  }

  // Check gap before first event
  const firstStart = timedEvents[0].start;
  addGapIfExists(slots, dayStart, firstStart);

  // Check gaps between consecutive events
  let latestEnd = timedEvents[0].end;
  for (let i = 1; i < timedEvents.length; i++) {
    const eventStart = timedEvents[i].start;
    const eventEnd = timedEvents[i].end;

    // Only count gap if this event starts after the latest end so far
    if (new Date(eventStart).getTime() > new Date(latestEnd).getTime()) {
      addGapIfExists(slots, latestEnd, eventStart);
    }

    // Track the latest ending time (handles overlapping events)
    if (new Date(eventEnd).getTime() > new Date(latestEnd).getTime()) {
      latestEnd = eventEnd;
    }
  }

  // Check gap after last event
  addGapIfExists(slots, latestEnd, dayEnd);

  return slots;
}

// ─── Helpers ──────────────────────────────────────────────────────

function addGapIfExists(
  slots: FreeSlot[],
  gapStart: string,
  gapEnd: string
): void {
  const minutes = diffMinutes(gapStart, gapEnd);
  if (minutes > 0) {
    slots.push({ start: gapStart, end: gapEnd, durationMinutes: minutes });
  }
}

function diffMinutes(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}
