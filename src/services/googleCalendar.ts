import axios from "axios";

const BASE_URL = "https://www.googleapis.com/calendar/v3";

/**
 * Fetch events from the user's primary Google Calendar.
 * Handles pagination to get all events in the date range.
 */
export async function fetchGoogleEvents(
  token: string,
  timeMin: string,
  timeMax: string
): Promise<any[]> {
  const events: any[] = [];
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

export interface NewEventPayload {
  title: string;
  startISO: string; // full ISO with offset e.g. "2026-03-21T10:00:00+05:30"
  endISO: string;
  location?: string;
  description?: string;
  isAllDay?: boolean;
  allDayDate?: string; // "YYYY-MM-DD" used only when isAllDay is true
}

/**
 * Create an event on the user's primary Google Calendar.
 * Returns the created event's raw object.
 */
export async function createGoogleEvent(
  token: string,
  payload: NewEventPayload
): Promise<any> {
  const body: any = {
    summary: payload.title,
    location: payload.location,
    description: payload.description,
    start: payload.isAllDay
      ? { date: payload.allDayDate }
      : { dateTime: payload.startISO },
    end: payload.isAllDay
      ? { date: payload.allDayDate }
      : { dateTime: payload.endISO },
  };

  const response = await axios.post(
    `${BASE_URL}/calendars/primary/events`,
    body,
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );

  return response.data;
}

