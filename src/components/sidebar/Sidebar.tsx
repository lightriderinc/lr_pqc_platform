// Primary sidebar rail for the PQC platform shell. Intentionally empty for
// now — nav groups and items get added here as sections are built out. Matches
// the cloud platform's sidebar dimensions and borders (w-56, right border,
// hidden below the lg breakpoint) so the shell lines up across platforms.
export default function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-gray-100 lg:flex">
      <nav className="flex-1 overflow-auto px-3 py-4" />
    </aside>
  );
}
