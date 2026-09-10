"use client";

import { MdGavel, MdHelpCenter, MdSettings } from "react-icons/md";
import SidebarGroupDefault from "./SidebarGroupDefault";
import SidebarNavItem from "./SidebarNavItem";

// The top-level navigation links + pinned footer, shared between the desktop
// sidebar and the mobile drawer. `onNavigate` lets the drawer close itself on
// link click.
export default function SidebarNavMain({
  onNavigate,
  isAuthenticated = false,
}: {
  onNavigate?: () => void;
  isAuthenticated?: boolean;
}) {
  return (
    <>
      <nav className="flex-1 overflow-auto px-3 py-4">
        <SidebarGroupDefault onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-gray-100 px-3 py-4">
        <ul>
          {/* Links straight to the account page rather than /settings: unlike
              the cloud platform there is no /settings -> /settings/account
              redirect here, and the secondary sidebar that lists the settings
              sub-nav only appears once you are already on a /settings route. */}
          {isAuthenticated && (
            <SidebarNavItem
              name="Settings & Account"
              icon={MdSettings}
              href="/settings/account"
              onNavigate={onNavigate}
            />
          )}
          <SidebarNavItem
            name="Contact"
            icon={MdHelpCenter}
            href="https://www.lightriderinc.com/contact"
            external
            onNavigate={onNavigate}
          />
          <SidebarNavItem
            name="Legal"
            icon={MdGavel}
            href="/legal"
            onNavigate={onNavigate}
          />
        </ul>
      </div>
    </>
  );
}
