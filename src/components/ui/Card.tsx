import type { ReactNode } from "react";

// Generic surface for panels, boxes, and grouped content across the PQC
// platform. Light theme, sharp corners (default-radius = 2px), thin gray
// border — matches WelcomePageCard / PagePlaceholder so every box reads the
// same. `as` lets callers render it as <article>, <section>, etc.
export default function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return (
    <Tag
      className={`default-radius border border-gray-100 bg-white p-6 ${className}`}
    >
      {children}
    </Tag>
  );
}
