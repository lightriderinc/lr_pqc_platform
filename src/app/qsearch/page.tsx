import ScanConsole from "@/components/veloce/ScanConsole";
import ScanResults from "@/components/veloce/ScanResults";

// qSearch discovery shell — the scan console plus the results layout, ported
// into the PQC platform brand. Empty boxes/cards/table/modal awaiting a real
// qSearch run.
export default function QSearchPage() {
  return (
    <div className="animate-fade-in-up">
      <h1 className="text-2xl font-semibold">qSearch discovery</h1>
      <p className="mb-6 text-sm text-gray-600">
        Discover quantum-vulnerable cryptography across a codebase.
      </p>

      <ScanConsole />
      <ScanResults />
    </div>
  );
}
