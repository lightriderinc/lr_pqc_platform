// Logto Account API client, scoped to what this app's account page needs.
//
// A deliberately smaller subset of Cloud's equivalent (src/lib/logto-account.ts
// there): everything here runs on the END USER's own access token, so it needs
// no machine-to-machine credentials. Cloud's extra helpers that rely on the
// Management API (connected identities, authoritative password status, email
// uniqueness checks) are intentionally absent — this app has no M2M app
// registered, and half-wiring them would fail at runtime rather than at build.
//
// Docs: https://docs.logto.io/end-user-flows/account-settings/by-account-api

function accountApiBase(): string {
  // Computed per call, not at module load: a top-level read would throw the
  // moment this module is imported anywhere LOGTO_ENDPOINT is unset, which
  // takes down the whole build rather than just the requests that need it.
  return process.env.LOGTO_ENDPOINT!.replace(/\/$/, "");
}

export type MyAccount = {
  name?: string | null;
  username?: string | null;
  avatar?: string | null;
  profile?: { birthdate?: string; givenName?: string; familyName?: string };
};

/**
 * Fetches the current user's Logto account record.
 *
 * Unlike the OIDC ID-token claims (which lag for a brand-new user until their
 * first token refresh), this reflects the live account record immediately.
 * Returns null rather than throwing so callers can treat it as best-effort.
 */
export async function getMyProfile(accessToken: string): Promise<MyAccount | null> {
  const res = await fetch(`${accountApiBase()}/api/my-account`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json() as Promise<MyAccount>;
}
