import { MdDashboard } from "react-icons/md";
import SidebarNavGroup from "./SidebarNavGroup";
import SidebarNavItem from "./SidebarNavItem";

// The default (top-level) navigation shown in the primary sidebar on every
// route. Add new PQC sections here as SidebarNavItem entries, grouped under a
// SidebarNavGroup — the same way the cloud platform groups Compute / Explore.
export default function SidebarGroupDefault({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  return (
    <>
      <SidebarNavGroup label="Platform">
        <SidebarNavItem
          name="Dashboard"
          href="/"
          icon={MdDashboard}
          onNavigate={onNavigate}
        />
      </SidebarNavGroup>
    </>
  );
}
