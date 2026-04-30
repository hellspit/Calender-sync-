/**
 * auth/googleTokens.ts — Server-side Google OAuth token refresh.
 *
 * Uses the refresh token stored in DynamoDB to silently obtain
 * fresh access tokens without user interaction.
 */

import axios from "axios";
import { config } from "../config";
import { logger } from "../utils/logger";

interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  newRefreshToken?: string;
}

/**
 * Refresh a Google access token using a stored refresh token.
 *
 * @param refreshToken — The long-lived refresh token from OAuth consent
 * @returns Fresh access token + expiry, or null if refresh token is revoked
 */
export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<TokenResponse | null> {
  try {
    const response = await axios.post(
      config.google.tokenEndpoint,
      new URLSearchParams({
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const data = response.data;
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? 3600,
      // Google may rotate the refresh token
      newRefreshToken: data.refresh_token ?? undefined,
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const errBody = err?.response?.data;

    // 400 with "invalid_grant" means the refresh token is revoked/expired
    if (status === 400 && errBody?.error === "invalid_grant") {
      logger.error("Google refresh token is revoked or expired", {
        error: errBody?.error_description,
      });
      return null;
    }

    logger.error("Failed to refresh Google token", {
      status,
      error: errBody?.error ?? err.message,
    });
    throw err;
  }
}
