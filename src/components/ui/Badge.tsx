import type { ReactNode } from "react";

// Small pill/tag for classifications, statuses, and "no live data" markers.
// Variants map Veloce's classification colors onto the PQC brand palette.

export type BadgeVariant =
  | "neutral"
  | "vulnerable"
  | "ready"
  | "context"
  | "warn";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "border-gray-200 text-gray-500 bg-white",
  vulnerable: "border-red-200 text-red-600 bg-red-50",
  ready: "border-green-200 text-green-700 bg-green-50",
  context: "border-gray-200 text-gray-500 bg-gray-50",
  warn: "border-[var(--brand-secondary)] text-[var(--brand-tertiary)] bg-[var(--brand-secondary)]/10",
};

export default function Badge({
  children,
  variant = "neutral",
  className = "",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-2xs uppercase tracking-[0.08em] ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
