import type { ReactNode } from "react";

// Centered empty-state / call-to-action panel. Dashed gray box with an optional
// icon, a headline, supporting copy, and an optional action. Reuse anywhere a
// section has no data yet.
export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="default-radius border border-dashed border-gray-200 bg-gray-50 px-4 py-16 text-center">
      {icon && (
        <div className="mb-4 flex justify-center text-4xl text-gray-300">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
          {description}
        </p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
