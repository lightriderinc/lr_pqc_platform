import StatCard from "@/components/ui/StatCard";
import BuildIdentityPanel from "@/components/veloce/BuildIdentityPanel";
import FipsAssuranceHero from "@/components/veloce/FipsAssuranceHero";
import ValidationComponentsPanel from "@/components/veloce/ValidationComponentsPanel";

// Dashboard shell — Veloce's FIPS/PQC runtime view. Empty boxes/cards/modal
// awaiting live agent data.
export default function Home() {
  return (
    <div className="animate-fade-in-up">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mb-6 text-sm text-gray-600">
        Light Rider post-quantum cryptography platform.
      </p>

      <div className="mt-6 grid gap-5">
        <FipsAssuranceHero />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Approved mode"
            sub="Awaiting live status"
            accent="warn"
          />
          <StatCard label="FIPS module" sub="Certificate and version" />
          <StatCard label="Entropy" sub="Fail-closed source health" />
          <StatCard label="PQC provider" sub="ML-KEM-768 + ML-DSA-65" />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <ValidationComponentsPanel />
          <BuildIdentityPanel />
        </div>
      </div>
    </div>
  );
}
