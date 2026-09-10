import { logtoConfig } from "@/app/logto";
import { getMyProfile } from "@/lib/logto-account";
import { getAccessToken, getLogtoContext, type LogtoContext } from "@logto/next/server-actions";
import { cache } from "react";

/**
 * Cached per-request Logto session lookup. Every Server Component that needs
 * session data during a render shares this one call instead of each calling
 * `getLogtoContext` independently — Server Components can't persist a
 * refreshed token back to the cookie, so two independent calls in the same
 * render could otherwise race to refresh with an already-consumed refresh
 * token and throw `invalid_grant`.
 *
 * Falls back to signed-out on failure rather than throwing, so a Logto
 * hiccup degrades to a login prompt instead of crashing the whole layout.
 */
export const getSession = cache(async (): Promise<LogtoContext> => {
  try {
    return await getLogtoContext(logtoConfig, { fetchUserInfo: true });
  } catch (err) {
    // Never swallowed silently — an unlogged failure here presents as "signed
    // out" with no other symptom and is very expensive to diagnose.
    //
    // But a rejected token is the *expected* steady state after the session
    // ended elsewhere: every render until the silent check replaces or clears
    // the cookie will land here. That is a warning, not an error, so it does
    // not spam the dev error overlay with a condition we already handle.
    if (isStaleTokenError(err)) {
      console.warn("[auth] stored token rejected by Logto; treating as signed out.");
    } else {
      console.error("[auth] session lookup failed; treating as signed out:", err);
    }
    return { isAuthenticated: false };
  }
});

/**
 * Whether an error from Logto means "this token is no longer good" (revoked,
 * expired, or belonging to an ended session) as opposed to a real fault like
 * Logto being unreachable. Both still read as signed out; they differ only in
 * how loudly they deserve to be reported.
 */
function isStaleTokenError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    /invalid[_ ]token/i.test(message) ||
    /status=401/i.test(message) ||
    /invalid[_ ]grant/i.test(message)
  );
}

/**
 * Resolves the current Logto session server-side. Throws if unauthenticated
 * so route handlers can fail fast with a 401 rather than silently acting on
 * behalf of no one.
 */
export async function requireLogtoUser() {
  const { isAuthenticated, claims } = await getLogtoContext(logtoConfig);
  if (!isAuthenticated || !claims?.sub) {
    throw new Error("UNAUTHENTICATED");
  }
  return { sub: claims.sub, email: claims.email as string | undefined };
}

/**
 * Cached per-request fetch of the Logto Account API profile. Returns null when
 * the token or Account API is unavailable, so callers treat it as best-effort.
 */
export const getAccountProfile = cache(async () => {
  try {
    const token = await getAccessToken(logtoConfig);
    if (!token) return null;
    return await getMyProfile(token);
  } catch {
    return null;
  }
});

/**
 * Resolves the user's display name.
 *
 * A brand-new user's ID-token / userinfo claims don't include `name` until
 * their first token refresh, so when the session claims lag we fall back to
 * the Account API, which reflects the name immediately: top-level `name`,
 * then given/family name, then username. Returns null only when no name is
 * set anywhere (callers pick their own final fallback).
 */
export const getDisplayName = cache(async (): Promise<string | null> => {
  const { isAuthenticated, claims, userInfo } = await getSession();
  if (!isAuthenticated) return null;

  const fromSession = userInfo?.name ?? claims?.name;
  if (fromSession) return fromSession;

  const account = await getAccountProfile();
  if (!account) return null;

  if (account.name) return account.name;

  const fullName = [account.profile?.givenName, account.profile?.familyName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName) return fullName;

  return account.username ?? null;
});
