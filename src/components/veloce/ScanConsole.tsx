"use client";

import { useState } from "react";
import { MdFolderOpen, MdSearch } from "react-icons/md";
import LRButton from "@/components/ui/LRButton";

// qSearch discovery console: folder input + Choose folder / Start qSearch
// actions. The progress row is hidden until a scan is running. Buttons are
// inert in this shell beyond toggling the scanning state — wire them to the
// qSearch job endpoints later.
export default function ScanConsole() {
  const [scanning, setScanning] = useState(false);

  return (
    <div className="default-radius border border-gray-100 bg-gray-50 p-6">
      <label htmlFor="scan-path" className="block text-xs text-gray-500">
        Folder to scan
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="scan-path"
          type="text"
          placeholder="Choose a project folder"
          autoComplete="off"
          className="min-w-0 flex-1 px-3 py-2 text-sm"
        />
        <LRButton
          variant="secondary-outline"
          icon={<MdFolderOpen className="text-lg" />}
        >
          Choose folder
        </LRButton>
        <LRButton
          variant="primary"
          icon={<MdSearch className="text-lg" />}
          onClick={() => setScanning(true)}
        >
          Start qSearch
        </LRButton>
      </div>

      {/* Progress row — only rendered while a scan is running. */}
      {scanning && (
        <div
          aria-live="polite"
          className="default-radius mt-5 flex items-center gap-4 border border-gray-100 bg-white p-5 text-sm text-gray-500"
        >
          <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-gray-200 border-t-[var(--brand-primary)]" />
          <span>Scanning…</span>
        </div>
      )}
    </div>
  );
}
