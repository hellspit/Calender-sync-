import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import {
  useGoogleAuthRequest,
  exchangeGoogleCode,
  storeGoogleToken,
  getGoogleToken,
  signOutGoogle,
  revokeGoogleToken,
} from "./googleAuth";
import {
  useMicrosoftAuthRequest,
  exchangeMicrosoftCode,
  storeMicrosoftToken,
  getMicrosoftToken,
  signOutMicrosoft,
} from "./microsoftAuth";

// ─── Types ────────────────────────────────────────────────────────
interface AuthState {
  googleToken: string | null;
  microsoftToken: string | null;
  isGoogleConnected: boolean;
  isMicrosoftConnected: boolean;
  isLoading: boolean;
  authError: string | null;
  /** Always returns a fresh, non-expired token (silently refreshes if needed). */
  getValidGoogleToken: () => Promise<string | null>;
  /** Always returns a fresh, non-expired token (silently refreshes if needed). */
  getValidMicrosoftToken: () => Promise<string | null>;
  loginGoogle: () => Promise<void>;
  loginMicrosoft: () => Promise<void>;
  logoutGoogle: () => Promise<void>;
  logoutMicrosoft: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [microsoftToken, setMicrosoftToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Keep refs so the getValid* callbacks always see the latest setters without
  // being recreated on every render.
  const setGoogleTokenRef = useRef(setGoogleToken);
  const setMicrosoftTokenRef = useRef(setMicrosoftToken);
  useEffect(() => { setGoogleTokenRef.current = setGoogleToken; }, []);
  useEffect(() => { setMicrosoftTokenRef.current = setMicrosoftToken; }, []);

  const {
    request: googleRequest,
    promptAsync: googlePrompt,
  } = useGoogleAuthRequest();

  const {
    request: msRequest,
    promptAsync: msPrompt,
  } = useMicrosoftAuthRequest();

  // ── Load persisted tokens on mount ──
  useEffect(() => {
    (async () => {
      try {
        const [gToken, mToken] = await Promise.all([
          getGoogleToken(),
          getMicrosoftToken(),
        ]);
        setGoogleToken(gToken);
        setMicrosoftToken(mToken);
      } catch {
        setGoogleToken(null);
        setMicrosoftToken(null);
        setAuthError("Failed to restore previous session. Please log in again.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── Helper: process an auth response (works for both hook-based and proxy-wrapped) ──
  const handleAuthResponse = useCallback(
    async (
      provider: "google" | "microsoft",
      response: any,
      request: any
    ) => {
      if (!response || !request) return;

      if (response.type === "success") {
        const code = response.params?.code;
        if (!code) {
          setAuthError(`${provider} sign-in failed: no authorization code received.`);
          return;
        }
        try {
          let token: string | null;
          if (provider === "google") {
            token = await exchangeGoogleCode(request, code);
            if (token) {
              await storeGoogleToken(token);
              setGoogleToken(token);
            } else {
              setAuthError("Google sign-in failed: could not obtain access token.");
            }
          } else {
            token = await exchangeMicrosoftCode(request, code);
            if (token) {
              await storeMicrosoftToken(token);
              setMicrosoftToken(token);
            } else {
              setAuthError("Microsoft sign-in failed: could not obtain access token.");
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setAuthError(`${provider} sign-in error: ${msg}`);
          if (provider === "google") setGoogleToken(null);
          else setMicrosoftToken(null);
        }
      } else if (response.type === "error") {
        const desc = response.error?.message ?? "unknown error";
        setAuthError(`${provider} sign-in failed: ${desc}`);
      }
      // type === "cancel" or "dismiss" — silently ignore
    },
    []
  );

  // ── Valid-token getters (always fresh) ────────────────────────────
  const getValidGoogleToken = useCallback(async (): Promise<string | null> => {
    const fresh = await getGoogleToken();
    setGoogleTokenRef.current(fresh);
    return fresh;
  }, []);

  const getValidMicrosoftToken = useCallback(async (): Promise<string | null> => {
    const fresh = await getMicrosoftToken();
    setMicrosoftTokenRef.current(fresh);
    return fresh;
  }, []);

  // ── Login ─────────────────────────────────────────────────────────
  // promptAsync now returns the result directly (wrapped for Expo Go).
  // We handle the response inline instead of via useEffect on response state.
  const loginGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const result = await googlePrompt();
      await handleAuthResponse("google", result, googleRequest);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthError(`Google sign-in error: ${msg}`);
    }
  }, [googlePrompt, googleRequest, handleAuthResponse]);

  const loginMicrosoft = useCallback(async () => {
    setAuthError(null);
    try {
      const result = await msPrompt();
      await handleAuthResponse("microsoft", result, msRequest);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthError(`Microsoft sign-in error: ${msg}`);
    }
  }, [msPrompt, msRequest, handleAuthResponse]);

  // ── Logout ────────────────────────────────────────────────────────
  const logoutGoogle = useCallback(async () => {
    if (googleToken) await revokeGoogleToken(googleToken);
    await signOutGoogle();
    setGoogleToken(null);
  }, [googleToken]);

  const logoutMicrosoft = useCallback(async () => {
    await signOutMicrosoft();
    setMicrosoftToken(null);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider
      value={{
        googleToken,
        microsoftToken,
        isGoogleConnected: !!googleToken,
        isMicrosoftConnected: !!microsoftToken,
        isLoading,
        authError,
        getValidGoogleToken,
        getValidMicrosoftToken,
        loginGoogle,
        loginMicrosoft,
        logoutGoogle,
        logoutMicrosoft,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
