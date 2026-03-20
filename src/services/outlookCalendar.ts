import axios, { AxiosResponse } from "axios";

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
    $select: "id,subject,start,end,isAllDay,location",
  };

  do {
    const response: AxiosResponse<any> = await axios.get(url!, {
      headers: { Authorization: `Bearer ${token}` },
      params: url === initialUrl ? params : undefined,
    });

    if (response.data.value) {
      events.push(...response.data.value);
    }
    url = response.data["@odata.nextLink"] || null;
  } while (url);

  return events;
}
