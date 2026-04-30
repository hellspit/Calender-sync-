/**
 * config/index.ts — Central configuration loaded from environment variables.
 */

export const config = {
  // ─── Google OAuth (Web Application type) ───────────────────────
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    calendarBaseUrl: "https://www.googleapis.com/calendar/v3",
  },

  // ─── Microsoft OAuth ──────────────────────────────────────────
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    tenantId: process.env.MICROSOFT_TENANT_ID ?? "",
    get tokenEndpoint() {
      return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    },
    graphBaseUrl: "https://graph.microsoft.com/v1.0",
    scopes: ["Calendars.ReadWrite", "User.ReadBasic.All", "offline_access"],
  },

  // ─── DynamoDB ─────────────────────────────────────────────────
  db: {
    usersTable: process.env.DYNAMODB_USERS_TABLE ?? "calendar-sync-users",
    mappingsTable: process.env.DYNAMODB_MAPPINGS_TABLE ?? "calendar-sync-mappings",
    idempotencyTable: process.env.DYNAMODB_IDEMPOTENCY_TABLE ?? "calendar-sync-idempotency",
    region: process.env.AWS_REGION ?? "us-east-1",
    endpoint: process.env.DYNAMODB_ENDPOINT, // undefined in production (uses AWS default)
  },

  // ─── Webhooks ─────────────────────────────────────────────────
  webhooks: {
    baseUrl: process.env.WEBHOOK_BASE_URL ?? "",
    // Google push notification channels expire after ~7 days
    googleChannelTtlMs: 7 * 24 * 60 * 60 * 1000,
    // Microsoft Graph subscriptions expire after ~3 days (4230 minutes)
    microsoftSubscriptionTtlMs: 3 * 24 * 60 * 60 * 1000,
    // Grace periods for renewal
    googleRenewalGraceMs: 48 * 60 * 60 * 1000,   // Renew when < 48 hours remain
    microsoftRenewalGraceMs: 24 * 60 * 60 * 1000, // Renew when < 24 hours remain
  },

  // ─── API Authentication ───────────────────────────────────────
  auth: {
    secretKey: process.env.API_SECRET_KEY ?? "",
    timestampToleranceMs: 5 * 60 * 1000, // ±5 minutes
  },

  // ─── Sync ─────────────────────────────────────────────────────
  sync: {
    maxRetries: 5,           // Mark as ERROR after this many consecutive failures
    pollIntervalMs: 5 * 60 * 1000,  // 5 minutes
    orphanScanLimit: 20,     // Max mappings to verify per poll cycle per user
    idempotencyTtlSeconds: 24 * 60 * 60,  // 24 hours
    idempotencyBucketMs: 5 * 60 * 1000,   // 5-minute buckets for dedup
  },

  // ─── Server ───────────────────────────────────────────────────
  port: parseInt(process.env.PORT ?? "3001", 10),
};
