"use server";

import { logtoConfig } from "@/app/logto";
import { sanitizeReturnTo } from "@/lib/auth/silent-sso";
import { signIn, signOut } from "@logto/next/server-actions";
import { headers } from "next/headers";

/**
 * `returnTo` brings the user back to the page they signed in from — used where
 * sign-in is offered mid-task, so they don't land on the dashboard and have to
 * navigate back. Omitted (the header button, SignInRequired) it falls back to
 * the page the "Log in" click was made on: a Server Action is a POST from that
 * page, so its Referer is the page URL, and only the path is kept. Either way
 * it passes through `sanitizeReturnTo`, because it reaches here from the
 * client: only a same-origin absolute path is ever honoured (anything odd -> "/").
 */
export async function handleSignIn(returnTo?: string) {
  await signIn(logtoConfig, {
    // Both are required once options are passed as an object: the SDK uses the
    // object verbatim rather than filling in the default callback URI.
    redirectUri: `${logtoConfig.baseUrl}/callback`,
    postRedirectUri: `${logtoConfig.baseUrl}${sanitizeReturnTo(returnTo ?? (await refererPath()))}`,
  });
}

export async function handleSignOut() {
  await signOut(logtoConfig);
}

/** Path and query of the page this action was posted from, or null. */
async function refererPath(): Promise<string | null> {
  try {
    const referer = new URL((await headers()).get("referer") ?? "");
    return `${referer.pathname}${referer.search}`;
  } catch {
    return null; // No or malformed Referer.
  }
}
