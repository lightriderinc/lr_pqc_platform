"use client";

import { usePathname } from "next/navigation";
import SidebarGroupLegal from "./SidebarGroupLegal";
import SidebarGroupSettings from "./SidebarGroupSettings";

// Contents of the secondary sidebar. Picks the nav group that matches the
// current route section. Add a branch here (and the route prefix to
// SidebarSecondaryGate) to give another section its own secondary sidebar.
export default function SidebarNav({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const isLegalRoute = pathname?.startsWith("/legal");
  const isSettingsRoute = pathname?.startsWith("/settings");

  return (
    <>
      <nav className="flex-1 overflow-auto px-3 py-4">
        {isLegalRoute ? (
          <SidebarGroupLegal onNavigate={onNavigate} />
        ) : isSettingsRoute ? (
          <SidebarGroupSettings onNavigate={onNavigate} />
        ) : (
          <></>
        )}
      </nav>
    </>
  );
}
