// ─── OAuth Configuration ───────────────────────────────────────────
// Values are loaded from .env via Expo's built-in EXPO_PUBLIC_ support.

export const GOOGLE_CONFIG = {
  clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  clientSecret: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET ?? "",
  scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
};

export const MICROSOFT_CONFIG = {
  clientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? "",
  clientSecret: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_SECRET ?? "",
  scopes: ["Calendars.Read"],
  tenantId: process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID ?? "",
};

// Day boundaries for free-time detection (24-hour format)
export const DAY_START_HOUR = 0;  // 00:00 midnight
export const DAY_END_HOUR = 24;  // 24:00 midnight (end of day)
