"use client";

import { usePathname } from "next/navigation";

// Route prefixes that get a secondary sidebar. Keep in sync with the branches
// in SidebarNav.
const SECONDARY_SIDEBAR_ROUTES = ["/settings", "/legal"];

// Renders its children (the secondary sidebar) only on the routes listed above.
// Client component so the pathname check happens without making the whole
// layout dynamic.
export default function SidebarSecondaryGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const showSecondarySidebar = SECONDARY_SIDEBAR_ROUTES.some((route) =>
    pathname?.startsWith(route),
  );

  if (!showSecondarySidebar) return null;

  return <>{children}</>;
}
