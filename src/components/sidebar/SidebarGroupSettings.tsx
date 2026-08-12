import { MdAccountCircle } from "react-icons/md";
import SidebarNavGroup from "./SidebarNavGroup";
import SidebarNavItem from "./SidebarNavItem";

// Secondary-sidebar navigation for /settings routes. Placeholder for now: the
// cloud platform's settings nav is gated on Logto auth and Stripe billing,
// neither of which exists here yet. Add the API keys and usage/payment groups
// alongside this one once those are wired up.
export default function SidebarGroupSettings({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  return (
    <>
      <SidebarNavGroup label="Settings">
        <SidebarNavItem
          name="Account"
          href="/settings/account"
          icon={MdAccountCircle}
          onNavigate={onNavigate}
        />
      </SidebarNavGroup>
    </>
  );
}
