import type { ReactNode } from "react";

// Panel / section header: an uppercase brand "eyebrow", a title, and an
// optional right-hand slot for actions or a status badge. Used at the top of
// every Card so headings line up consistently.
export default function SectionHeading({
  eyebrow,
  title,
  description,
  right,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 ${className}`}
    >
      <div>
        {eyebrow && (
          <p className="color-brand-primary font-mono text-2xs font-bold uppercase tracking-[0.2em]">
            {eyebrow}
          </p>
        )}
        <h3 className="mt-1 text-lg font-medium">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
