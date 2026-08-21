import { MdApps } from "react-icons/md";
import SidebarNavGroup from "./SidebarNavGroup";
import SidebarNavItem from "./SidebarNavItem";

// Applications category — real-world PQC demos (Quantum Vault, Quantum-Safe
// Signer) surfaced from the Applications page. Kept as its own sidebar group
// so more apps can be added here without crowding the Veloce section.
export default function SidebarGroupApplications({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  return (
    <SidebarNavGroup label="Applications">
      <SidebarNavItem
        name="Applications"
        href="/applications"
        icon={MdApps}
        onNavigate={onNavigate}
      />
    </SidebarNavGroup>
  );
}
