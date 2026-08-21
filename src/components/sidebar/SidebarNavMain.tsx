"use client";

import { MdGavel, MdHelpCenter } from "react-icons/md";
import SidebarGroupApplications from "./SidebarGroupApplications";
import SidebarGroupDefault from "./SidebarGroupDefault";
import SidebarNavItem from "./SidebarNavItem";

// The top-level navigation links + pinned footer, shared between the desktop
// sidebar and the mobile drawer. `onNavigate` lets the drawer close itself on
// link click.
export default function SidebarNavMain({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  return (
    <>
      <nav className="flex-1 overflow-auto px-3 py-4">
        <SidebarGroupDefault onNavigate={onNavigate} />
        <SidebarGroupApplications onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-gray-100 px-3 py-4">
        <ul>
          {/* <SidebarNavItem
            name="Settings"
            icon={MdSettings}
            href="/settings"
            onNavigate={onNavigate}
          /> */}
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
