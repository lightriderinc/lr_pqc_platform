"use client";

import { useState } from "react";
import { MdFolderOpen, MdTravelExplore } from "react-icons/md";
import SectionPanel from "@/components/ui/SectionPanel";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import LRButton from "@/components/ui/LRButton";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import BarChartPlaceholder from "@/components/ui/BarChartPlaceholder";
import TableShell from "@/components/ui/TableShell";

// Discovery results shell. Until a scan returns data, the whole area is a
// call-to-action empty state. Once wired in, flip `hasResults` to render the
// metric row, algorithm chart, generated-evidence list, and findings table
// (header-outside / gray-box SectionPanel pattern).

const EVIDENCE_FILES = [
  { name: "findings.json / findings.csv", desc: "Canonical and tabular findings" },
  { name: "cbom.cdx.json", desc: "CycloneDX 1.6 CBOM" },
  { name: "executive-summary.txt", desc: "Client-facing summary" },
  { name: "m2302-inventory.json", desc: "OMB M-23-02 inventory" },
];

export default function ScanResults() {
  // Flip to true when a qSearch run completes and populates results.
  const [hasResults] = useState(false);
  const [findingOpen, setFindingOpen] = useState(false);

  if (!hasResults) {
    return (
      <div className="mt-7">
        <EmptyState
          icon={<MdTravelExplore />}
          title="Scan your project folder to see results"
          description="Choose a folder above and run qSearch to discover quantum-vulnerable cryptography. Findings, an algorithm breakdown, and exportable reports will appear here."
        />
      </div>
    );
  }

  return (
    <div className="mt-7 grid gap-5">
      <div className="flex justify-start">
        <LRButton
          variant="secondary-outline"
          icon={<MdFolderOpen className="text-lg" />}
        >
          Open report folder
        </LRButton>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Files scanned" value="0" sub="Readable source & certs" />
        <StatCard
          label="Quantum-vulnerable"
          value="0"
          sub="Prioritize migration"
          accent="bad"
        />
        <StatCard label="High risk" value="0" sub="High-priority findings" />
        <StatCard
          label="PQC-ready"
          value="0"
          sub="Post-quantum usage"
          accent="good"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <SectionPanel title="Algorithms by count">
          <BarChartPlaceholder />
        </SectionPanel>

        <SectionPanel title="Generated evidence">
          {EVIDENCE_FILES.map((file) => (
            <div
              key={file.name}
              className="border-b border-gray-200 py-3 first:pt-0 last:border-b-0 last:pb-0"
            >
              <strong className="block text-sm font-medium">{file.name}</strong>
              <span className="mt-1 block text-xs text-gray-500">
                {file.desc}
              </span>
            </div>
          ))}
        </SectionPanel>
      </div>

      <SectionPanel
        title="Observed cryptography"
        action={<Badge>0 findings</Badge>}
      >
        <TableShell columns={["Algorithm", "Classification", "Risk", "Asset"]}>
          {/* One placeholder row to show row layout + the detail modal. */}
          <tr
            className="cursor-pointer transition-colors hover:bg-gray-50"
            onClick={() => setFindingOpen(true)}
          >
            <td className="border-b border-gray-100 px-3 py-3 text-gray-300">
              —
            </td>
            <td className="border-b border-gray-100 px-3 py-3">
              <Badge variant="context">example</Badge>
            </td>
            <td className="border-b border-gray-100 px-3 py-3 text-gray-300">
              —
            </td>
            <td className="border-b border-gray-100 px-3 py-3 text-gray-300">
              Click to preview finding modal
            </td>
          </tr>
        </TableShell>
      </SectionPanel>

      <Modal
        open={findingOpen}
        onClose={() => setFindingOpen(false)}
        eyebrow="Finding"
        title="Finding details"
        footer={
          <LRButton
            variant="secondary-outline"
            onClick={() => setFindingOpen(false)}
          >
            Close
          </LRButton>
        }
      >
        <div className="default-radius border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
          Algorithm, classification, risk, asset path, and evidence will render
          here.
        </div>
      </Modal>
    </div>
  );
}
