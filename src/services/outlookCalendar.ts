import axios, { AxiosResponse } from "axios";
import { NewEventPayload } from "./googleCalendar";

const BASE_URL = "https://graph.microsoft.com/v1.0";

/**
 * Fetch events from Microsoft Outlook Calendar.
 * Uses /me/calendarView for date-range queries (auto-expands recurrences).
 * Handles pagination via @odata.nextLink.
 */
export async function fetchOutlookEvents(
  token: string,
  startDateTime: string,
  endDateTime: string
): Promise<any[]> {
  const events: any[] = [];
  let url: string | null = `${BASE_URL}/me/calendarView`;
  const initialUrl = url;

  const params: Record<string, string> = {
    startDateTime,
    endDateTime,
    $top: "100",
    $orderby: "start/dateTime",
    $select: "id,subject,start,end,isAllDay,location,bodyPreview,attendees",
  };

  do {
    const response: AxiosResponse<any> = await axios.get(url!, {
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

/**
 * Create an event on the user's primary Outlook Calendar.
 * Returns the created event's raw object.
 */
export async function createOutlookEvent(
  token: string,
  payload: NewEventPayload
): Promise<any> {
  // Get the device's IANA timezone (e.g. "Asia/Kolkata")
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log("[OutlookCalendar] Device timezone:", deviceTimeZone);

  // For all-day events, MS Graph requires end date = start date + 1 day
  let allDayEnd = payload.allDayDate;
  if (payload.isAllDay && payload.allDayDate) {
    const d = new Date(payload.allDayDate);
    d.setDate(d.getDate() + 1);
    allDayEnd = d.toISOString().substring(0, 10);
  }

  // Helper: extract the DEVICE-LOCAL date/time as a naive string "YYYY-MM-DDTHH:MM:SS"
  // getHours()/getMinutes() always return local-device time, which matches deviceTimeZone.
  const toLocalNaive = (iso: string): string => {
    const d = new Date(iso);
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, "0");
    const D = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${Y}-${M}-${D}T${h}:${m}:${s}`;
  };

  const body: any = payload.isAllDay
    ? {
        subject: payload.title,
        location: payload.location ? { displayName: payload.location } : undefined,
        body: payload.description
          ? { contentType: "Text", content: payload.description }
          : undefined,
        isAllDay: true,
        start: { dateTime: `${payload.allDayDate}T00:00:00`, timeZone: deviceTimeZone },
        end: { dateTime: `${allDayEnd}T00:00:00`, timeZone: deviceTimeZone },
      }
    : {
        subject: payload.title,
        location: payload.location ? { displayName: payload.location } : undefined,
        body: payload.description
          ? { contentType: "Text", content: payload.description }
          : undefined,
        start: { dateTime: toLocalNaive(payload.startISO), timeZone: deviceTimeZone },
        end: { dateTime: toLocalNaive(payload.endISO), timeZone: deviceTimeZone },
      };

  console.log("[OutlookCalendar] Creating event:", JSON.stringify(body, null, 2));

  try {
    const response = await axios.post(`${BASE_URL}/me/events`, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("[OutlookCalendar] Event created successfully:", response.status);
    return response.data;
  } catch (err: any) {
    console.error(
      "[OutlookCalendar] Failed to create event:",
      err.response?.status,
      JSON.stringify(err.response?.data, null, 2)
    );
    throw err;
  }
}

/**
 * Update an event on the user's primary Outlook Calendar.
 * Uses PATCH so only provided fields are changed.
 */
export async function updateOutlookEvent(
  token: string,
  eventId: string,
  updates: { title?: string; location?: string; description?: string; startDateTime?: string; endDateTime?: string; timeZone?: string }
): Promise<any> {
  const tz = updates.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const body: any = {};
  if (updates.title !== undefined) body.subject = updates.title;
  if (updates.location !== undefined) body.location = { displayName: updates.location };
  if (updates.description !== undefined)
    body.body = { contentType: "Text", content: updates.description };
  if (updates.startDateTime !== undefined) body.start = { dateTime: updates.startDateTime, timeZone: tz };
  if (updates.endDateTime !== undefined) body.end = { dateTime: updates.endDateTime, timeZone: tz };

  const response = await axios.patch(`${BASE_URL}/me/events/${eventId}`, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  return response.data;
}

/**
 * Delete an event from the user's primary Outlook Calendar.
 */
export async function deleteOutlookEvent(
  token: string,
  eventId: string
): Promise<void> {
  await axios.delete(`${BASE_URL}/me/events/${eventId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
