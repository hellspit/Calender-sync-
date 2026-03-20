import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import { MICROSOFT_CONFIG } from "../config/auth";

WebBrowser.maybeCompleteAuthSession();

const MS_TOKEN_KEY = "microsoft_access_token";
const MS_EXPIRY_KEY = "microsoft_token_expiry";
const MS_REFRESH_KEY = "microsoft_refresh_token";

// Microsoft identity platform v2 discovery
const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `https://login.microsoftonline.com/${MICROSOFT_CONFIG.tenantId}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${MICROSOFT_CONFIG.tenantId}/oauth2/v2.0/token`,
};

// The proxy acts as the OAuth redirect_uri (registered in Azure Portal).
// After auth completes, the proxy redirects to the app via its custom scheme.
const PROXY_REDIRECT_URI = process.env.EXPO_PUBLIC_EXPO_PROXY_URI ?? "";

export const MS_REDIRECT_URI = PROXY_REDIRECT_URI;

// The deep-link the proxy will redirect to so the app regains control.
const APP_RETURN_URL = Linking.createURL("auth");

console.log("[MicrosoftAuth] redirectUri:", MS_REDIRECT_URI);
console.log("[MicrosoftAuth] returnUrl:", APP_RETURN_URL);

export function useMicrosoftAuthRequest() {
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: MICROSOFT_CONFIG.clientId,
      scopes: [...MICROSOFT_CONFIG.scopes, "offline_access"],
      redirectUri: MS_REDIRECT_URI,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery
  );

  // Always use the auth proxy so the browser goes through auth.expo.io/start.
  // This works for both Expo Go and standalone Android builds.
  const wrappedPromptAsync: typeof promptAsync = async (options) => {

    if (!request) {
      throw new Error("Auth request not ready yet");
    }

    // Generate a fresh auth URL for each sign-in attempt
    const freshAuthUrl = await request.makeAuthUrlAsync(discovery);

    const proxyStartUrl =
      `${PROXY_REDIRECT_URI}/start?` +
      new URLSearchParams({
        authUrl: freshAuthUrl,
        returnUrl: APP_RETURN_URL,
      }).toString();

    const result = await WebBrowser.openAuthSessionAsync(
      proxyStartUrl,
      APP_RETURN_URL
    );

    if (result.type !== "success" || !result.url) {
      return { type: result.type } as AuthSession.AuthSessionResult;
    }

    // Parse the return URL manually (skip state check — safe in mobile app)
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

export async function exchangeMicrosoftCode(
  request: AuthSession.AuthRequest,
  code: string
): Promise<string | null> {
  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId: MICROSOFT_CONFIG.clientId,
      clientSecret: MICROSOFT_CONFIG.clientSecret,
      redirectUri: MS_REDIRECT_URI,
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
      SecureStore.setItemAsync(MS_EXPIRY_KEY, String(expiryTime)),
      tokenResult.refreshToken
        ? SecureStore.setItemAsync(MS_REFRESH_KEY, tokenResult.refreshToken)
        : Promise.resolve(),
    ]);
  }

  return accessToken;
}

export async function storeMicrosoftToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(MS_TOKEN_KEY, token);
}

/** Silently refresh the Microsoft access token using the stored refresh token. */
async function refreshMicrosoftToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(MS_REFRESH_KEY);
  if (!refreshToken) return null;

  try {
    const tokenResult = await AuthSession.refreshAsync(
      { clientId: MICROSOFT_CONFIG.clientId, refreshToken },
      discovery
    );
    const newToken = tokenResult.accessToken ?? null;
    if (newToken) {
      const expiresIn = tokenResult.expiresIn ?? 3600;
      const expiryTime = Date.now() + expiresIn * 1000;
      await Promise.all([
        SecureStore.setItemAsync(MS_TOKEN_KEY, newToken),
        SecureStore.setItemAsync(MS_EXPIRY_KEY, String(expiryTime)),
        tokenResult.refreshToken
          ? SecureStore.setItemAsync(MS_REFRESH_KEY, tokenResult.refreshToken)
          : Promise.resolve(),
      ]);
    }
    return newToken;
  } catch {
    // Refresh token invalid — force re-login
    await signOutMicrosoft();
    return null;
  }
}

/**
 * Returns a valid access token, silently refreshing if it has expired.
 * Returns null only if no session exists or refresh fails (user must re-login).
 */
export async function getMicrosoftToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(MS_TOKEN_KEY);
  if (!token) return null;

  const expiryStr = await SecureStore.getItemAsync(MS_EXPIRY_KEY);
  if (expiryStr) {
    const expiry = Number(expiryStr);
    if (Date.now() >= expiry - 60_000) {
      return refreshMicrosoftToken();
    }
  }

  return token;
}

export async function signOutMicrosoft(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(MS_TOKEN_KEY),
    SecureStore.deleteItemAsync(MS_EXPIRY_KEY),
    SecureStore.deleteItemAsync(MS_REFRESH_KEY),
  ]);
}
