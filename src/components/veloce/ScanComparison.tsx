import Badge from "@/components/ui/Badge";
import SectionPanel from "@/components/ui/SectionPanel";
import type { SavedScan } from "@/app/qsearch/actions";
import type { ChangeRow } from "@/lib/qsearch/compare";

/** Rows shown per list; the rest are counted. */
const MAX_ROWS = 20;

const total = (rows: ChangeRow[]) => rows.reduce((sum, row) => sum + row.count, 0);

function ChangeList({ title, rows, empty, tone }: { title: string; rows: ChangeRow[]; empty: string; tone: string }) {
  return (
    <div className="min-w-0 space-y-2">
      <h3 className={`text-sm font-semibold ${tone}`}>
        {title} ({total(rows)})
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">{empty}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {rows.slice(0, MAX_ROWS).map((row) => (
            <li key={`${row.classification}|${row.algorithm}|${row.asset}`} className="min-w-0">
              <span className="font-medium text-gray-800">{row.algorithm}</span>
              {row.count > 1 && <span className="text-gray-500"> ×{row.count}</span>}
              <span className="text-gray-400"> · {row.classification} · </span>
              <span className="break-all font-mono text-xs text-gray-500">{row.asset}</span>
            </li>
          ))}
          {rows.length > MAX_ROWS && <li className="text-gray-400">and {rows.length - MAX_ROWS} more</li>}
        </ul>
      )}
    </div>
  );
}

/** What changed since the previous scan of the same project. */
export default function ScanComparison({ saved }: { saved: SavedScan | null }) {
  if (!saved) {
    return (
      <p className="default-radius border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        This scan could not be saved to your history, so it is not compared with earlier scans.
      </p>
    );
  }
  const { comparison } = saved;
  if (!comparison) {
    return (
      <p className="text-sm text-gray-500">
        Saved as the first scan of <span className="font-mono">{saved.project}</span>. Scan a file with the same name
        again to see what changed.
      </p>
    );
  }
  return (
    <SectionPanel
      title="Changes since the last scan"
      action={<Badge>Compared with {new Date(comparison.previousAt).toLocaleString()}</Badge>}
    >
      <p className="mb-4 text-sm text-gray-700">
        {total(comparison.added)} new · {total(comparison.resolved)} resolved · {comparison.unchanged} unchanged. Line
        numbers are ignored, so code that only moved is not counted as a change.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <ChangeList title="New" rows={comparison.added} empty="Nothing new." tone="text-red-700" />
        <ChangeList title="Resolved" rows={comparison.resolved} empty="Nothing resolved." tone="text-green-700" />
      </div>
    </SectionPanel>
  );
}