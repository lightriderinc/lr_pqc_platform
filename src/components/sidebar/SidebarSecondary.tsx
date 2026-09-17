import { getSession } from "@/lib/auth/session";
import SidebarNav from "./SidebarNav";

// Secondary sidebar rail, shown beside the primary one on sections that have
// sub-navigation (see SidebarSecondaryGate for which routes those are).
export default async function SidebarSecondary() {
  const { isAuthenticated } = await getSession();

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-gray-100 lg:flex">
      <SidebarNav isAuthenticated={isAuthenticated} />
    </aside>
  );
}
