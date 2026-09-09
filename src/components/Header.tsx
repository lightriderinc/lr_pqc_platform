import Image from "next/image";
import Link from "next/link";
import { handleSignIn, handleSignOut } from "@/app/actions/auth";
import SignIn from "@/app/sign-in";
import SignOut from "@/app/sign-out";
import { getSession } from "@/lib/auth/session";
import AccountBadge from "./AccountBadge";
import MobileMenu from "./MobileMenu";

// Top bar for the PQC platform shell — same structure and dimensions as the
// cloud platform's Header. The logo is the PQC lockup: the mark + "LIGHT RIDER"
// wordmark are the exact vector paths from Lightrider-cloud-logo-black.svg, with
// "PQC" set in place of "CLOUD" (Science Gothic, condensed, #EF3B39) at the same
// cap height and position, so both platforms render identically.
export default async function Header() {
  const { isAuthenticated, claims, userInfo } = await getSession();

  const name = userInfo?.name ?? claims?.name ?? undefined;
  const email = userInfo?.email ?? claims?.email ?? undefined;

  const authControls = isAuthenticated ? (
    <>
      <AccountBadge name={name ?? email ?? "Account"} email={email} />
      <SignOut onSignOut={handleSignOut} />
    </>
  ) : (
    <SignIn onSignIn={handleSignIn} />
  );

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4">
      <div className="flex items-center gap-2">
        <Link href="/">
          <Image
            src="/Lightrider-pqc-logo-black.svg"
            alt="Lightrider logo"
            width={218}
            height={32}
          />
        </Link>
      </div>

      <div className="flex items-center gap-2 mr-2">
        {/* Desktop: account badge + auth button. Mobile: hamburger drawer,
            with the same controls pinned to its bottom. */}
        <div className="hidden items-center gap-2 lg:flex">{authControls}</div>
        <MobileMenu>
          <div className="flex flex-col gap-2">{authControls}</div>
        </MobileMenu>
      </div>
    </header>
  );
}
