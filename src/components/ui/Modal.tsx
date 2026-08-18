"use client";

import { useEffect } from "react";
import { MdClose } from "react-icons/md";
import type { ReactNode } from "react";

// Reusable modal shell for the PQC platform. Controlled via `open` / `onClose`.
// Renders a dimmed backdrop and a centered white panel (sharp corners, thin
// border, brand-consistent). Closes on backdrop click and Escape. Body is
// whatever children you pass — an empty shell until content is wired in.
export default function Modal({
  open,
  onClose,
  title,
  eyebrow,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in default-radius w-full max-w-lg border border-gray-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <div>
            {eyebrow && (
              <p className="color-brand-primary font-mono text-2xs font-bold uppercase tracking-[0.2em]">
                {eyebrow}
              </p>
            )}
            <h2 className="mt-1 text-lg font-medium">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="default-radius p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <MdClose className="text-xl" />
          </button>
        </div>

        <div className="px-6 py-5">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
