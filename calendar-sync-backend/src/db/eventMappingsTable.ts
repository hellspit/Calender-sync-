/**
 * db/eventMappingsTable.ts — CRUD for the calendar-sync-mappings table.
 *
 * Maps Google Calendar event IDs ↔ Outlook Calendar event IDs per user.
 * Tracks version info (etag/changeKey) for conflict detection.
 * Supports soft-delete for safe orphan cleanup.
 */

import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "./dynamoClient";
import { config } from "../config";

const TABLE = config.db.mappingsTable;

// ─── Types ────────────────────────────────────────────────────────

export interface EventMapping {
  userId: string;
  googleEventId: string;
  outlookEventId: string;
  lastGoogleEtag: string | null;
  lastOutlookChangeKey: string | null;
  lastSyncedAt: number;
  isDeleted: boolean;
}

// ─── Operations ───────────────────────────────────────────────────

/**
 * Get a mapping by userId + googleEventId.
 */
export async function getMapping(
  userId: string,
  googleEventId: string
): Promise<EventMapping | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE,
      Key: { userId, googleEventId },
    })
  );
  return (result.Item as EventMapping) ?? null;
}

/**
 * Find a mapping by Outlook event ID (reverse lookup).
 * Scans the user's mappings — acceptable at ≤10 users with few hundred events each.
 */
export async function getMappingByOutlookId(
  userId: string,
  outlookEventId: string
): Promise<EventMapping | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "#uid = :uid",
      FilterExpression: "#oid = :oid AND (#del = :false OR attribute_not_exists(#del))",
      ExpressionAttributeNames: {
        "#uid": "userId",
        "#oid": "outlookEventId",
        "#del": "isDeleted",
      },
      ExpressionAttributeValues: {
        ":uid": userId,
        ":oid": outlookEventId,
        ":false": false,
      },
    })
  );

  return (result.Items?.[0] as EventMapping) ?? null;
}

/**
 * Create or overwrite a mapping.
 */
export async function putMapping(mapping: EventMapping): Promise<void> {
  await docClient.send(
    new PutCommand({ TableName: TABLE, Item: mapping })
  );
}

/**
 * Update version tracking fields after a successful sync.
 */
export async function updateMappingVersions(
  userId: string,
  googleEventId: string,
  updates: {
    lastGoogleEtag?: string | null;
    lastOutlookChangeKey?: string | null;
    lastSyncedAt?: number;
    isDeleted?: boolean;
  }
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
      Key: { userId, googleEventId },
      UpdateExpression: `SET ${exprParts.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

/**
 * Soft-delete a mapping (mark as pending deletion).
 */
export async function softDeleteMapping(
  userId: string,
  googleEventId: string
): Promise<void> {
  await updateMappingVersions(userId, googleEventId, { isDeleted: true });
}

/**
 * Hard-delete a mapping (remove row entirely).
 */
export async function deleteMapping(
  userId: string,
  googleEventId: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE,
      Key: { userId, googleEventId },
    })
  );
}

/**
 * Get all active (non-deleted) mappings for a user.
 */
export async function getUserMappings(
  userId: string
): Promise<EventMapping[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "#uid = :uid",
      FilterExpression: "#del = :false OR attribute_not_exists(#del)",
      ExpressionAttributeNames: {
        "#uid": "userId",
        "#del": "isDeleted",
      },
      ExpressionAttributeValues: {
        ":uid": userId,
        ":false": false,
      },
    })
  );

  return (result.Items as EventMapping[]) ?? [];
}

/**
 * Get mappings that are soft-deleted (pending cleanup).
 */
export async function getDeletedMappings(
  userId: string
): Promise<EventMapping[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "#uid = :uid",
      FilterExpression: "#del = :true",
      ExpressionAttributeNames: {
        "#uid": "userId",
        "#del": "isDeleted",
      },
      ExpressionAttributeValues: {
        ":uid": userId,
        ":true": true,
      },
    })
  );

  return (result.Items as EventMapping[]) ?? [];
}

/**
 * Count all active mappings for a user.
 */
export async function countUserMappings(userId: string): Promise<number> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "#uid = :uid",
      FilterExpression: "#del = :false OR attribute_not_exists(#del)",
      ExpressionAttributeNames: {
        "#uid": "userId",
        "#del": "isDeleted",
      },
      ExpressionAttributeValues: {
        ":uid": userId,
        ":false": false,
      },
      Select: "COUNT",
    })
  );

  return result.Count ?? 0;
}
