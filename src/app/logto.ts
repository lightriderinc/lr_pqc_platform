// Logto configuration for this app. Env var names are shared across every
// Light Rider platform — see docs/adding-a-new-platform.md in the cloud
// platform repo for the canonical list. NEXT_BASE_URL (not LOGTO_BASE_URL) is
// the one name for this app's own origin; every redirect URI is built from it.
export const logtoConfig = {
  managementEndpoint: process.env.LOGTO_MANAGEMENT_ENDPOINT as string, // M2M-only; not needed by apps without Management API access
  endpoint: process.env.LOGTO_ENDPOINT as string,
  appId: process.env.LOGTO_APP_ID as string,
  appSecret: process.env.LOGTO_APP_SECRET as string,
  // Fallback matches this app's pinned dev port (see package.json "dev").
  // A wrong fallback here silently produces a redirect_uri Logto will reject.
  baseUrl: process.env.NEXT_BASE_URL || 'http://localhost:3000',
  cookieSecret: process.env.LOGTO_COOKIE_SECRET as string,
  cookieSecure: process.env.NODE_ENV === 'production',
  // `identities` is required for the Account API to report hasPassword /
  // linked social identities; `roles` is unused today but kept aligned with
  // the other Light Rider platforms.
  scopes: ['email', 'profile', 'roles', 'identities'],
};
