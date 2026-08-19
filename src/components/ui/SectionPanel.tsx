import type { ReactNode } from "react";

// Section pattern ported from the cloud platform: a bold header OUTSIDE the
// box (e.g. "Compute credits", "Latest jobs"), with the content inside a gray
// shaded box. Optional `action` sits at the right of the header (a status
// label, link, etc.).
export default function SectionPanel({
  title,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-600">{title}</h2>
        {action}
      </div>
      <div
        className={`default-radius bg-gray-50 p-4 sm:p-6 ${bodyClassName}`}
      >
        {children}
      </div>
    </section>
  );
}
