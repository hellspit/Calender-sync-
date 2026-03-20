// Unified event model — normalizes Google & Outlook events into a single shape
export interface UnifiedEvent {
  id: string;
  title: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  source: "google" | "outlook";
  isAllDay?: boolean;
  location?: string;
  description?: string;
  attendees?: string[]; // list of display names or emails
}

// A gap between events where the user is free
export interface FreeSlot {
  start: string; // ISO 8601
  end: string; // ISO 8601
  durationMinutes: number;
}
