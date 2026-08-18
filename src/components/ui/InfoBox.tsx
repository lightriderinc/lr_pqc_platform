import { MdInfoOutline } from "react-icons/md";
import type { ReactNode } from "react";

// Informational callout. Ported from the cloud platform's InfoBox so both
// platforms share the same info styling: blue left accent bar, info icon,
// light blue field, sharp corners.
export default function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-row items-start gap-2 border-l-2 border-blue-400 bg-blue-100 pl-3 pr-6 py-2 default-radius">
      <MdInfoOutline className="shrink-0 text-lg text-blue-400" />
      <p className="text-xs text-black">{children}</p>
    </div>
  );
}
