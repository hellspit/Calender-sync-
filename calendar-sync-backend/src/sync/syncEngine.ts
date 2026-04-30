/**
 * sync/syncEngine.ts — Core two-way sync logic.
 *
 * Two entry points:
 * - syncGoogleToOutlook(userId): Google changes → mirror to Outlook
 * - syncOutlookToGoogle(userId): Outlook changes → mirror to Google
 *
 * Uses delta sync, idempotency, loop guard, and conflict resolution.
 */

import { getUser, updateUser, recordSyncSuccess, recordSyncFailure } from "../db/usersTable";
import { getMapping, getMappingByOutlookId, putMapping, softDeleteMapping, updateMappingVersions } from "../db/eventMappingsTable";
import { checkAndMark } from "../db/idempotencyTable";
import { refreshGoogleAccessToken } from "../auth/googleTokens";
import { refreshMicrosoftAccessToken } from "../auth/microsoftTokens";
import { fetchGoogleEventsDelta, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from "../calendar/googleCalendar";
import { fetchOutlookEventsDelta, createOutlookEvent, updateOutlookEvent, deleteOutlookEvent } from "../calendar/outlookCalendar";
import { normalizeGoogleEvent, normalizeOutlookEvent, NormalizedEvent } from "../calendar/normalizer";
import { isOurGoogleChange, isOurOutlookChange } from "./loopGuard";
import { utcToGoogleDateTime, utcToOutlookNaive } from "../utils/timezone";
import { logger } from "../utils/logger";

// ─── Token Helper ─────────────────────────────────────────────────

async function getTokens(userId: string): Promise<{
  googleToken: string;
  outlookToken: string;
} | null> {
  const user = await getUser(userId);
  if (!user || !user.syncEnabled) return null;
  if (!user.googleRefreshToken || !user.microsoftRefreshToken) return null;

  const [gResult, mResult] = await Promise.all([
    refreshGoogleAccessToken(user.googleRefreshToken),
    refreshMicrosoftAccessToken(user.microsoftRefreshToken),
  ]);

  if (!gResult || !mResult) {
    const which = !gResult ? "Google" : "Microsoft";
    await recordSyncFailure(userId, `${which} token expired. Please re-authenticate.`, user.syncRetryCount);
    return null;
  }

  // Update refresh tokens if rotated
  if (gResult.newRefreshToken || mResult.newRefreshToken) {
    await updateUser(userId, {
      ...(gResult.newRefreshToken ? { googleRefreshToken: gResult.newRefreshToken } : {}),
      ...(mResult.newRefreshToken ? { microsoftRefreshToken: mResult.newRefreshToken } : {}),
    });
  }

  return { googleToken: gResult.accessToken, outlookToken: mResult.accessToken };
}

// ─── Google → Outlook ─────────────────────────────────────────────

export async function syncGoogleToOutlook(userId: string): Promise<void> {
  const user = await getUser(userId);
  if (!user || !user.syncEnabled || user.syncStatus === "error") return;

  logger.info("Starting Google → Outlook sync", { userId });

  try {
    const tokens = await getTokens(userId);
    if (!tokens) return;

    const { googleToken, outlookToken } = tokens;
    const delta = await fetchGoogleEventsDelta(googleToken, user.googleSyncToken);

    let synced = 0;
    for (const raw of delta.events) {
      const event = normalizeGoogleEvent(raw);

      // Idempotency check
      const changeType = event.status === "deleted" ? "deleted" : "upsert";
      const isNew = await checkAndMark(userId, event.id, `g2o_${changeType}`);
      if (!isNew) continue;

      // Loop guard — skip if this change was made by our own sync
      if (await isOurGoogleChange(userId, event.id, event.etag)) continue;

      if (event.status === "deleted") {
        await handleGoogleDelete(userId, event.id, outlookToken);
      } else {
        await handleGoogleUpsert(userId, event, googleToken, outlookToken);
      }
      synced++;
    }

    // Save new syncToken
    if (delta.nextSyncToken) {
      await updateUser(userId, { googleSyncToken: delta.nextSyncToken });
    }

    await recordSyncSuccess(userId);
    logger.info("Google → Outlook sync complete", { userId, synced, total: delta.events.length });
  } catch (err: any) {
    // Rate limit — don't count as failure
    if (err?.response?.status === 429) {
      logger.warn("Google API rate limited, skipping this cycle", { userId });
      return;
    }
    logger.error("Google → Outlook sync failed", { userId, error: err.message });
    const user2 = await getUser(userId);
    await recordSyncFailure(userId, err.message, user2?.syncRetryCount ?? 0);
  }
}

async function handleGoogleDelete(userId: string, googleEventId: string, outlookToken: string): Promise<void> {
  const mapping = await getMapping(userId, googleEventId);
  if (!mapping) return;

  await softDeleteMapping(userId, googleEventId);
  try {
    await deleteOutlookEvent(outlookToken, mapping.outlookEventId);
    const { deleteMapping: del } = await import("../db/eventMappingsTable");
    await del(userId, googleEventId);
    logger.info("Deleted Outlook event (Google deleted)", { userId, googleEventId, outlookEventId: mapping.outlookEventId });
  } catch (err: any) {
    if (err?.response?.status === 404) {
      const { deleteMapping: del } = await import("../db/eventMappingsTable");
      await del(userId, googleEventId);
    }
  }
}

async function handleGoogleUpsert(
  userId: string,
  event: NormalizedEvent,
  googleToken: string,
  outlookToken: string
): Promise<void> {
  const mapping = await getMapping(userId, event.id);

  const outlookBody = buildOutlookPayload(event);

  if (!mapping) {
    // CREATE in Outlook
    const created = await createOutlookEvent(outlookToken, outlookBody);
    await putMapping({
      userId,
      googleEventId: event.id,
      outlookEventId: created.id,
      lastGoogleEtag: event.etag,
      lastOutlookChangeKey: created.changeKey ?? null,
      lastSyncedAt: Date.now(),
      isDeleted: false,
    });
    logger.info("Created Outlook event from Google", { userId, googleEventId: event.id, outlookEventId: created.id });
  } else {
    // UPDATE in Outlook
    const updated = await updateOutlookEvent(outlookToken, mapping.outlookEventId, outlookBody);
    await updateMappingVersions(userId, event.id, {
      lastGoogleEtag: event.etag,
      lastOutlookChangeKey: updated.changeKey ?? null,
      lastSyncedAt: Date.now(),
    });
    logger.info("Updated Outlook event from Google", { userId, googleEventId: event.id });
  }
}

// ─── Outlook → Google ─────────────────────────────────────────────

export async function syncOutlookToGoogle(userId: string): Promise<void> {
  const user = await getUser(userId);
  if (!user || !user.syncEnabled || user.syncStatus === "error") return;

  logger.info("Starting Outlook → Google sync", { userId });

  try {
    const tokens = await getTokens(userId);
    if (!tokens) return;

    const { googleToken, outlookToken } = tokens;
    const delta = await fetchOutlookEventsDelta(outlookToken, user.microsoftDeltaLink);

    let synced = 0;
    for (const raw of delta.events) {
      const event = normalizeOutlookEvent(raw);

      const changeType = event.status === "deleted" ? "deleted" : "upsert";
      const isNew = await checkAndMark(userId, event.id, `o2g_${changeType}`);
      if (!isNew) continue;

      if (await isOurOutlookChange(userId, event.id, event.etag)) continue;

      if (event.status === "deleted") {
        await handleOutlookDelete(userId, event.id, googleToken);
      } else {
        await handleOutlookUpsert(userId, event, googleToken, outlookToken);
      }
      synced++;
    }

    if (delta.nextDeltaLink) {
      await updateUser(userId, { microsoftDeltaLink: delta.nextDeltaLink });
    }

    await recordSyncSuccess(userId);
    logger.info("Outlook → Google sync complete", { userId, synced, total: delta.events.length });
  } catch (err: any) {
    if (err?.response?.status === 429) {
      logger.warn("Microsoft API rate limited, skipping this cycle", { userId });
      return;
    }
    logger.error("Outlook → Google sync failed", { userId, error: err.message });
    const user2 = await getUser(userId);
    await recordSyncFailure(userId, err.message, user2?.syncRetryCount ?? 0);
  }
}

async function handleOutlookDelete(userId: string, outlookEventId: string, googleToken: string): Promise<void> {
  const mapping = await getMappingByOutlookId(userId, outlookEventId);
  if (!mapping) return;

  await softDeleteMapping(userId, mapping.googleEventId);
  try {
    await deleteGoogleEvent(googleToken, mapping.googleEventId);
    const { deleteMapping: del } = await import("../db/eventMappingsTable");
    await del(userId, mapping.googleEventId);
    logger.info("Deleted Google event (Outlook deleted)", { userId, outlookEventId, googleEventId: mapping.googleEventId });
  } catch (err: any) {
    if (err?.response?.status === 404 || err?.response?.status === 410) {
      const { deleteMapping: del } = await import("../db/eventMappingsTable");
      await del(userId, mapping.googleEventId);
    }
  }
}

async function handleOutlookUpsert(
  userId: string,
  event: NormalizedEvent,
  googleToken: string,
  outlookToken: string
): Promise<void> {
  const mapping = await getMappingByOutlookId(userId, event.id);

  const googleBody = buildGooglePayload(event);

  if (!mapping) {
    // CREATE in Google
    const created = await createGoogleEvent(googleToken, googleBody);
    await putMapping({
      userId,
      googleEventId: created.id,
      outlookEventId: event.id,
      lastGoogleEtag: created.etag ?? null,
      lastOutlookChangeKey: event.etag,
      lastSyncedAt: Date.now(),
      isDeleted: false,
    });
    logger.info("Created Google event from Outlook", { userId, outlookEventId: event.id, googleEventId: created.id });
  } else {
    // UPDATE in Google
    const updated = await updateGoogleEvent(googleToken, mapping.googleEventId, googleBody);
    await updateMappingVersions(userId, mapping.googleEventId, {
      lastGoogleEtag: updated.etag ?? null,
      lastOutlookChangeKey: event.etag,
      lastSyncedAt: Date.now(),
    });
    logger.info("Updated Google event from Outlook", { userId, outlookEventId: event.id });
  }
}

// ─── Payload Builders ─────────────────────────────────────────────

function buildOutlookPayload(event: NormalizedEvent) {
  return {
    subject: event.title,
    body: event.description ? { contentType: "Text" as const, content: event.description } : undefined,
    location: event.location ? { displayName: event.location } : undefined,
    start: { dateTime: utcToOutlookNaive(event.startUTC), timeZone: "UTC" },
    end: { dateTime: utcToOutlookNaive(event.endUTC), timeZone: "UTC" },
    isAllDay: event.isAllDay || undefined,
    attendees: event.attendees.length > 0
      ? event.attendees.map(e => ({ emailAddress: { address: e }, type: "required" as const }))
      : undefined,
  };
}

function buildGooglePayload(event: NormalizedEvent) {
  return {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    start: event.isAllDay
      ? { date: event.startUTC.substring(0, 10) }
      : { dateTime: utcToGoogleDateTime(event.startUTC) },
    end: event.isAllDay
      ? { date: event.endUTC.substring(0, 10) }
      : { dateTime: utcToGoogleDateTime(event.endUTC) },
    attendees: event.attendees.length > 0
      ? event.attendees.map(e => ({ email: e }))
      : undefined,
  };
}
