/**
 * calendar/normalizer.ts — Normalize raw calendar events into a unified shape.
 *
 * All timestamps are converted to UTC on ingestion.
 * Timezone conversion only happens at the API boundary.
 */

import { toUTC } from "../utils/timezone";
import { GoogleEventData } from "./googleCalendar";
import { OutlookEventData } from "./outlookCalendar";

// ─── Unified Event (internal representation, always UTC) ──────────

export interface NormalizedEvent {
  id: string;
  source: "google" | "outlook";
  title: string;
  description: string | null;
  location: string | null;
  startUTC: string;   // Always UTC ISO
  endUTC: string;     // Always UTC ISO
  isAllDay: boolean;
  attendees: string[];  // Email addresses
  etag: string | null;  // Google etag or Outlook changeKey
  updatedAt: string | null; // ISO timestamp of last modification
  status: "active" | "deleted";
}

// ─── Google → Normalized ──────────────────────────────────────────

export function normalizeGoogleEvent(raw: GoogleEventData): NormalizedEvent {
  const isAllDay = !!raw.start?.date;
  const startRaw = raw.start?.dateTime || raw.start?.date || "";
  const endRaw = raw.end?.dateTime || raw.end?.date || "";

  const attendees: string[] = (raw.attendees ?? [])
    .map((a) => a.email || "")
    .filter(Boolean);

  return {
    id: raw.id,
    source: "google",
    title: raw.summary || "(No title)",
    description: raw.description ?? null,
    location: raw.location ?? null,
    startUTC: toUTC(startRaw),
    endUTC: toUTC(endRaw),
    isAllDay,
    attendees,
    etag: raw.etag ?? null,
    updatedAt: raw.updated ?? null,
    status: raw.status === "cancelled" ? "deleted" : "active",
  };
}

// ─── Outlook → Normalized ─────────────────────────────────────────

export function normalizeOutlookEvent(raw: OutlookEventData): NormalizedEvent {
  // Outlook datetimes from calendarView with Prefer: UTC don't have offset
  const startRaw = raw.start?.dateTime || "";
  const endRaw = raw.end?.dateTime || "";

  const attendees: string[] = (raw.attendees ?? [])
    .map((a) => a.emailAddress?.address || "")
    .filter(Boolean);

  const isRemoved = !!raw["@removed"];

  return {
    id: raw.id,
    source: "outlook",
    title: raw.subject || "(No title)",
    description: raw.bodyPreview ?? raw.body?.content ?? null,
    location: raw.location?.displayName ?? null,
    startUTC: toUTC(startRaw),
    endUTC: toUTC(endRaw),
    isAllDay: raw.isAllDay || false,
    attendees,
    etag: raw.changeKey ?? raw["@odata.etag"] ?? null,
    updatedAt: raw.lastModifiedDateTime ?? null,
    status: isRemoved ? "deleted" : "active",
  };
}
