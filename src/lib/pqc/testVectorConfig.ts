// Configuration for the Test Vector Check.
//
// Every path, label, and piece of text lives here. testVectors.ts holds logic
// only. The vectors themselves come from NIST and are built by
// scripts/build-pqc-vectors.mjs, never typed by hand.

/** Where the built vector file is served from (the site's public folder). */
export const VECTOR_FILE = "/pqc-vectors/nist-acvp.json";
export const VECTOR_FORMAT = "lightrider-pqc-vectors/1";

/**
 * The tamper switch XORs this mask into the first byte of one input per test.
 * The top bit is used on purpose: NIST builds its "modified message" tests by
 * flipping low bits, so flipping a low bit can undo NIST's change and restore
 * the genuinely signed message. Checked against every verification test: the
 * top bit of the first byte restores none of them.
 */
export const TAMPER_MASK = 0x80;

/** Tests run between pauses, so the page stays responsive and tiles fill in live. */
export const TESTS_PER_PAUSE = 5;

export type FunctionId =
  | "ml-kem-keygen"
  | "ml-kem-encaps"
  | "ml-kem-decaps"
  | "ml-dsa-keygen"
  | "ml-dsa-siggen"
  | "ml-dsa-sigver";

export interface FunctionInfo {
  label: string;
  standard: string;
  /** The input field the tamper switch changes by one bit. */
  tamperField: string;
}

export const FUNCTIONS: Record<FunctionId, FunctionInfo> = {
  "ml-kem-keygen": { label: "ML-KEM key generation", standard: "FIPS 203", tamperField: "d" },
  "ml-kem-encaps": { label: "ML-KEM encapsulation", standard: "FIPS 203", tamperField: "m" },
  "ml-kem-decaps": { label: "ML-KEM decapsulation", standard: "FIPS 203", tamperField: "c" },
  "ml-dsa-keygen": { label: "ML-DSA key generation", standard: "FIPS 204", tamperField: "seed" },
  "ml-dsa-siggen": { label: "ML-DSA signing", standard: "FIPS 204", tamperField: "message" },
  "ml-dsa-sigver": { label: "ML-DSA verification", standard: "FIPS 204", tamperField: "message" },
};

export const TEXT = {
  intro: "Run NIST's official test vectors against this site's post-quantum library.",
  privacy: "Everything runs in your browser. Nothing is sent anywhere.",
  loading: "Loading NIST test vectors",
  loadFailed: "The test vector file could not be loaded.",
  wrongFormat: "The test vector file is not in the expected format. Rebuild it with scripts/build-pqc-vectors.mjs.",
  source: (name: string, date: string) => `Source: ${name}, retrieved ${date}.`,
  library: (name: string, version: string) => `Library: ${name} ${version} (installed when the vector file was built).`,
  sourceLink: "View on GitHub",
  totals: (n: number) => `${n.toLocaleString("en-US")} official tests`,
  tamper: "Flip one bit in each input",
  tamperNote: "Verification tests that expect a rejection still pass, because a tampered message is still rejected. Every other test should fail.",
  run: "Run tests",
  runAgain: "Run again",
  running: "Running",
  cancel: "Cancel",
  counts: (passed: number, total: number) => `${passed} / ${total} passed`,
  allPassed: (n: number) => `All ${n.toLocaleString("en-US")} tests passed.`,
  someFailed: (failed: number, total: number) => `${failed} of ${total.toLocaleString("en-US")} tests failed.`,
  testDetail: (tcId: number, set: string, pass: boolean) => `NIST test ${tcId}, ${set}: ${pass ? "passed" : "failed"}`,
  expectsRejection: "This test expects a rejection.",
  reason: (r: string) => `NIST note: ${r}.`,
  tileHint: "Select a tile to see the test.",
  disclaimer: "Passing shows the algorithms are implemented correctly. It is not a security certification.",
  unknownFunction: (id: string) => `Skipped: this app does not know how to run "${id}".`,
};