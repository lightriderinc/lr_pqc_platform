"use client";

import { useState } from "react";
import ScanConsole, { type ScanResult } from "@/components/veloce/ScanConsole";
import ScanResults from "@/components/veloce/ScanResults";

export default function QSearchPage() {
  const [result, setResult] = useState<ScanResult | null>(null);

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-2xl font-semibold">qSearch discovery</h1>
      <p className="mb-6 text-sm text-gray-600">
        Discover quantum-vulnerable cryptography across a codebase.
      </p>
      <ScanConsole onResult={setResult} />
      <ScanResults result={result} />
    </div>
  );
}
