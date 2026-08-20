"use client";

import ScanResults from "@/components/veloce/ScanResults";
import type { ScanResult } from "@/components/veloce/ScanConsole";

const mockResult: ScanResult = {
  files_scanned: 128,
  quantum_vulnerable: 14,
  high_risk: 6,
  pqc_ready: 3,
  findings: Array.from({ length: 12 }, (_, i) => ({
    algorithm: i % 2 === 0 ? "RSA-2048" : "ML-KEM-768 (Kyber)",
    classification:
      i % 3 === 0
        ? "quantum-vulnerable"
        : i % 3 === 1
          ? "pqc-ready"
          : "context",
    risk: i % 3 === 0 ? "High" : i % 3 === 1 ? "Low" : "Medium",
    asset: `src/very/deeply/nested/directory/structure/that/is/quite/long/service-${i}/tls-cert-bundle-${i}.pem`,
    evidence: `evidence-blob-${i}`,
    detail: `Some long-ish detail text describing finding ${i} in more depth than usual so we can see wrapping behavior.`,
    service: `service-${i}`,
    provenance: "static-scan",
    confidence: "high",
  })),
};

export default function DebugScanResultsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Debug: ScanResults</h1>
      <ScanResults result={mockResult} />
    </div>
  );
}
