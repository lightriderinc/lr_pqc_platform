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
  cardStyle = "p-4 sm:p-6 bg-gray-50",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  cardStyle?: string;
}) {
  return (
    <section className={`flex h-full min-w-0 flex-col ${className}`}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-600">{title}</h2>
        {action}
      </div>
      <div
        className={`default-radius min-w-0 flex-1 ${cardStyle} ${bodyClassName}`}
      >
        {children}
      </div>
    </section>
  );
}
