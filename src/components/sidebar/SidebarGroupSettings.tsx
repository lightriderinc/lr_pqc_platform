import { handleSignIn } from "@/app/actions/auth";
import { MdAccountCircle } from "react-icons/md";
import SidebarNavGroup from "./SidebarNavGroup";
import SidebarNavItem from "./SidebarNavItem";

// Secondary-sidebar navigation for /settings routes (also reused inside the
// header's account dropdown and the mobile drawer).
export default function SidebarGroupSettings({
  onNavigate,
  isAuthenticated,
}: {
  onNavigate?: () => void;
  isAuthenticated: boolean;
}) {
  return (
    <SidebarNavGroup label="Settings">
      {isAuthenticated ? (
        <SidebarNavItem
          name="Account"
          href="/settings/account"
          icon={MdAccountCircle}
          onNavigate={onNavigate}
        />
      ) : (
        <p className="mt-3 text-sm text-gray-600 px-2">
          <button
            type="button"
            onClick={() => handleSignIn()}
            className="brand-link cursor-pointer"
          >
            Log in
          </button>{" "}
          to access account settings.
        </p>
      )}
    </SidebarNavGroup>
  );
}
