"use client";

import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import LRButton from "@/components/ui/LRButton";
import Modal from "@/components/ui/Modal";
import SectionPanel from "@/components/ui/SectionPanel";
import StatCard from "@/components/ui/StatCard";
import TableShell from "@/components/ui/TableShell";
import { useState } from "react";
import { MdArrowBack, MdArrowForward, MdDownload, MdTravelExplore } from "react-icons/md";
import type { ScanResult } from "./ScanConsole";

const PAGE_SIZE = 50;

function classificationVariant(c: string) {
  if (c === "quantum-vulnerable") return "vulnerable" as const;
  if (c === "pqc-ready") return "ready" as const;
  return "context" as const;
}

export default function ScanResults({ result }: { result: ScanResult | null }) {
  const [activeFinding, setActiveFinding] = useState<
    ScanResult["findings"][0] | null
  >(null);
  const [page, setPage] = useState(0);

  if (!result) {
    return (
      <div className="mt-6">
        <EmptyState
          icon={<MdTravelExplore />}
          title="Upload a file or ZIP to see results"
          description="Choose a source file or ZIP archive above and run qSearch to discover quantum-vulnerable cryptography. Findings and exportable reports will appear here."
        />
      </div>
    );
  }

  const totalPages = Math.ceil(result.findings.length / PAGE_SIZE);
  const paginated = result.findings.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );
  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, result.findings.length);

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
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Files scanned"
          value={String(result.files_scanned)}
          sub="Readable source & certs"
        />
        <StatCard
          label="Quantum-vulnerable"
          value={String(result.quantum_vulnerable)}
          sub="Prioritize migration"
          accent={result.quantum_vulnerable > 0 ? "bad" : "good"}
        />
        <StatCard
          label="High risk"
          value={String(result.high_risk)}
          sub="High-priority findings"
          accent={result.high_risk > 0 ? "warn" : "neutral"}
        />
        <StatCard
          label="PQC-ready"
          value={String(result.pqc_ready)}
          sub="Post-quantum usage"
          accent={result.pqc_ready > 0 ? "good" : "neutral"}
        />
      </div>

      <div className="-mt-4 mb-3 flex items-start justify-between gap-4">
        <span className="text-md font-medium text-gray-400">
          Scan completed · {new Date().toLocaleDateString()}
        </span>
        <LRButton
          variant="secondary-outline"
          icon={<MdDownload className="text-lg" />}
          onClick={downloadFindings}
          className="default-radius border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
        >
          Download findings.json
        </LRButton>
      </div>

      <SectionPanel
        title="Observed cryptography"
        action={<Badge>{result.findings.length} findings</Badge>}
        cardStyle={result.findings.length === 0 ? "p-4 sm:p-6 bg-gray-50" : "p-0"}
      >
        {result.findings.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No findings.</p>
        ) : (
          <TableShell
            columns={["Algorithm", "Classification", "Risk", "Asset"]}
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
                  <td className={`${borderClass} px-4 py-3 text-sm`}>
                    {f.algorithm}
                  </td>
                  <td className={`${borderClass} px-4 py-3`}>
                    <Badge variant={classificationVariant(f.classification)}>
                      {f.classification}
                    </Badge>
                  </td>
                  <td className={`${borderClass} px-4  py-3 text-sm text-gray-500`}>
                    {f.risk}
                  </td>
                  <td
                    className={`${borderClass} px-4 py-3 font-mono text-xs text-gray-500 truncate max-w-xs`}
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
          <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 text-sm">
            {[
              ["Algorithm", activeFinding.algorithm],
              ["Classification", activeFinding.classification],
              ["Risk", activeFinding.risk],
              ["Asset", activeFinding.asset],
              ["Evidence", activeFinding.evidence],
            ].map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-xs uppercase tracking-wide text-gray-400">
                  {label}
                </dt>
                <dd className="m-0 break-all text-gray-700">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>
    </div>
  );
}
