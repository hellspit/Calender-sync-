/**
 * auth/microsoftTokens.ts — Server-side Microsoft OAuth token refresh.
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
 * Refresh a Microsoft access token using a stored refresh token.
 *
 * @param refreshToken — The long-lived refresh token from OAuth consent
 * @returns Fresh access token + expiry, or null if refresh token is revoked
 */
export async function refreshMicrosoftAccessToken(
  refreshToken: string
): Promise<TokenResponse | null> {
  try {
    const response = await axios.post(
      config.microsoft.tokenEndpoint,
      new URLSearchParams({
        client_id: config.microsoft.clientId,
        client_secret: config.microsoft.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: config.microsoft.scopes.join(" "),
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const data = response.data;
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? 3600,
      // Microsoft always returns a new refresh token
      newRefreshToken: data.refresh_token ?? undefined,
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const errBody = err?.response?.data;

    // AADSTS700082 / AADSTS50173 = refresh token expired/revoked
    const errorCode = errBody?.error ?? "";
    const errorDesc = errBody?.error_description ?? "";

    if (
      status === 400 &&
      (errorCode === "invalid_grant" ||
        errorDesc.includes("AADSTS700082") ||
        errorDesc.includes("AADSTS50173"))
    ) {
      logger.error("Microsoft refresh token is revoked or expired", {
        error: errorDesc,
      });
      return null;
    }

    logger.error("Failed to refresh Microsoft token", {
      status,
      error: errorCode,
      description: errorDesc,
    });
    throw err;
  }
}
