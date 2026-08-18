// Empty shell for the "algorithms by count" horizontal bar chart. Renders a
// few skeleton rows (label / track / count) so the layout is visible before
// real qSearch data is wired in. Swap `rows` for live data later.

const PLACEHOLDER_ROWS = [
  { width: "w-3/4" },
  { width: "w-1/2" },
  { width: "w-2/5" },
  { width: "w-1/4" },
  { width: "w-1/6" },
];

export default function BarChartPlaceholder() {
  return (
    <div className="grid gap-3 pt-4">
      {PLACEHOLDER_ROWS.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-[minmax(90px,1fr)_2fr_32px] items-center gap-3 text-sm"
        >
          <span className="h-3 rounded bg-gray-100" />
          <span className="h-2 overflow-hidden rounded-full bg-gray-100">
            <span
              className={`block h-full rounded-full bg-[var(--brand-tertiary)]/40 ${row.width}`}
            />
          </span>
          <span className="h-3 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
