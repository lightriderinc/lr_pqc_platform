import Image from "next/image";
import Link from "next/link";

// Top bar for the PQC platform shell — same structure and dimensions as the
// cloud platform's Header. The logo is the PQC lockup: the mark + "LIGHT RIDER"
// wordmark are the exact vector paths from Lightrider-cloud-logo-black.svg, with
// "PQC" set in place of "CLOUD" (Science Gothic, condensed extra-bold, #EF3B39)
// at the same cap height and position, so both platforms render identically.
export default function Header() {
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
    </header>
  );
}
