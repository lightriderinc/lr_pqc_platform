"use client";

import Badge from "@/components/ui/Badge";
import DownloadButton from "@/components/ui/DownloadButton";
import LRButton from "@/components/ui/LRButton";
import Modal from "@/components/ui/Modal";
import SectionPanel from "@/components/ui/SectionPanel";
import StatCard from "@/components/ui/StatCard";
import TableShell from "@/components/ui/TableShell";
import FixPlan from "./FixPlan";
import InventoryExport from "./InventoryExport";
import ScanAlerts from "./ScanAlerts";
import { keyLabel } from "@/lib/qsearch/algorithms";
import { buildCbom } from "@/lib/qsearch/cbom";
import { fixFor } from "@/lib/qsearch/fixes";
import { TAGS, isComment, isTestPath, tagsOf } from "@/lib/qsearch/tags";
import { useMemo, useState } from "react";
import {
  MdArrowBack,
  MdArrowDownward,
  MdArrowForward,
  MdArrowUpward,
  MdDangerous,
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

const KEY_SOURCE = {
  algorithm: "from the algorithm name",
  code: "read from the code",
  certificate: "read from the certificate",
} as const;

/** "2048 bits, read from the code", or "" when the key size is unknown. */
function keyText(f: ScanResult["findings"][number]) {
  const label = keyLabel(f);
  if (!label) return "";
  return f.keySource ? `${label}, ${KEY_SOURCE[f.keySource]}` : label;
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
  const [hideTests, setHideTests] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // Scans are not stored, so the time this result is first shown is the scan's
  // time. The page remounts this panel for every new result.
  const [completedAt] = useState(() => new Date());

  // A new serial number each time the scan is shown, as CycloneDX requires per BOM.
  const cbom = useMemo(
    () =>
      result &&
      JSON.stringify(
        // The CBOM lists cryptography in code and files, not mentions in comments.
        buildCbom(result.findings.filter((f) => !isComment(f)), {
          project: result.project,
          timestamp: completedAt.toISOString(),
          serial: crypto.randomUUID(),
        }),
        null,
        2,
      ),
    [result, completedAt],
  );

  const shownFindings = useMemo(
    () =>
      (result?.findings ?? []).filter(
        (f) => (showComments || !isComment(f)) && !(hideTests && isTestPath(f.asset)),
      ),
    [result, showComments, hideTests],
  );

  const sortedFindings = useMemo(() => {
    if (!sortKey) return shownFindings;
    const order = sortKey === "classification" ? CLASSIFICATION_ORDER : RISK_ORDER;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...shownFindings].sort(
      (a, b) => dir * (rankOf(order, a[sortKey]) - rankOf(order, b[sortKey])),
    );
  }, [shownFindings, sortKey, sortDir]);

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

  const stamp = completedAt.toISOString().slice(0, 10);
  const { reports, ...scan } = result;
  const downloads = [
    { label: "CBOM (CycloneDX 1.6)", value: cbom ?? "", filename: `qsearch-cbom-${stamp}.cdx.json`, mimeType: "application/json" },
    { label: "Findings (CSV)", value: reports.csv, filename: `qsearch-findings-${stamp}.csv`, mimeType: "text/csv" },
    { label: "Executive summary", value: reports.summary, filename: `qsearch-summary-${stamp}.txt`, mimeType: "text/plain" },
    result.signed
      ? { label: "Findings (JSON, signed)", value: JSON.stringify(result.signed, null, 2), filename: `qsearch-findings-signed-${stamp}.json`, mimeType: "application/json" }
      : { label: "Findings (JSON)", value: JSON.stringify(scan, null, 2), filename: `qsearch-findings-${stamp}.json`, mimeType: "application/json" },
  ].filter((d) => d.value);

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
        cardStyle="p-0 mb-8"

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
        <div className="flex w-full flex-wrap justify-end gap-2">
          {downloads.map((d) => (
            <DownloadButton key={d.label} label={d.label} value={d.value} filename={d.filename} mimeType={d.mimeType} />
          ))}
        </div>
      </SectionPanel>

      <ScanAlerts findings={result.findings} at={completedAt} />

      <FixPlan findings={result.findings} at={completedAt} />

      <InventoryExport result={result} at={completedAt} />

      <SectionPanel
        title="Observed cryptography"
        action={
          <Badge>
            {sortedFindings.length === result.findings.length
              ? `${result.findings.length} ${result.findings.length === 1 ? "finding" : "findings"}`
              : `${sortedFindings.length} of ${result.findings.length} findings`}
          </Badge>
        }
        cardStyle={
          sortedFindings.length === 0 ? "p-4 sm:p-6 bg-gray-50" : "p-0"
        }
      >
        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-700">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={hideTests}
              onChange={(e) => {
                setHideTests(e.target.checked);
                setPage(0);
              }}
            />
            Hide test files ({result.findings.filter((f) => isTestPath(f.asset)).length})
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showComments}
              onChange={(e) => {
                setShowComments(e.target.checked);
                setPage(0);
              }}
            />
            Show comments and documentation ({result.findings.filter(isComment).length})
          </label>
        </div>
        {sortedFindings.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            {result.findings.length === 0 ? "No findings." : "No findings match these filters."}
          </p>
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
              "Key size",
              "Asset",
              "Notes",
            ]}
            columnWidths={[
              "min-w-[140px]",
              "min-w-[160px]",
              "min-w-[110px]",
              "min-w-[110px]",
              "min-w-[220px]",
              "min-w-[140px]",
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
                    className={`${borderClass} px-4 py-3 text-sm whitespace-nowrap text-gray-500`}
                  >
                    {keyLabel(f) ?? "—"}
                  </td>
                  <td
                    className={`${borderClass} px-4 py-3 font-mono text-xs text-gray-500 truncate max-w-[320px]`}
                  >
                    {f.asset}
                  </td>
                  <td className={`${borderClass} px-4 py-3`}>
                    <div className="flex flex-wrap gap-1">
                      {tagsOf(f, completedAt).map((t) => (
                        <Badge key={t} variant={TAGS[t].variant}>
                          {TAGS[t].label}
                        </Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </TableShell>
        )}

        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span>
              {start}–{end} of {sortedFindings.length} findings
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
                { label: "Key size", value: keyText(activeFinding) },
                { label: "Subject", value: activeFinding.certificate?.subject ?? "" },
                { label: "Issuer", value: activeFinding.certificate?.issuer ?? "" },
                {
                  label: "Valid until",
                  value: activeFinding.certificate
                    ? activeFinding.certificate.notValidAfter
                      ? new Date(activeFinding.certificate.notValidAfter).toLocaleString()
                      : "Unreadable date in the certificate"
                    : "",
                },
                { label: "Confidence", value: activeFinding.confidence },
                { label: "Provenance", value: activeFinding.provenance },
                { label: "Asset", value: activeFinding.asset },
                { label: "Evidence", value: activeFinding.evidence },
                { label: "Detail", value: activeFinding.detail },
                {
                  label: "Notes",
                  value: tagsOf(activeFinding, completedAt)
                    .map((t) => TAGS[t].note)
                    .join(" "),
                },
                {
                  label: "How to fix",
                  value: (() => {
                    const fix = fixFor(activeFinding, completedAt);
                    return fix ? `${fix.title}. Steps and an example are in the fix plan.` : "";
                  })(),
                },
              ] as const
            )
              .filter((row) => row.value)
              .map((row, i, arr) => (
                <div
                  key={row.label}
                  className={`grid grid-cols-[120px_1fr] gap-x-4 px-4 py-3 ${i === arr.length - 1 ? "" : "border-b-2 border-gray-50"
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