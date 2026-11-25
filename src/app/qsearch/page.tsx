"use client";

import DomainAudit from "@/components/veloce/DomainAudit";
import ScanConsole, { type ScanResult } from "@/components/veloce/ScanConsole";
import ScanHistory from "@/components/veloce/ScanHistory";
import ScanResults from "@/components/veloce/ScanResults";
import ServerCheck from "@/components/veloce/ServerCheck";
import Link from "next/link";
import { useState } from "react";

export default function QSearchPage() {
  const [result, setResult] = useState<ScanResult | null>(null);
  // Each new result gets fresh table state (page, filters), saved or not.
  const [run, setRun] = useState(0);
  const savedId = result?.saved?.id;
  const show = (r: ScanResult | null) => {
    setResult(r);
    setRun((n) => n + 1);
  };

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-2xl font-semibold">qSearch discovery</h1>
      <p className="mb-12 text-sm text-gray-600">
        Discover quantum-vulnerable cryptography across a codebase.{" "}
        <Link href="/qsearch/verify" className="underline">
          Verify a signed result
        </Link>{" "}
        ·{" "}
        <Link href="/qsearch/accuracy" className="underline">
          Accuracy
        </Link>
      </p>
      <div className="mb-8">
        <ScanConsole onResult={show} onReset={() => show(null)} />
      </div>
      <ScanResults key={run} result={result} />
      <ScanHistory refreshKey={savedId} activeId={savedId} onOpen={show} onClear={() => show(null)} />
      <DomainAudit />
      <ServerCheck />
    </div>
  );
}