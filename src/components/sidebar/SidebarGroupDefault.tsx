import { IoDocumentTextSharp } from "react-icons/io5";
import { MdTravelExplore } from "react-icons/md";
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
    <>
      <SidebarNavGroup label="Veloce">
        {/* <SidebarNavItem
        name="Dashboard"
        href="/"
        icon={MdVerifiedUser}
        onNavigate={onNavigate}
      /> */}
        <SidebarNavItem
          name="qSearch"
          href="/qsearch"
          icon={MdTravelExplore}
          onNavigate={onNavigate}
        />
      </SidebarNavGroup>

      <SidebarNavGroup label="Resources">
        <SidebarNavItem
          name="Documentation"
          external
          href="https://docs.lightriderinc.com/pqc/introduction.html"
          icon={IoDocumentTextSharp}
          onNavigate={onNavigate}
        />
      </SidebarNavGroup>
    </>
  );
}
