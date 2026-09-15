"use server";

import { logtoConfig } from "@/app/logto";
import { sanitizeReturnTo } from "@/lib/auth/silent-sso";
import { signIn, signOut } from "@logto/next/server-actions";

/**
 * `returnTo` brings the user back to the page they signed in from — used where
 * sign-in is offered mid-task, so they don't land on the dashboard and have to
 * navigate back. Omitted (the header button) it resolves to "/", matching the
 * callback's own default. Passed through `sanitizeReturnTo` because it reaches
 * here from the client: only a same-origin absolute path is ever honoured.
 */
export async function handleSignIn(returnTo?: string) {
  await signIn(logtoConfig, {
    // Both are required once options are passed as an object: the SDK uses the
    // object verbatim rather than filling in the default callback URI.
    redirectUri: `${logtoConfig.baseUrl}/callback`,
    postRedirectUri: `${logtoConfig.baseUrl}${sanitizeReturnTo(returnTo)}`,
  });
}

export async function handleSignOut() {
  await signOut(logtoConfig);
}
