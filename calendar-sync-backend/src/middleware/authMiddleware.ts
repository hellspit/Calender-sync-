/**
 * middleware/authMiddleware.ts — HMAC-SHA256 request authentication.
 *
 * Signs: raw_body + "." + timestamp
 * Verifies: X-Signature header with timing-safe comparison
 * Rejects: if timestamp is >5 min off (replay attack prevention)
 */

import { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { config } from "../config";

/**
 * Express middleware that verifies HMAC-SHA256 signed requests.
 * Expects headers: X-Signature, X-Timestamp
 */
export function hmacAuth(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers["x-signature"] as string | undefined;
  const timestampStr = req.headers["x-timestamp"] as string | undefined;

  if (!signature || !timestampStr) {
    res.status(401).json({ error: "Missing authentication headers" });
    return;
  }

  // Check timestamp freshness (±5 min)
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || Math.abs(Date.now() - timestamp) > config.auth.timestampToleranceMs) {
    res.status(401).json({ error: "Request timestamp expired" });
    return;
  }

  // Compute expected signature from raw body
  const rawBody = (req as any).rawBody as string | undefined;
  if (rawBody === undefined) {
    res.status(500).json({ error: "Raw body not captured — server misconfiguration" });
    return;
  }

  const message = rawBody + "." + timestampStr;
  const expected = createHmac("sha256", config.auth.secretKey)
    .update(message)
    .digest("hex");

  // Timing-safe comparison
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  next();
}
