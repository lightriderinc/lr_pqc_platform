"use client";

import type { DragEvent } from "react";
import { useRef, useState } from "react";
import { ImUpload3 } from "react-icons/im";
import { MdInsertDriveFile } from "react-icons/md";
import { formatFileSize } from "./UploadedFileCard";

function isFileAccepted(file: File, accept: string): boolean {
  const rules = accept
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);

  if (rules.length === 0) return true;

  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  return rules.some((rule) => {
    if (rule.startsWith(".")) return fileName.endsWith(rule);
    if (rule.endsWith("/*")) return mimeType.startsWith(rule.slice(0, -1));
    return mimeType === rule;
  });
}

export default function FileDropzone({
  accept,
  file,
  onFileSelected,
  onFileRejected,
}: {
  accept: string;
  file?: File | null;
  onFileSelected: (file: File) => void;
  onFileRejected?: (message: string) => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function selectFile(candidate: File) {
    if (isFileAccepted(candidate, accept)) {
      onFileSelected(candidate);
    } else {
      onFileRejected?.(`"${candidate.name}" is not a supported file type.`);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) selectFile(dropped);
  }

  return (
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
      className={`default-radius cursor-pointer border border-dashed px-4 py-32 text-center transition-colors ${
        dragActive
          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
          : "border-gray-200 bg-white hover:border-[var(--brand-primary-light)] hover:bg-[var(--brand-primary)]/5"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) selectFile(selected);
          e.target.value = "";
        }}
      />
      <div
        className={`mb-3 flex justify-center text-3xl transition-colors ${
          dragActive ? "text-[var(--brand-primary)]" : "text-gray-300"
        }`}
      >
        {file ? <MdInsertDriveFile /> : <ImUpload3 />}
      </div>
      {file ? (
        <>
          <p className="text-sm font-medium text-gray-700">{file.name}</p>
          <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
        </>
      ) : (
        <p className="text-sm text-gray-500">
          <span className="color-brand-primary font-medium">Click to browse</span>{" "}
          or drag and drop your file here.
        </p>
      )}
    </div>
  );
}
