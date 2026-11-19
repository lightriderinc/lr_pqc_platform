// Compares two qSearch scans of the same project. Pure logic, no I/O.
//
// Findings are matched by classification, algorithm and file, ignoring line
// numbers, so code that only moves within a file does not count as a change.

export interface ComparableFinding {
  classification: string;
  algorithm: string;
  asset: string;
  confidence?: string;
}

export interface ChangeRow extends ComparableFinding {
  /** How many more (added) or fewer (resolved) findings of this kind. */
  count: number;
}

export interface Comparison {
  /** When the scan being compared against was made, as an ISO date. */
  previousAt: string;
  added: ChangeRow[];
  resolved: ChangeRow[];
  unchanged: number;
}

const keyOf = (f: ComparableFinding) => JSON.stringify([f.classification, f.algorithm, f.asset]);

function tally(findings: ComparableFinding[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const f of findings) counts.set(keyOf(f), (counts.get(keyOf(f)) ?? 0) + 1);
  return counts;
}

/** Findings in `from` beyond those in `minus`. */
function surplus(from: Map<string, number>, minus: Map<string, number>): ChangeRow[] {
  return [...from].flatMap(([key, n]) => {
    const count = n - (minus.get(key) ?? 0);
    if (count <= 0) return [];
    const [classification, algorithm, asset] = JSON.parse(key) as string[];
    return [{ classification, algorithm, asset, count }];
  });
}

export function compareFindings(
  previous: ComparableFinding[],
  current: ComparableFinding[],
  previousAt: string,
): Comparison {
  // Comments and documentation are not counted, as in the scan totals.
  const counted = (list: ComparableFinding[]) => list.filter((f) => f.confidence !== "low");
  current = counted(current);
  const before = tally(counted(previous));
  const after = tally(current);
  const added = surplus(after, before);
  const resolved = surplus(before, after);
  const addedTotal = added.reduce((sum, row) => sum + row.count, 0);
  return { previousAt, added, resolved, unchanged: current.length - addedTotal };
}