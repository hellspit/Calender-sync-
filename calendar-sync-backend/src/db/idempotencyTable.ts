/**
 * db/idempotencyTable.ts — Deduplication for webhook notifications.
 *
 * Webhooks can fire multiple times for the same change. This table
 * stores a hash of each processed request. If the hash already exists,
 * the change is skipped (already processed).
 *
 * Hashes auto-expire after 24 hours via DynamoDB TTL.
 */

import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { createHash } from "crypto";
import { docClient } from "./dynamoClient";
import { config } from "../config";

const TABLE = config.db.idempotencyTable;

/**
 * Compute a deduplication hash for a sync event.
 *
 * Uses a 5-minute time bucket so that near-duplicate notifications
 * (same event notified twice within 5 minutes) produce the same hash.
 *
 * @param userId      – The user the event belongs to
 * @param eventId     – The calendar event ID
 * @param changeType  – "created" | "updated" | "deleted"
 */
export function computeIdempotencyHash(
  userId: string,
  eventId: string,
  changeType: string
): string {
  const bucketMs = config.sync.idempotencyBucketMs;
  const timeBucket = Math.floor(Date.now() / bucketMs) * bucketMs;
  const payload = `${userId}|${eventId}|${changeType}|${timeBucket}`;
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Check if this sync event was already processed.
 * @returns true if already processed (should be SKIPPED), false if new.
 */
export async function isDuplicate(hash: string): Promise<boolean> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE,
      Key: { requestHash: hash },
    })
  );
  return !!result.Item;
}

/**
 * Mark a sync event as processed.
 * The TTL field causes DynamoDB to auto-delete the record after 24 hours.
 */
export async function markProcessed(hash: string): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + config.sync.idempotencyTtlSeconds;

  await docClient.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        requestHash: hash,
        processedAt: Date.now(),
        ttl,
      },
    })
  );
}

/**
 * Check-and-mark in one call: returns true if this is a NEW (non-duplicate) event.
 * If new, it marks it as processed immediately.
 * If duplicate, returns false (skip it).
 */
export async function checkAndMark(
  userId: string,
  eventId: string,
  changeType: string
): Promise<boolean> {
  const hash = computeIdempotencyHash(userId, eventId, changeType);
  const duplicate = await isDuplicate(hash);
  if (duplicate) return false;
  await markProcessed(hash);
  return true;
}
