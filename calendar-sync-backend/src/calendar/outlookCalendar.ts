/**
 * calendar/outlookCalendar.ts — Microsoft Outlook Calendar API operations.
 *
 * Reused from the mobile app with additions:
 * - Delta sync support (deltaLink for incremental changes)
 * - Event version tracking (changeKey / @odata.etag)
 * - UTC-based timezone handling
 */

import axios, { AxiosResponse } from "axios";
import { config } from "../config";

const BASE_URL = config.microsoft.graphBaseUrl;

// ─── Types ────────────────────────────────────────────────────────

export interface OutlookEventData {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType: string; content: string };
  location?: { displayName?: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay?: boolean;
  attendees?: Array<{
    emailAddress: { address: string; name?: string };
    type?: string;
  }>;
  changeKey?: string;
  lastModifiedDateTime?: string;
  "@odata.etag"?: string;
  // Delta sync may return removed items
  "@removed"?: { reason: string };
}

export interface DeltaSyncResult {
  events: OutlookEventData[];
  nextDeltaLink: string | null;
}

// ─── Fetch (full range) ───────────────────────────────────────────

export async function fetchOutlookEvents(
  token: string,
  startDateTime: string,
  endDateTime: string
): Promise<OutlookEventData[]> {
  const events: OutlookEventData[] = [];
  let url: string | null = `${BASE_URL}/me/calendarView`;
  const initialUrl = url;

  const params: Record<string, string> = {
    startDateTime,
    endDateTime,
    $top: "100",
    $orderby: "start/dateTime",
    $select:
      "id,subject,start,end,isAllDay,location,bodyPreview,attendees,changeKey,lastModifiedDateTime",
  };

  do {
    const response: AxiosResponse = await axios.get(url!, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.timezone="UTC"',
      },
      params: url === initialUrl ? params : undefined,
    });

    if (response.data.value) {
      events.push(...response.data.value);
    }
    url = response.data["@odata.nextLink"] || null;
  } while (url);

  return events;
}

// ─── Delta Sync (incremental changes) ────────────────────────────

/**
 * Fetch only events that changed since the last deltaLink.
 * On first call, pass deltaLink = null to get a full sync + initial link.
 *
 * If the deltaLink is expired (HTTP 410), falls back to a full delta sync.
 */
export async function fetchOutlookEventsDelta(
  token: string,
  deltaLink: string | null
): Promise<DeltaSyncResult> {
  const events: OutlookEventData[] = [];

  try {
    let url: string | null = deltaLink || `${BASE_URL}/me/calendarView/delta`;
    const isInitial = !deltaLink;

    do {
      const requestConfig: any = {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'outlook.timezone="UTC"',
        },
      };

      // On initial sync, provide date range params
      if (isInitial && url === `${BASE_URL}/me/calendarView/delta`) {
        // Sync events from 6 months ago to 6 months ahead
        const now = new Date();
        const start = new Date(now);
        start.setMonth(start.getMonth() - 6);
        const end = new Date(now);
        end.setMonth(end.getMonth() + 6);

        requestConfig.params = {
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          $select:
            "id,subject,start,end,isAllDay,location,bodyPreview,attendees,changeKey,lastModifiedDateTime",
        };
      }

      const response: AxiosResponse = await axios.get(url!, requestConfig);

      if (response.data.value) {
        events.push(...response.data.value);
      }

      // nextLink = more pages; deltaLink = we're done, save for next time
      url = response.data["@odata.nextLink"] || null;

      if (!url && response.data["@odata.deltaLink"]) {
        return {
          events,
          nextDeltaLink: response.data["@odata.deltaLink"],
        };
      }
    } while (url);

    return { events, nextDeltaLink: null };
  } catch (err: any) {
    // HTTP 410 Gone = deltaLink expired, need full re-sync
    if (err?.response?.status === 410) {
      return fetchOutlookEventsDelta(token, null);
    }
    throw err;
  }
}

// ─── Get Single Event ─────────────────────────────────────────────

export async function getOutlookEvent(
  token: string,
  eventId: string
): Promise<OutlookEventData | null> {
  try {
    const response = await axios.get(`${BASE_URL}/me/events/${eventId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.timezone="UTC"',
      },
      params: {
        $select:
          "id,subject,start,end,isAllDay,location,bodyPreview,attendees,changeKey,lastModifiedDateTime",
      },
    });
    return response.data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

// ─── Create ───────────────────────────────────────────────────────

export async function createOutlookEvent(
  token: string,
  event: {
    subject: string;
    body?: { contentType: string; content: string };
    location?: { displayName: string };
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    isAllDay?: boolean;
    attendees?: Array<{
      emailAddress: { address: string };
      type: string;
    }>;
  }
): Promise<OutlookEventData> {
  const response = await axios.post(`${BASE_URL}/me/events`, event, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return response.data;
}

// ─── Update (PATCH) ───────────────────────────────────────────────

export async function updateOutlookEvent(
  token: string,
  eventId: string,
  updates: {
    subject?: string;
    body?: { contentType: string; content: string };
    location?: { displayName: string };
    start?: { dateTime: string; timeZone: string };
    end?: { dateTime: string; timeZone: string };
    attendees?: Array<{
      emailAddress: { address: string };
      type: string;
    }>;
  }
): Promise<OutlookEventData> {
  const response = await axios.patch(
    `${BASE_URL}/me/events/${eventId}`,
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

export async function deleteOutlookEvent(
  token: string,
  eventId: string
): Promise<boolean> {
  try {
    await axios.delete(`${BASE_URL}/me/events/${eventId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return true;
  } catch (err: any) {
    // 404 = already deleted
    if (err?.response?.status === 404) return true;
    throw err;
  }
}
