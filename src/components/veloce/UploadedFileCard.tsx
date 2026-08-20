"use client";

import { MdClose, MdInsertDriveFile } from "react-icons/md";

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export default function UploadedFileCard({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  return (
    <div className="default-radius flex items-center justify-between gap-4 border border-gray-100 bg-gray-100 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <MdInsertDriveFile className="shrink-0 text-2xl color-brand-primary" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-700">{file.name}</p>
          <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove file"
        className="default-radius cursor-pointer shrink-0 p-1.5 text-gray-500 transition-colors hover:text-gray-300"
      >
        <MdClose className="text-lg" />
      </button>
    </div>
  );
}
