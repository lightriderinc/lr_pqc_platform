"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MdClose, MdMenu } from "react-icons/md";
import SidebarGroupLegal from "./sidebar/SidebarGroupLegal";
import SidebarGroupSettings from "./sidebar/SidebarGroupSettings";
import SidebarNavMain from "./sidebar/SidebarNavMain";

// Below the lg breakpoint the sidebars are hidden, so the header shows a
// hamburger that opens this drawer (slide-in panel + backdrop fade). It holds
// the same nav as the sidebars: the section's sub-nav on top (mirroring the
// secondary sidebar) followed by the main nav. `children` is an optional slot
// pinned to the bottom for account controls once auth exists.
export default function MobileMenu({
  children,
}: {
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const pathname = usePathname();

  const isLegalRoute = pathname?.startsWith("/legal");
  const isSettingsRoute = pathname?.startsWith("/settings");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center default-radius transition-colors hover:bg-gray-100"
      >
        <MdMenu className="text-2xl text-gray-700" />
      </button>

      {/* Always mounted so the panel can slide in and out. */}
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-50 flex justify-end transition-colors duration-300 motion-reduce:transition-none ${
          open ? "bg-black/40" : "pointer-events-none bg-transparent"
        }`}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          onClick={(event) => event.stopPropagation()}
          className={`flex h-full w-72 max-w-[85%] flex-col bg-white shadow-xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4">
            <span className="text-sm font-semibold">Menu</span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center default-radius transition-colors hover:bg-gray-100"
            >
              <MdClose className="text-2xl text-gray-700" />
            </button>
          </div>

          {isLegalRoute ? (
            <div className="border-b border-gray-100 px-3 py-4">
              <SidebarGroupLegal onNavigate={() => setOpen(false)} />
            </div>
          ) : isSettingsRoute ? (
            <div className="border-b border-gray-100 px-3 py-4">
              <SidebarGroupSettings onNavigate={() => setOpen(false)} />
            </div>
          ) : (
            <></>
          )}

          <SidebarNavMain onNavigate={() => setOpen(false)} />

          {children && (
            <div className="border-t border-gray-100 p-3">{children}</div>
          )}
        </div>
      </div>
    </div>
  );
}
