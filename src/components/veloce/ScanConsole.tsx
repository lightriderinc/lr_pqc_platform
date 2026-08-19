"use client";

import { useRef, useState } from "react";
import { MdUploadFile, MdSearch } from "react-icons/md";
import LRButton from "@/components/ui/LRButton";
import { runQSearch } from "@/app/qsearch/actions";
import type { ScanResult } from "@/app/qsearch/actions";

export type { ScanResult };

export default function ScanConsole({
  onResult,
}: {
  onResult: (result: ScanResult) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function startScan() {
    if (!file || scanning) return;
    setScanning(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);

    const result = await runQSearch(form);

    if (!result.ok) {
      setError(result.error);
    } else {
      onResult(result.data);
    }
    setScanning(false);
  }

  return (
    <div className="default-radius border border-gray-100 bg-gray-50 p-6">
      <label className="block text-xs text-gray-500">Source archive</label>
      <p className="mb-3 mt-0.5 text-xs text-gray-400">
        Upload a ZIP of your project folder to scan.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          type="file"
          accept=".zip,.py,.js,.ts,.go,.rs,.cpp,.c,.h,.hpp,.java,.rb,.cs,.yaml,.yml,.toml,.json,.cfg,.conf,.pem,.crt,.cer,application/zip"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="default-radius flex min-w-0 flex-1 items-center gap-2 border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-500 transition-colors hover:border-gray-300"
        >
          <MdUploadFile className="shrink-0 text-lg text-gray-400" />
          <span className="truncate">
            {file ? file.name : "Choose a ZIP file"}
          </span>
        </button>
        <LRButton
          variant="secondary-outline"
          onClick={() => inputRef.current?.click()}
        >
          Choose file
        </LRButton>
        <LRButton
          variant="primary"
          icon={<MdSearch className="text-lg" />}
          onClick={startScan}
          disabled={!file || scanning}
        >
          {scanning ? "Scanning…" : "Start qSearch"}
        </LRButton>
      </div>

      {scanning && (
        <div
          aria-live="polite"
          className="default-radius mt-5 flex items-center gap-4 border border-gray-100 bg-white p-5 text-sm text-gray-500"
        >
          <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-gray-200 border-t-[var(--brand-primary)]" />
          <span>Inspecting source and certificates…</span>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}