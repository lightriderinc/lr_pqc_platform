import type { ReactNode } from "react";

// Empty table shell: sticky header row + an "under construction" empty state.
// Pass `columns` for the header; drop real rows into `children` (a <tbody>'s
// worth of <tr>) once data is wired in.
export default function TableShell({
  columns,
  children,
  emptyLabel = "No data yet — connect qSearch to populate findings.",
}: {
  columns: string[];
  children?: ReactNode;
  emptyLabel?: string;
}) {
  return (
    <div className="default-radius max-h-[480px] overflow-auto border border-gray-100 bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="sticky top-0 border-b border-gray-100 bg-gray-50 px-3 py-3 text-left text-2xs font-semibold uppercase tracking-[0.08em] text-gray-400"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children ?? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-12 text-center text-sm text-gray-400"
              >
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
