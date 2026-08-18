import SidebarNav from "./SidebarNav";

// Secondary sidebar rail, shown beside the primary one on sections that have
// sub-navigation (see SidebarSecondaryGate for which routes those are).
export default function SidebarSecondary() {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-gray-100 lg:flex">
      <SidebarNav />
    </aside>
  );
}
