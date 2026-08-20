"use client";

import type { ScanResult } from "@/app/qsearch/actions";
import { runQSearch } from "@/app/qsearch/actions";
import LRButton from "@/components/ui/LRButton";
import type { DragEvent } from "react";
import { useRef, useState } from "react";
import { ImUpload3 } from "react-icons/im";
import { MdSearch } from "react-icons/md";

export type { ScanResult };

export default function ScanConsole({
  onResult,
}: {
  onResult: (result: ScanResult) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (dropped) {
      setFile(dropped);
      setError(null);
    }
  }

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
    <div className="default-radius bg-gray-50 p-4">
      <label className="block text-lg font-semibold text-gray-700 mb-4">
        Upload a file to scan for vulnerabilities
      </label>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={handleDrop}
        className={`default-radius cursor-pointer border border-dashed px-4 py-10 text-center transition-colors ${
          dragActive
            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
            : "border-gray-200 bg-white hover:border-[var(--brand-primary-light)] hover:bg-[var(--brand-primary)]/5"
        }`}
      >
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
        <div
          className={`mb-3 flex justify-center text-3xl transition-colors ${
            dragActive ? "text-[var(--brand-primary)]" : "text-gray-300"
          }`}
        >
          <ImUpload3 />
        </div>
        {file ? (
          <p className="text-sm font-medium text-gray-700">{file.name}</p>
        ) : (
          <p className="text-sm text-gray-500">
            <span className="color-brand-primary font-medium">
              Click to browse
            </span>{" "}
            or drag and drop your file here.
          </p>
        )}
      </div>

      <div className="mt-4 flex gap-4 justify-between">
        <p className="text-xs text-gray-300">
          Supported file types: .zip, .py, .js, .ts, .go, .rs, .cpp, .c, .h,
          .hpp, .java, .rb, .cs, .yaml, .yml, .toml, .json, .cfg, .conf, .pem,
          .crt, .cer
        </p>
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
          className="default-radius mt-5 flex items-center gap-4 text-sm text-gray-500"
        >
          <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-gray-200 border-t-[var(--brand-primary)]" />
          <span>Inspecting source and certificates…</span>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}
