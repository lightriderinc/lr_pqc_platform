"use client";

import { useState } from "react";
import { MdTravelExplore } from "react-icons/md";
import SectionPanel from "@/components/ui/SectionPanel";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import LRButton from "@/components/ui/LRButton";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import TableShell from "@/components/ui/TableShell";
import type { ScanResult } from "./ScanConsole";

const EVIDENCE_FILES = [
  { name: "findings.json / findings.csv", desc: "Canonical and tabular findings" },
  { name: "cbom.cdx.json", desc: "CycloneDX 1.6 CBOM" },
  { name: "executive-summary.txt", desc: "Client-facing summary" },
  { name: "m2302-inventory.json", desc: "OMB M-23-02 inventory" },
];

function classificationVariant(c: string) {
  if (c === "quantum-vulnerable") return "vulnerable" as const;
  if (c === "pqc-ready") return "ready" as const;
  return "context" as const;
}

export default function ScanResults({ result }: { result: ScanResult | null }) {
  const [activeFinding, setActiveFinding] = useState<ScanResult["findings"][0] | null>(null);

  if (!result) {
    return (
      <div className="mt-7">
        <EmptyState
          icon={<MdTravelExplore />}
          title="Upload a ZIP to see results"
          description="Choose a ZIP of your project above and run qSearch to discover quantum-vulnerable cryptography. Findings, an algorithm breakdown, and exportable reports will appear here."
        />
      </div>
    );
  }

  return (
    <div className="mt-7 grid gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      <SectionPanel title="Generated evidence">
        {EVIDENCE_FILES.map((file) => (
          <div
            key={file.name}
            className="border-b border-gray-200 py-3 first:pt-0 last:border-b-0 last:pb-0"
          >
            <strong className="block text-sm font-medium">{file.name}</strong>
            <span className="mt-1 block text-xs text-gray-500">{file.desc}</span>
          </div>
        ))}
      </SectionPanel>

      <SectionPanel
        title="Observed cryptography"
        action={<Badge>{result.findings.length} findings</Badge>}
      >
        {result.findings.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No findings.</p>
        ) : (
          <TableShell columns={["Algorithm", "Classification", "Risk", "Asset"]}>
            {result.findings.slice(0, 50).map((f, i) => (
              <tr
                key={`${f.asset}-${f.evidence}-${i}`}
                className="cursor-pointer transition-colors hover:bg-gray-50"
                onClick={() => setActiveFinding(f)}
              >
                <td className="border-b border-gray-100 px-3 py-3 text-sm font-medium">
                  {f.algorithm}
                </td>
                <td className="border-b border-gray-100 px-3 py-3">
                  <Badge variant={classificationVariant(f.classification)}>
                    {f.classification}
                  </Badge>
                </td>
                <td className="border-b border-gray-100 px-3 py-3 text-sm text-gray-500">
                  {f.risk}
                </td>
                <td className="border-b border-gray-100 px-3 py-3 text-xs text-gray-500 font-mono truncate max-w-xs">
                  {f.asset}
                </td>
              </tr>
            ))}
          </TableShell>
        )}
        {result.findings.length > 50 && (
          <p className="mt-3 text-xs text-gray-400">
            Showing 50 of {result.findings.length} findings.
          </p>
        )}
      </SectionPanel>

      <Modal
        open={!!activeFinding}
        onClose={() => setActiveFinding(null)}
        eyebrow="Finding"
        title={activeFinding?.algorithm ?? "Finding details"}
        footer={
          <LRButton variant="secondary-outline" onClick={() => setActiveFinding(null)}>
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
                <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
                <dd className="m-0 break-all text-gray-700">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>
    </div>
  );
}
