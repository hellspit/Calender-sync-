import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { fetchGoogleEvents } from "../services/googleCalendar";
import { fetchOutlookEvents } from "../services/outlookCalendar";
import {
  normalizeGoogleEvents,
  normalizeOutlookEvents,
} from "../services/normalizer";
import { mergeEvents } from "../services/eventMerger";
import { findFreeSlots } from "../services/freeTimeFinder";
import { UnifiedEvent, FreeSlot } from "../types/event";
import { DAY_START_HOUR, DAY_END_HOUR } from "../config/auth";

interface CalendarData {
  events: UnifiedEvent[];
  freeSlots: FreeSlot[];
}

/**
 * Fetch, normalize, merge events from both calendars for a given date.
 * Also computes free time slots for that date.
 *
 * @param selectedDate – ISO date string, e.g. "2026-03-20"
 */
export function useCalendarEvents(selectedDate: string) {
  const { getValidGoogleToken, getValidMicrosoftToken } = useAuth();

  // Build day boundaries
  const dayStart = `${selectedDate}T${pad(DAY_START_HOUR)}:00:00`;
  const dayEnd = `${selectedDate}T${pad(DAY_END_HOUR)}:00:00`;
  const timeMin = `${selectedDate}T00:00:00Z`;
  const timeMax = `${selectedDate}T23:59:59Z`;

  return useQuery<CalendarData>({
    queryKey: ["calendarEvents", selectedDate],
    queryFn: async () => {
      // Always fetch a fresh (auto-refreshed if expired) token right before use
      const [googleToken, microsoftToken] = await Promise.all([
        getValidGoogleToken(),
        getValidMicrosoftToken(),
      ]);

      const [googleRaw, outlookRaw] = await Promise.all([
        googleToken
          ? fetchGoogleEvents(googleToken, timeMin, timeMax)
          : Promise.resolve([]),
        microsoftToken
          ? fetchOutlookEvents(microsoftToken, timeMin, timeMax)
          : Promise.resolve([]),
      ]);

      const googleEvents = normalizeGoogleEvents(googleRaw);
      const outlookEvents = normalizeOutlookEvents(outlookRaw);
      const events = mergeEvents(googleEvents, outlookEvents);
      const freeSlots = findFreeSlots(events, dayStart, dayEnd);

      return { events, freeSlots };
    },
    // Re-evaluate enabled state by checking storage directly is not needed —
    // the queryFn itself handles the null-token case. Just always run so a
    // silent refresh that restores a token is reflected on the next refetch.
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
