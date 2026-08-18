// Single metric / KPI box: a small uppercase label, a large value, and an
// optional sub-line. An accent underbar signals status (neutral / good / bad /
// warn) using the platform brand + semantic colors. Empty shell by default —
// pass value="—" until real data is wired in.

export type StatAccent = "neutral" | "good" | "bad" | "warn";

const accentBar: Record<StatAccent, string> = {
  neutral: "bg-[var(--brand-tertiary)]",
  good: "bg-green-600",
  bad: "bg-red-600",
  warn: "bg-[var(--brand-secondary)]",
};

export default function StatCard({
  label,
  value = "—",
  sub,
  accent = "neutral",
}: {
  label: string;
  value?: string;
  sub?: string;
  accent?: StatAccent;
}) {
  return (
    <article className="default-radius relative overflow-hidden border border-gray-100 bg-white p-5">
      <span className="block text-2xs font-medium uppercase tracking-[0.13em] text-gray-400">
        {label}
      </span>
      <strong className="mt-2 block text-2xl font-semibold">{value}</strong>
      {sub && <small className="mt-1 block text-sm text-gray-500">{sub}</small>}
      <span
        aria-hidden
        className={`absolute inset-x-0 bottom-0 h-0.5 ${accentBar[accent]}`}
      />
    </article>
  );
}
