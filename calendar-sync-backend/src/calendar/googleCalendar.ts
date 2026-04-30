/**
 * calendar/googleCalendar.ts — Google Calendar API operations.
 *
 * Reused from the mobile app with additions:
 * - Delta sync support (syncToken for incremental changes)
 * - Event version tracking (etag)
 */

import axios from "axios";
import { config } from "../config";

const BASE_URL = config.google.calendarBaseUrl;

// ─── Types ────────────────────────────────────────────────────────

export interface GoogleEventData {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email: string; displayName?: string }>;
  etag?: string;
  status?: string; // "confirmed" | "cancelled"
  updated?: string; // ISO timestamp of last modification
}

export interface DeltaSyncResult {
  events: GoogleEventData[];
  nextSyncToken: string | null;
}

// ─── Fetch (full range) ───────────────────────────────────────────

export async function fetchGoogleEvents(
  token: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleEventData[]> {
  const events: GoogleEventData[] = [];
  let pageToken: string | undefined;

  do {
    const response = await axios.get(`${BASE_URL}/calendars/primary/events`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
        pageToken,
      },
    });

    if (response.data.items) {
      events.push(...response.data.items);
    }
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return events;
}

// ─── Delta Sync (incremental changes) ────────────────────────────

/**
 * Fetch only events that changed since the last syncToken.
 * On first call, pass syncToken = null to get a full sync + initial token.
 *
 * If the syncToken is expired (HTTP 410), falls back to a full sync.
 */
export async function fetchGoogleEventsDelta(
  token: string,
  syncToken: string | null
): Promise<DeltaSyncResult> {
  const events: GoogleEventData[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const params: Record<string, string | boolean | number | undefined> = {
        maxResults: 250,
        pageToken,
      };

      if (syncToken && !pageToken) {
        // Incremental sync — only changes since last sync
        params.syncToken = syncToken;
      } else if (!syncToken && !pageToken) {
        // Full sync — get everything
        params.singleEvents = true;
        params.orderBy = "startTime";
      }

      const response = await axios.get(`${BASE_URL}/calendars/primary/events`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      if (response.data.items) {
        events.push(...response.data.items);
      }

      pageToken = response.data.nextPageToken;

      // When there's no more pages, Google returns the nextSyncToken
      if (!pageToken && response.data.nextSyncToken) {
        return {
          events,
          nextSyncToken: response.data.nextSyncToken,
        };
      }
    } while (pageToken);

    return { events, nextSyncToken: null };
  } catch (err: any) {
    // HTTP 410 Gone = syncToken expired, need full re-sync
    if (err?.response?.status === 410) {
      return fetchGoogleEventsDelta(token, null);
    }
    throw err;
  }
}

// ─── Get Single Event ─────────────────────────────────────────────

export async function getGoogleEvent(
  token: string,
  eventId: string
): Promise<GoogleEventData | null> {
  try {
    const response = await axios.get(
      `${BASE_URL}/calendars/primary/events/${eventId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

// ─── Create ───────────────────────────────────────────────────────

export async function createGoogleEvent(
  token: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    attendees?: Array<{ email: string }>;
  }
): Promise<GoogleEventData> {
  const response = await axios.post(
    `${BASE_URL}/calendars/primary/events`,
    event,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

// ─── Update (PATCH) ───────────────────────────────────────────────

export async function updateGoogleEvent(
  token: string,
  eventId: string,
  updates: {
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    attendees?: Array<{ email: string }>;
  }
): Promise<GoogleEventData> {
  const response = await axios.patch(
    `${BASE_URL}/calendars/primary/events/${eventId}`,
    updates,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

// ─── Delete ───────────────────────────────────────────────────────

export async function deleteGoogleEvent(
  token: string,
  eventId: string
): Promise<boolean> {
  try {
    await axios.delete(`${BASE_URL}/calendars/primary/events/${eventId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return true;
  } catch (err: any) {
    // 404/410 = already deleted
    if (err?.response?.status === 404 || err?.response?.status === 410) {
      return true;
    }
    throw err;
  }
}
