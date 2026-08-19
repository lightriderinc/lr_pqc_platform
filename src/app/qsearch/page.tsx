"use client";

import ScanConsole, { type ScanResult } from "@/components/veloce/ScanConsole";
import ScanResults from "@/components/veloce/ScanResults";
import { useState } from "react";

export default function QSearchPage() {
  const [result, setResult] = useState<ScanResult | null>(null);

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-2xl font-semibold">qSearch discovery</h1>
      <p className="mb-12 text-sm text-gray-600">
        Discover quantum-vulnerable cryptography across a codebase.
      </p>
      <ScanConsole onResult={setResult} />
      <ScanResults result={result} />
    </div>
  );
}
