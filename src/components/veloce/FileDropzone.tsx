"use client";

import type { DragEvent } from "react";
import { useRef, useState } from "react";
import { ImUpload3 } from "react-icons/im";

export default function FileDropzone({
  accept,
  fileName,
  onFileSelected,
}: {
  accept: string;
  fileName?: string | null;
  onFileSelected: (file: File) => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFileSelected(dropped);
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
          if (selected) onFileSelected(selected);
        }}
      />
      <div
        className={`mb-3 flex justify-center text-3xl transition-colors ${
          dragActive ? "text-[var(--brand-primary)]" : "text-gray-300"
        }`}
      >
        <ImUpload3 />
      </div>
      {fileName ? (
        <p className="text-sm font-medium text-gray-700">{fileName}</p>
      ) : (
        <p className="text-sm text-gray-500">
          <span className="color-brand-primary font-medium">Click to browse</span>{" "}
          or drag and drop your file here.
        </p>
      )}
    </div>
  );
}
