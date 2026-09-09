import Image from "next/image";
import Link from "next/link";
import { handleSignIn, handleSignOut } from "@/app/actions/auth";
import SignIn from "@/app/sign-in";
import SignOut from "@/app/sign-out";
import { getSession } from "@/lib/auth/session";
import MobileMenu from "./MobileMenu";

// Top bar for the PQC platform shell — same structure and dimensions as the
// cloud platform's Header. The logo is the PQC lockup: the mark + "LIGHT RIDER"
// wordmark are the exact vector paths from Lightrider-cloud-logo-black.svg, with
// "PQC" set in place of "CLOUD" (Science Gothic, condensed, #EF3B39) at the same
// cap height and position, so both platforms render identically.
export default async function Header() {
  const { isAuthenticated } = await getSession();

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
        {isAuthenticated ? (
          <SignOut onSignOut={handleSignOut} />
        ) : (
          <SignIn onSignIn={handleSignIn} />
        )}
        {/* Below lg the sidebars are hidden, so the nav moves into this drawer. */}
        <MobileMenu />
      </div>
    </header>
  );
}
