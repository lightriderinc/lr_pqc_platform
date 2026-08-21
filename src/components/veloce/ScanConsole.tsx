"use client";

import type { ScanResult } from "@/app/qsearch/actions";
import { runQSearch } from "@/app/qsearch/actions";
import LRButton from "@/components/ui/LRButton";
import { useState } from "react";
import { MdRefresh, MdSearch } from "react-icons/md";
import FileDropzone from "./FileDropzone";
import UploadedFileCard from "./UploadedFileCard";

export type { ScanResult };

const ACCEPTED_FILE_TYPES =
  ".zip,.py,.js,.ts,.go,.rs,.cpp,.c,.h,.hpp,.java,.rb,.cs,.yaml,.yml,.toml,.json,.cfg,.conf,.pem,.crt,.cer,application/zip";

export default function ScanConsole({
  onResult,
  onReset,
}: {
  onResult: (result: ScanResult) => void;
  onReset?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  function handleFileSelected(selected: File) {
    setFile(selected);
    setError(null);
  }

  function handleFileRejected(message: string) {
    setError(message);
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
      setCompleted(true);
      onResult(result.data);
    }
    setScanning(false);
  }

  function startNewSession() {
    setFile(null);
    setError(null);
    setCompleted(false);
    onReset?.();
  }

  return (
    <div className={`default-radius ${completed ? "border-2 border-gray-50 p-4" : "bg-gray-50 md:p-8 p-4"}`}>
      {completed && file ? (
        <label className="block text-lg font-semibold text-gray-600 mb-4">
          Uploaded file
        </label>
      ) : (
        <label className="block text-lg font-semibold text-gray-600 mb-4">
          Upload a file to scan for vulnerabilities
        </label>
      )}

      {completed && file ? (
        <UploadedFileCard file={file} onRemove={startNewSession} />
      ) : (
        <FileDropzone
          accept={ACCEPTED_FILE_TYPES}
          file={file}
          onFileSelected={handleFileSelected}
          onFileRejected={handleFileRejected}
        />
      )}

      <div className="mt-4 flex md:flex-row flex-col gap-4 justify-between">
        <p className="text-xs text-gray-400">
          {completed
            ? "Remove the file above to upload a different one, or start a new session."
            : "Supported file types: .zip, .py, .js, .ts, .go, .rs, .cpp, .c, .h, .hpp, .java, .rb, .cs, .yaml, .yml, .toml, .json, .cfg, .conf, .pem, .crt, .cer"}
        </p>
        {completed ? (
          <LRButton
            variant="secondary"
            icon={<MdRefresh className="text-lg" />}
            onClick={startNewSession}
          >
            Start new session
          </LRButton>
        ) : (
          <LRButton
            variant="primary"
            icon={<MdSearch className="text-lg" />}
            onClick={startScan}
            disabled={!file || scanning}
          >
            {scanning ? "Scanning…" : "Upload & start qSearch"}
          </LRButton>
        )}
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
