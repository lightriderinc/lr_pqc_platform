"use client";

import Badge from "@/components/ui/Badge";
import LRButton from "@/components/ui/LRButton";
import Modal from "@/components/ui/Modal";
import SectionPanel from "@/components/ui/SectionPanel";
import StatCard from "@/components/ui/StatCard";
import TableShell from "@/components/ui/TableShell";
import { useMemo, useState } from "react";
import {
  MdArrowBack,
  MdArrowDownward,
  MdArrowForward,
  MdArrowUpward,
  MdDangerous,
  MdDownload,
  MdOutlineWarning,
  MdShield,
  MdUnfoldMore,
} from "react-icons/md";
import type { ScanResult } from "./ScanConsole";

const PAGE_SIZE = 50;

type SortKey = "classification" | "risk";
type SortDir = "asc" | "desc";

const CLASSIFICATION_ORDER: Record<string, number> = {
  "quantum-vulnerable": 0,
  "pqc-ready": 1,
};

const RISK_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function rankOf(order: Record<string, number>, value: string) {
  return value in order ? order[value] : Object.keys(order).length;
}

function classificationVariant(c: string) {
  if (c === "quantum-vulnerable") return "vulnerable" as const;
  if (c === "pqc-ready") return "ready" as const;
  return "context" as const;
}

function SortableHeader({
  label,
  sortKeyName,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKeyName: SortKey;
  activeKey: SortKey | null;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const isActive = activeKey === sortKeyName;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKeyName)}
      className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
    >
      {label}
      {!isActive ? (
        <MdUnfoldMore className="text-gray-300" />
      ) : dir === "asc" ? (
        <MdArrowUpward />
      ) : (
        <MdArrowDownward />
      )}
    </button>
  );
}

export default function ScanResults({ result }: { result: ScanResult | null }) {
  const [activeFinding, setActiveFinding] = useState<
    ScanResult["findings"][0] | null
  >(null);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const completedAt = useMemo(() => new Date(), [result]);

  const sortedFindings = useMemo(() => {
    if (!result || !sortKey) return result?.findings ?? [];
    const order = sortKey === "classification" ? CLASSIFICATION_ORDER : RISK_ORDER;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...result.findings].sort(
      (a, b) => dir * (rankOf(order, a[sortKey]) - rankOf(order, b[sortKey])),
    );
  }, [result, sortKey, sortDir]);

  if (!result) {
    return <></>;
  }

  function toggleSort(key: SortKey) {
    setPage(0);
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir("asc");
    }
  }

  const totalPages = Math.ceil(sortedFindings.length / PAGE_SIZE);
  const paginated = sortedFindings.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );
  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, sortedFindings.length);

  function downloadFindings() {
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qsearch-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-4 grid gap-5">
      <SectionPanel
        title="Findings summary"
        action={
          <Badge>
            {" "}
            Scan completed · {completedAt.toLocaleDateString()}
            {" . "}
            {completedAt.toLocaleTimeString()}
          </Badge>
        }
        cardStyle= "p-0 mb-8"

      >
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Files scanned"
            value={String(result.files_scanned)}
            sub="Readable source & certs"
          />
          <StatCard
            label="Quantum-vulnerable"
            value={String(result.quantum_vulnerable)}
            sub="Prioritize migration"
            accent={result.quantum_vulnerable > 0 ? "bad" : "neutral"}
            icon={<MdDangerous />}
          />
          <StatCard
            label="High risk"
            value={String(result.high_risk)}
            sub="High-priority findings"
            accent={result.high_risk > 0 ? "warn" : "neutral"}
            icon={<MdOutlineWarning />}
          />
          <StatCard
            label="PQC-ready"
            value={String(result.pqc_ready)}
            sub="Post-quantum usage"
            accent={result.quantum_vulnerable === 0 && result.high_risk === 0 && result.pqc_ready > 0 ? "good" : "neutral"}
            icon={<MdShield />}
          />
        </div>
        <div className="flex w-full md:flex-row flex-col justify-end">
          <LRButton
            variant="primary"
            icon={<MdDownload className="text-lg" />}
            onClick={downloadFindings}
          >
            Export qSearch findings
          </LRButton>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Observed cryptography"
        action={<Badge>{result.findings.length} findings</Badge>}
        cardStyle={
          result.findings.length === 0 ? "p-4 sm:p-6 bg-gray-50" : "p-0"
        }
      >
        {result.findings.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No findings.</p>
        ) : (
          <TableShell
            columns={[
              "Algorithm",
              <SortableHeader
                key="classification"
                label="Classification"
                sortKeyName="classification"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />,
              <SortableHeader
                key="risk"
                label="Risk"
                sortKeyName="risk"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />,
              "Asset",
            ]}
            columnWidths={[
              "min-w-[140px]",
              "min-w-[160px]",
              "min-w-[110px]",
              "min-w-[220px]",
            ]}
          >
            {paginated.map((f, i) => {
              const isLast = i === paginated.length - 1;
              const borderClass = isLast ? "" : "border-b border-gray-100";
              return (
                <tr
                  key={`${f.asset}-${f.evidence}-${i}`}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                  onClick={() => setActiveFinding(f)}
                >
                  <td
                    className={`${borderClass} px-4 py-3 text-sm whitespace-nowrap`}
                  >
                    {f.algorithm}
                  </td>
                  <td className={`${borderClass} px-4 py-3`}>
                    <Badge variant={classificationVariant(f.classification)}>
                      {f.classification}
                    </Badge>
                  </td>
                  <td
                    className={`${borderClass} px-4  py-3 text-sm text-gray-500`}
                  >
                    {f.risk}
                  </td>
                  <td
                    className={`${borderClass} px-4 py-3 font-mono text-xs text-gray-500 truncate max-w-[320px]`}
                  >
                    {f.asset}
                  </td>
                </tr>
              );
            })}
          </TableShell>
        )}

        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span>
              {start}–{end} of {result.findings.length} findings
            </span>
            <div className="flex items-center gap-3">
              <LRButton
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                variant="secondary-outline"
              >
                <MdArrowBack />
              </LRButton>
              <span>
                {page + 1} / {totalPages}
              </span>
              <LRButton
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                variant="secondary-outline"
              >
                <MdArrowForward />
              </LRButton>
            </div>
          </div>
        )}
      </SectionPanel>

      <Modal
        open={!!activeFinding}
        onClose={() => setActiveFinding(null)}
        eyebrow="Finding"
        title={activeFinding?.algorithm ?? "Finding details"}
        footer={
          <LRButton
            variant="secondary-outline"
            onClick={() => setActiveFinding(null)}
          >
            Close
          </LRButton>
        }
      >
        {activeFinding && (
          <dl className="default-radius overflow-hidden text-sm">
            {(
              [
                { label: "Algorithm", value: activeFinding.algorithm },
                { label: "Service", value: activeFinding.service },
                {
                  label: "Classification",
                  value: activeFinding.classification,
                },
                { label: "Risk", value: activeFinding.risk },
                { label: "Confidence", value: activeFinding.confidence },
                { label: "Provenance", value: activeFinding.provenance },
                { label: "Asset", value: activeFinding.asset },
                { label: "Evidence", value: activeFinding.evidence },
                { label: "Detail", value: activeFinding.detail },
              ] as const
            )
              .filter((row) => row.value)
              .map((row, i, arr) => (
                <div
                  key={row.label}
                  className={`grid grid-cols-[120px_1fr] gap-x-4 px-4 py-3 ${
                    i === arr.length - 1 ? "" : "border-b-2 border-gray-50"
                  }`}
                >
                  <dt className="text-xs flex items-center uppercase font-medium tracking-wide text-gray-400">
                    {row.label}
                  </dt>
                  <dd className="break-all text-gray-700">
                    {row.label === "Classification" ? (
                      <Badge variant={classificationVariant(row.value)}>
                        {row.value}
                      </Badge>
                    ) : row.label === "Asset" || row.label === "Evidence" ? (
                      <span className="font-mono text-xs text-gray-500">
                        {row.value}
                      </span>
                    ) : (
                      row.value || "—"
                    )}
                  </dd>
                </div>
              ))}
          </dl>
        )}
      </Modal>
    </div>
  );
}
