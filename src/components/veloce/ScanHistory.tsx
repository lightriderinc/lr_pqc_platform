"use client";

import { deleteScan, listScanHistory, openScan, type ScanResult } from "@/app/qsearch/actions";
import Badge from "@/components/ui/Badge";
import LRButton from "@/components/ui/LRButton";
import SectionPanel from "@/components/ui/SectionPanel";
import TableShell from "@/components/ui/TableShell";
import type { ScanSummary } from "@/lib/qsearch/scanStore";
import { useEffect, useState } from "react";

const CONNECTION_FAILED = "The request did not reach the server. Check your connection and try again.";

/** The signed-in user's saved scans. Renders nothing while signed out. */
export default function ScanHistory({
  refreshKey,
  activeId,
  onOpen,
  onClear,
}: {
  /** Reloads the list when it changes, for example after a new scan. */
  refreshKey?: string;
  activeId?: string;
  onOpen: (result: ScanResult) => void;
  /** Called when the scan on screen is deleted. */
  onClear: () => void;
}) {
  const [scans, setScans] = useState<ScanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let current = true;
    listScanHistory().then(
      (result) => {
        if (!current) return;
        if (result.ok) {
          setScans(result.scans);
          setError(null);
        } else if (!result.authRequired) setError(result.error);
      },
      () => current && setError(CONNECTION_FAILED),
    );
    return () => {
      current = false;
    };
  }, [refreshKey, reloads]);

  async function open(id: string) {
    setBusyId(id);
    try {
      const result = await openScan(id);
      if (result.ok) {
        setError(null);
        onOpen(result.data);
      } else setError(result.error);
    } catch {
      setError(CONNECTION_FAILED);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(scan: ScanSummary) {
    const when = new Date(scan.createdAt).toLocaleString();
    if (!window.confirm(`Delete the scan of ${scan.fileName} from ${when}? This cannot be undone.`)) return;
    setBusyId(scan.id);
    try {
      const result = await deleteScan(scan.id);
      if (!result.ok) return setError(result.error);
      if (scan.id === activeId) onClear();
      setReloads((n) => n + 1);
    } catch {
      setError(CONNECTION_FAILED);
    } finally {
      setBusyId(null);
    }
  }

  if (!scans && !error) return null;

  return (
    <div className="mt-8">
      <SectionPanel
        title="Scan history"
        action={scans && <Badge>{scans.length} saved</Badge>}
        cardStyle={scans?.length ? "p-0" : "p-4 sm:p-6 bg-gray-50"}
      >
        {error && (
          <p className="px-4 py-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {scans && scans.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">No saved scans yet. Each scan you run is saved here.</p>
        )}
        {scans && scans.length > 0 && (
          <TableShell columns={["Scanned", "Project", "Quantum-vulnerable", "High risk", "PQC-ready", ""]}>
            {scans.map((scan) => (
              <tr key={scan.id} className={scan.id === activeId ? "bg-gray-50" : ""}>
                <td className="border-b border-gray-100 px-4 py-3 whitespace-nowrap text-gray-700">
                  {new Date(scan.createdAt).toLocaleString()}
                </td>
                <td className="border-b border-gray-100 px-4 py-3 font-mono text-xs text-gray-600" title={scan.fileName}>
                  {scan.project}
                </td>
                <td className="border-b border-gray-100 px-4 py-3 text-gray-700">{scan.quantumVulnerable}</td>
                <td className="border-b border-gray-100 px-4 py-3 text-gray-700">{scan.highRisk}</td>
                <td className="border-b border-gray-100 px-4 py-3 text-gray-700">{scan.pqcReady}</td>
                <td className="border-b border-gray-100 px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <LRButton
                      variant="secondary-outline"
                      disabled={busyId !== null || scan.id === activeId}
                      onClick={() => open(scan.id)}
                    >
                      {scan.id === activeId ? "Showing" : "Open"}
                    </LRButton>
                    <LRButton variant="danger-outline" disabled={busyId !== null} onClick={() => remove(scan)}>
                      Delete
                    </LRButton>
                  </div>
                </td>
              </tr>
            ))}
          </TableShell>
        )}
      </SectionPanel>
    </div>
  );
}