// Single metric / KPI box: a small uppercase label, a large value, and an
// optional sub-line. An accent underbar signals status (neutral / good / bad /
// warn) using the platform brand + semantic colors. Empty shell by default —
// pass value="—" until real data is wired in.

export type StatAccent = "neutral" | "good" | "bad" | "warn";

const accentBar: Record<StatAccent, string> = {
  neutral: "bg-gray-50",
  good: "bg-green-600",
  bad: "bg-red-600",
  warn: "bg-[var(--brand-secondary)]",
};

const accentText: Record<StatAccent, string> = {
  neutral: "text-gray-200",
  good: "text-green-600",
  bad: "text-red-600",
  warn: "text-yellow-500",
};

export default function StatCard({
  label,
  value = "—",
  sub,
  accent = "neutral",
  icon,
}: {
  label: string;
  value?: string;
  sub?: string;
  accent?: StatAccent;
  icon?: React.ReactNode;
}) {
  return (
    <article className="default-radius relative overflow-hidden bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="block text-md font-semibold text-gray-300">
          {label}
        </span>
        {icon && <span className={accentText[accent] + " text-2xl"}>{icon}</span>}
      </div>

      <strong className="mt-2 block text-2xl font-semibold">{value}</strong>
      {sub && <small className="mt-1 block text-sm text-gray-500">{sub}</small>}
      {/* <span
        aria-hidden
        className={`absolute inset-x-0 bottom-0 h-0.75 ${accentBar[accent]}`}
      /> */}
    </article>
  );
}
