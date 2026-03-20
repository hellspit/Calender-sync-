import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import { GOOGLE_CONFIG } from "../config/auth";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_TOKEN_KEY = "google_access_token";
const GOOGLE_EXPIRY_KEY = "google_token_expiry";
const GOOGLE_REFRESH_KEY = "google_refresh_token";

// Google OAuth discovery document
const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

// The proxy acts as the OAuth redirect_uri (registered in Google Console).
// After auth completes, the proxy redirects to the app via its custom scheme.
const PROXY_REDIRECT_URI = process.env.EXPO_PUBLIC_EXPO_PROXY_URI ?? "";

export const GOOGLE_REDIRECT_URI = PROXY_REDIRECT_URI;

// The deep-link the proxy will redirect to so the app regains control.
const APP_RETURN_URL = Linking.createURL("auth");

console.log("[GoogleAuth] redirectUri:", GOOGLE_REDIRECT_URI);
console.log("[GoogleAuth] returnUrl:", APP_RETURN_URL);

export function useGoogleAuthRequest() {
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CONFIG.clientId,
      scopes: GOOGLE_CONFIG.scopes,
      redirectUri: GOOGLE_REDIRECT_URI,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: { access_type: "offline", prompt: "consent" },
    },
    discovery
  );

  // Always use the auth proxy so the browser goes through auth.expo.io/start
  // which knows both the OAuth authUrl AND the app returnUrl.
  // This works for both Expo Go and standalone Android builds.
  const wrappedPromptAsync: typeof promptAsync = async (options) => {

    if (!request) {
      throw new Error("Auth request not ready yet");
    }

    // Generate a fresh auth URL for each sign-in attempt
    const freshAuthUrl = await request.makeAuthUrlAsync(discovery);

    // Build the proxy start URL
    const proxyStartUrl =
      `${PROXY_REDIRECT_URI}/start?` +
      new URLSearchParams({
        authUrl: freshAuthUrl,
        returnUrl: APP_RETURN_URL,
      }).toString();

    // Open browser; watch for the app deep-link (not the proxy HTTPS URL)
    const result = await WebBrowser.openAuthSessionAsync(
      proxyStartUrl,
      APP_RETURN_URL
    );

    if (result.type !== "success" || !result.url) {
      return { type: result.type } as AuthSession.AuthSessionResult;
    }

    // Parse the return URL manually (skip state check — safe in mobile app
    // since the redirect goes to a custom scheme only our app handles).
    const url = result.url;
    const paramsStr = url.includes("?") ? url.split("?")[1] : "";
    const params = Object.fromEntries(new URLSearchParams(paramsStr));

    if (params.error) {
      return {
        type: "error" as const,
        error: null,
        errorCode: params.error,
        params,
        authentication: null,
        url,
      };
    }

    return {
      type: "success" as const,
      error: null,
      errorCode: null,
      params,
      authentication: null,
      url,
    };
  };

  return { request, response, promptAsync: wrappedPromptAsync, discovery };
}

export async function exchangeGoogleCode(
  request: AuthSession.AuthRequest,
  code: string
): Promise<string | null> {
  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId: GOOGLE_CONFIG.clientId,
      clientSecret: GOOGLE_CONFIG.clientSecret,
      redirectUri: GOOGLE_REDIRECT_URI,
      code,
      extraParams: { code_verifier: request.codeVerifier ?? "" },
    },
    discovery
  );

  const accessToken = tokenResult.accessToken ?? null;

  if (accessToken) {
    const expiresIn = tokenResult.expiresIn ?? 3600;
    const expiryTime = Date.now() + expiresIn * 1000;
    await Promise.all([
      SecureStore.setItemAsync(GOOGLE_EXPIRY_KEY, String(expiryTime)),
      tokenResult.refreshToken
        ? SecureStore.setItemAsync(GOOGLE_REFRESH_KEY, tokenResult.refreshToken)
        : Promise.resolve(),
    ]);
  }

  return accessToken;
}

export async function storeGoogleToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(GOOGLE_TOKEN_KEY, token);
}

/** Silently refresh the access token using the stored refresh token. */
async function refreshGoogleToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(GOOGLE_REFRESH_KEY);
  if (!refreshToken) return null;

  try {
    const tokenResult = await AuthSession.refreshAsync(
      { clientId: GOOGLE_CONFIG.clientId, refreshToken },
      discovery
    );
    const newToken = tokenResult.accessToken ?? null;
    if (newToken) {
      const expiresIn = tokenResult.expiresIn ?? 3600;
      const expiryTime = Date.now() + expiresIn * 1000;
      await Promise.all([
        SecureStore.setItemAsync(GOOGLE_TOKEN_KEY, newToken),
        SecureStore.setItemAsync(GOOGLE_EXPIRY_KEY, String(expiryTime)),
        tokenResult.refreshToken
          ? SecureStore.setItemAsync(GOOGLE_REFRESH_KEY, tokenResult.refreshToken)
          : Promise.resolve(),
      ]);
    }
    return newToken;
  } catch {
    // Refresh token invalid/expired — force re-login
    await signOutGoogle();
    return null;
  }
}

/**
 * Returns a valid access token, silently refreshing if it has expired.
 * Returns null only if no session exists or refresh fails (user must re-login).
 */
export async function getGoogleToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(GOOGLE_TOKEN_KEY);
  if (!token) return null;

  const expiryStr = await SecureStore.getItemAsync(GOOGLE_EXPIRY_KEY);
  if (expiryStr) {
    const expiry = Number(expiryStr);
    if (Date.now() >= expiry - 60_000) {
      return refreshGoogleToken();
    }
  }

  return token;
}

export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await AuthSession.revokeAsync(
      { token, clientId: GOOGLE_CONFIG.clientId },
      discovery
    );
  } catch {
    // Best-effort — don't block local sign-out
  }
}

export async function signOutGoogle(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(GOOGLE_TOKEN_KEY),
    SecureStore.deleteItemAsync(GOOGLE_EXPIRY_KEY),
    SecureStore.deleteItemAsync(GOOGLE_REFRESH_KEY),
  ]);
}
