import { MdVerifiedUser, MdTravelExplore } from "react-icons/md";
import SidebarNavGroup from "./SidebarNavGroup";
import SidebarNavItem from "./SidebarNavItem";

// Primary sidebar navigation. Veloce IS the platform, so there's a single
// section holding the dashboard and qSearch — no separate "Platform" group.
// The dashboard keeps the original security icon; only its label was renamed.
export default function SidebarGroupDefault({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  return (
    <SidebarNavGroup label="Veloce">
      <SidebarNavItem
        name="Dashboard"
        href="/security"
        icon={MdVerifiedUser}
        onNavigate={onNavigate}
      />
      <SidebarNavItem
        name="qSearch"
        href="/qsearch"
        icon={MdTravelExplore}
        onNavigate={onNavigate}
      />
    </SidebarNavGroup>
  );
}
