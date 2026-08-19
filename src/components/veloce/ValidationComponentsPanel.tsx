import SectionPanel from "@/components/ui/SectionPanel";

// Validation-components panel: the list of validation components (FIPS module,
// entropy source, PQC provider) with a status dot, name, and detail. Header
// sits outside the gray box (cloud-platform pattern). Rendered here as empty
// placeholder rows awaiting live agent evidence.

const PLACEHOLDER_ITEMS = [
  { name: "FIPS module", detail: "Pre-load SHA-256 verification and module status" },
  { name: "Entropy source", detail: "wolfEntropy RCT/APT health, fail-closed" },
  { name: "PQC provider", detail: "ML-KEM-768 + ML-DSA-65 self-test" },
];

export default function ValidationComponentsPanel() {
  return (
    <SectionPanel
      title="Validation components"
      action={
        <span className="text-2xs font-semibold uppercase tracking-wider text-[var(--brand-tertiary)]">
          No live data
        </span>
      }
    >
      {PLACEHOLDER_ITEMS.map((item) => (
        <div
          key={item.name}
          className="grid grid-cols-[10px_1fr_auto] items-start gap-3 border-b-2 border-gray-100 py-4 first:pt-0 last:border-b-0 last:pb-0"
        >
          <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-gray-200" />
          <div>
            <strong className="block text-sm font-medium">{item.name}</strong>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              {item.detail}
            </p>
          </div>
          <code className="text-2xs text-gray-400">—</code>
        </div>
      ))}
    </SectionPanel>
  );
}
