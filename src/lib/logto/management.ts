import { logtoConfig } from "@/app/logto";
import type { SocialIdentity } from "@/lib/logto-account";

// Server-only. Machine-to-machine client for the Logto Management API, used
// by the account page to read facts the end-user Account API doesn't reliably
// expose (linked social identities, authoritative password status). Never
// import from a client component — LOGTO_M2M_APP_SECRET must stay server-side.

const TOKEN_EXPIRY_BUFFER_MS = 60_000;

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function endpointBase(): string {
  // The Management API can't be reached through a custom sign-in domain —
  // Logto requires the tenant's default *.logto.app domain for both the
  // token request and Management API calls.
  return logtoConfig.managementEndpoint.replace(/\/$/, "");
}

/**
 * Whether M2M access is configured at all. Callers use this to skip the
 * Management API entirely rather than firing a request that cannot succeed.
 *
 * Guards against a placeholder value as well as an absent one: an env file
 * carrying literal text like "[SENSITIVE]" produces `fetch("[SENSITIVE]/oidc/token")`,
 * whose "Failed to parse URL" throw would otherwise surface on every
 * account-page render, despite the caller already falling back cleanly.
 */
export function isManagementApiConfigured(): boolean {
  const endpoint = logtoConfig.managementEndpoint;
  return (
    typeof endpoint === "string" &&
    /^https?:\/\//.test(endpoint) &&
    Boolean(process.env.LOGTO_M2M_APP_ID) &&
    Boolean(process.env.LOGTO_M2M_APP_SECRET)
  );
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > TOKEN_EXPIRY_BUFFER_MS) {
    return cachedToken.accessToken;
  }

  const appId = process.env.LOGTO_M2M_APP_ID;
  const appSecret = process.env.LOGTO_M2M_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      "LOGTO_M2M_APP_ID / LOGTO_M2M_APP_SECRET are not configured.",
    );
  }

  const endpoint = endpointBase();
  const basicAuth = Buffer.from(`${appId}:${appSecret}`).toString("base64");

  const res = await fetch(`${endpoint}/oidc/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      resource: `${endpoint}/api`,
      scope: "all",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // The endpoint is named in the error because the usual cause of a 400 here
    // is LOGTO_MANAGEMENT_ENDPOINT pointing at the sign-in custom domain rather
    // than the tenant's *.logto.app domain — which also makes `resource` wrong.
    throw new Error(
      `Failed to fetch Logto Management API token (${res.status}) from ${endpoint}/oidc/token (resource=${endpoint}/api): ${detail}`,
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.accessToken;
}

export type UserAccountFacts = {
  /** Linked social identities keyed by connector target (e.g. `google`). */
  identities: Record<string, SocialIdentity>;
  /** Whether the user has a password credential, or null if it couldn't be read. */
  hasPassword: boolean | null;
};

/**
 * Fetches a user's linked social identities and password status via the
 * Management API (`GET /api/users/{userId}`).
 *
 * Unlike the end-user Account API (`/api/my-account`), these fields are NOT
 * gated by the Logto Account Center `fields` configuration, so this is the
 * reliable source for showing connected accounts and deciding between
 * "Set password" and "Change password" on the account page. Server-only —
 * relies on the M2M credentials.
 */
export async function getUserAccountFacts(
  logtoUserId: string,
): Promise<UserAccountFacts> {
  const token = await getAccessToken();

  const res = await fetch(`${endpointBase()}/api/users/${logtoUserId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch Logto user ${logtoUserId} (${res.status}): ${detail}`,
    );
  }

  const user = (await res.json()) as {
    identities?: Record<string, SocialIdentity>;
    hasPassword?: boolean;
  };

  return {
    identities: user.identities ?? {},
    hasPassword: user.hasPassword ?? null,
  };
}

export type LogtoUserSummary = {
  id: string;
  primaryEmail: string | null;
  username: string | null;
  name: string | null;
};

/**
 * Looks up a Logto user by exact primary email via the Management API. Returns
 * the matching user, or null when no account uses that email.
 *
 * Uses `mode.primaryEmail=exact`; matching is case-insensitive (Logto's
 * `isCaseSensitive` defaults to false), which is what we want since email
 * identifiers are compared case-insensitively. Primary emails are unique in
 * Logto, so there is at most one match.
 *
 * Docs: https://docs.logto.io/user-management/advanced-user-search
 */
export async function findUserByPrimaryEmail(
  email: string,
): Promise<LogtoUserSummary | null> {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    "search.primaryEmail": email,
    "mode.primaryEmail": "exact",
    page: "1",
    page_size: "1",
  });

  const res = await fetch(`${endpointBase()}/api/users?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Failed to search Logto users by email (${res.status}) at ${endpointBase()}: ${detail}`,
    );
  }

  const users = (await res.json()) as Array<{
    id: string;
    primaryEmail?: string | null;
    username?: string | null;
    name?: string | null;
  }>;

  const match = users[0];
  if (!match) {
    return null;
  }

  return {
    id: match.id,
    primaryEmail: match.primaryEmail ?? null,
    username: match.username ?? null,
    name: match.name ?? null,
  };
}
