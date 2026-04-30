/**
 * db/usersTable.ts — CRUD operations for the calendar-sync-users table.
 *
 * Stores per-user OAuth tokens, sync state, webhook channel info, and error tracking.
 */

import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "./dynamoClient";
import { config } from "../config";

const TABLE = config.db.usersTable;

// ─── Types ────────────────────────────────────────────────────────

export type SyncStatus = "healthy" | "degraded" | "error";

export interface UserRecord {
  userId: string;
  googleRefreshToken: string | null;
  microsoftRefreshToken: string | null;
  googleSyncToken: string | null;
  microsoftDeltaLink: string | null;
  googleChannelId: string | null;
  googleChannelExpiry: number | null;
  msSubscriptionId: string | null;
  msSubscriptionExpiry: number | null;
  lastSyncAt: number | null;
  syncEnabled: boolean;
  syncStatus: SyncStatus;
  webhookRetryCount: number;
  syncRetryCount: number;
  lastError: string | null;
  lastErrorAt: number | null;
  createdAt: number;
}

// ─── Operations ───────────────────────────────────────────────────

export async function getUser(userId: string): Promise<UserRecord | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE, Key: { userId } })
  );
  return (result.Item as UserRecord) ?? null;
}

export async function createUser(
  userId: string,
  googleRefreshToken: string | null,
  microsoftRefreshToken: string | null
): Promise<UserRecord> {
  const user: UserRecord = {
    userId,
    googleRefreshToken,
    microsoftRefreshToken,
    googleSyncToken: null,
    microsoftDeltaLink: null,
    googleChannelId: null,
    googleChannelExpiry: null,
    msSubscriptionId: null,
    msSubscriptionExpiry: null,
    lastSyncAt: null,
    syncEnabled: true,
    syncStatus: "healthy",
    webhookRetryCount: 0,
    syncRetryCount: 0,
    lastError: null,
    lastErrorAt: null,
    createdAt: Date.now(),
  };

  await docClient.send(
    new PutCommand({ TableName: TABLE, Item: user })
  );

  return user;
}

export async function updateUser(
  userId: string,
  updates: Partial<Omit<UserRecord, "userId" | "createdAt">>
): Promise<void> {
  const entries = Object.entries(updates).filter(
    ([, v]) => v !== undefined
  );
  if (entries.length === 0) return;

  const exprParts: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  entries.forEach(([key, val], i) => {
    const nameKey = `#k${i}`;
    const valKey = `:v${i}`;
    exprParts.push(`${nameKey} = ${valKey}`);
    names[nameKey] = key;
    values[valKey] = val;
  });

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { userId },
      UpdateExpression: `SET ${exprParts.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

export async function deleteUser(userId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({ TableName: TABLE, Key: { userId } })
  );
}

/**
 * Get users that need polling (smart polling strategy):
 * - syncStatus = "degraded" (webhooks down, poll is their only sync)
 * - OR lastSyncAt < (now - staleness threshold) (stale)
 * - OR syncRetryCount > 0 AND < maxRetries (pending retry)
 *
 * Skips users with syncStatus = "error".
 */
export async function getUsersNeedingPoll(
  stalenessMs: number = config.sync.pollIntervalMs
): Promise<UserRecord[]> {
  const now = Date.now();
  const staleThreshold = now - stalenessMs;

  // DynamoDB Scan with filter — acceptable at ≤10 users
  const result = await docClient.send(
    new ScanCommand({
      TableName: TABLE,
      FilterExpression:
        "#enabled = :true AND #status <> :error AND (" +
        "#status = :degraded OR " +
        "#lastSync < :stale OR " +
        "#lastSync = :null OR " +
        "(#retryCount > :zero AND #retryCount < :maxRetry))",
      ExpressionAttributeNames: {
        "#enabled": "syncEnabled",
        "#status": "syncStatus",
        "#lastSync": "lastSyncAt",
        "#retryCount": "syncRetryCount",
      },
      ExpressionAttributeValues: {
        ":true": true,
        ":error": "error",
        ":degraded": "degraded",
        ":stale": staleThreshold,
        ":null": null,
        ":zero": 0,
        ":maxRetry": config.sync.maxRetries,
      },
    })
  );

  return (result.Items as UserRecord[]) ?? [];
}

/**
 * Get users with webhook channels/subscriptions approaching expiry.
 */
export async function getUsersWithExpiringWebhooks(): Promise<UserRecord[]> {
  const now = Date.now();
  const googleThreshold = now + config.webhooks.googleRenewalGraceMs;
  const msThreshold = now + config.webhooks.microsoftRenewalGraceMs;

  const result = await docClient.send(
    new ScanCommand({
      TableName: TABLE,
      FilterExpression:
        "#enabled = :true AND (" +
        "(#gExpiry < :gThresh AND #gExpiry > :zero) OR " +
        "(#mExpiry < :mThresh AND #mExpiry > :zero))",
      ExpressionAttributeNames: {
        "#enabled": "syncEnabled",
        "#gExpiry": "googleChannelExpiry",
        "#mExpiry": "msSubscriptionExpiry",
      },
      ExpressionAttributeValues: {
        ":true": true,
        ":gThresh": googleThreshold,
        ":mThresh": msThreshold,
        ":zero": 0,
      },
    })
  );

  return (result.Items as UserRecord[]) ?? [];
}

/**
 * Record a sync success — reset retry count and update lastSyncAt.
 */
export async function recordSyncSuccess(userId: string): Promise<void> {
  await updateUser(userId, {
    syncRetryCount: 0,
    lastError: null,
    lastErrorAt: null,
    syncStatus: "healthy",
    lastSyncAt: Date.now(),
  });
}

/**
 * Record a sync failure — increment retry count, store error.
 * Marks as "error" after maxRetries consecutive failures.
 */
export async function recordSyncFailure(
  userId: string,
  error: string,
  currentRetryCount: number
): Promise<void> {
  const newCount = currentRetryCount + 1;
  const status: SyncStatus =
    newCount >= config.sync.maxRetries ? "error" : "healthy";

  await updateUser(userId, {
    syncRetryCount: newCount,
    lastError: error,
    lastErrorAt: Date.now(),
    syncStatus: status,
  });
}
