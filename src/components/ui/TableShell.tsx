import type { ReactNode } from "react";

// Empty table shell: sticky header row + an "under construction" empty state.
// Pass `columns` for the header; drop real rows into `children` (a <tbody>'s
// worth of <tr>) once data is wired in.
export default function TableShell({
  columns,
  columnWidths,
  children,
  emptyLabel = "No data yet — connect qSearch to populate findings.",
}: {
  columns: string[];
  columnWidths?: string[];
  children?: ReactNode;
  emptyLabel?: string;
}) {
  return (
    <div className="default-radius max-h-[480px] overflow-auto border border-gray-50 bg-white">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={col}
                className={`sticky top-0 border-b border-gray-100 bg-gray-50 px-4 py-2 text-left font-medium text-gray-700 truncate ${columnWidths?.[i] ?? ""}`}
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
