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
        singleEvents: true, // expand recurring events
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
