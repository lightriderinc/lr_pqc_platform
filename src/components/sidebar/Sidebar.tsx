import SidebarNavMain from "./SidebarNavMain";

// Primary sidebar rail — visible on every route from the lg breakpoint up.
// Server component wrapper so the client-side nav (which reads the pathname)
// stays isolated in SidebarNavMain.
export default function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-gray-100 lg:flex">
      <SidebarNavMain />
    </aside>
  );
}
