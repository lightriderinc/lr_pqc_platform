// Configuration for the PQC Speed Test.
//
// Every algorithm, default, timing setting, and piece of text lives here.
// speedTest.ts holds logic only. Implementations come from @noble/post-quantum
// and @noble/curves, which run in pure JavaScript in the visitor's browser.

export type Family = "kem" | "sig";
export type Kind = "classical" | "pqc";

export interface AlgorithmSpec {
  id: string;
  label: string;
  family: Family;
  kind: Kind;
  standard: string;
  /** Ticked when the test opens. Keep the default run short. */
  selectedByDefault: boolean;
}

export const ALGORITHMS: AlgorithmSpec[] = [
  { id: "x25519", label: "X25519", family: "kem", kind: "classical", standard: "RFC 7748", selectedByDefault: true },
  { id: "ml-kem-512", label: "ML-KEM-512", family: "kem", kind: "pqc", standard: "FIPS 203", selectedByDefault: false },
  { id: "ml-kem-768", label: "ML-KEM-768", family: "kem", kind: "pqc", standard: "FIPS 203", selectedByDefault: true },
  { id: "ml-kem-1024", label: "ML-KEM-1024", family: "kem", kind: "pqc", standard: "FIPS 203", selectedByDefault: false },
  { id: "x-wing", label: "X-Wing (X25519 + ML-KEM-768)", family: "kem", kind: "pqc", standard: "IETF draft", selectedByDefault: false },
  { id: "ed25519", label: "Ed25519", family: "sig", kind: "classical", standard: "RFC 8032", selectedByDefault: true },
  { id: "ecdsa-p256", label: "ECDSA P-256", family: "sig", kind: "classical", standard: "FIPS 186-5", selectedByDefault: false },
  { id: "ml-dsa-44", label: "ML-DSA-44", family: "sig", kind: "pqc", standard: "FIPS 204", selectedByDefault: false },
  { id: "ml-dsa-65", label: "ML-DSA-65", family: "sig", kind: "pqc", standard: "FIPS 204", selectedByDefault: true },
  { id: "ml-dsa-87", label: "ML-DSA-87", family: "sig", kind: "pqc", standard: "FIPS 204", selectedByDefault: false },
  { id: "slh-dsa-128f", label: "SLH-DSA-SHA2-128f", family: "sig", kind: "pqc", standard: "FIPS 205", selectedByDefault: false },
];

export const FAMILY_TITLES: Record<Family, string> = {
  kem: "Key exchange",
  sig: "Signatures",
};

/** Operation names shown for each family, in run order. */
export const OPERATIONS: Record<Family, { id: "keygen" | "op1" | "op2"; label: string }[]> = {
  kem: [
    { id: "keygen", label: "Key generation" },
    { id: "op1", label: "Encapsulate" },
    { id: "op2", label: "Decapsulate" },
  ],
  sig: [
    { id: "keygen", label: "Key generation" },
    { id: "op1", label: "Sign" },
    { id: "op2", label: "Verify" },
  ],
};

/** Size columns for each family: what one side sends to the other. */
export const SIZE_LABELS: Record<Family, { publicKey: string; output: string }> = {
  kem: { publicKey: "Public key", output: "Ciphertext" },
  sig: { publicKey: "Public key", output: "Signature" },
};

/** Headline comparisons. Each is shown only when both algorithms were run. */
export const HEADLINES = [
  { title: "Key exchange", pqc: "ml-kem-768", classical: "x25519" },
  { title: "Signatures", pqc: "ml-dsa-65", classical: "ed25519" },
];

export const TIMING = {
  /** Time spent measuring one operation, in milliseconds. */
  budgetMs: 300,
  /** A batch runs until it lasts at least this long, so coarse browser timers stay accurate. */
  minBatchMs: 5,
  /** Fewest batches per operation. Five gives a usable spread even for slow operations. */
  minSamples: 5,
  /** Most repetitions in one batch. */
  maxBatchSize: 1000,
  /**
   * Untimed calls before measuring, for at least this long. Browsers compile
   * JavaScript in stages, so a fixed number of calls is not enough: the first
   * run would partly measure the browser's compiler, not the algorithm.
   */
  warmupMs: 150,
};

/** Size of the message signed in each test, in bytes. */
export const MESSAGE_BYTES = 256;

export const HISTORY = {
  /** Runs are kept in sessionStorage, so they last until the browser tab closes. */
  storageKey: "lr:pqc-speed-test:runs:v1",
  maxRuns: 20,
};

export const TEXT = {
  algorithmColumn: "Algorithm",
  msUnit: (label: string) => `${label} (ms)`,
  bytesUnit: (label: string) => `${label} (B)`,
  msChange: (before: string, after: string) => `${before} → ${after} ms`,
  intro: "Benchmark post-quantum algorithms on this device.",
  privacy: "Everything runs in your browser. Nothing is sent anywhere.",
  run: "Run test",
  runAgain: "Run again",
  cancel: "Cancel",
  selectAll: "Select all",
  defaults: "Defaults",
  noneSelected: "Select at least one algorithm.",
  testing: (label: string) => `Testing ${label}`,
  measuredOn: (device: string) => `Measured on ${device}.`,
  today: "today",
  noise: "± shows how much the samples varied in this run.",
  headlineDetail: (pqc: string, classical: string, pqcMs: string, classicalMs: string, bytes: string) =>
    `${pqc} against ${classical}: ${pqcMs} ms against ${classicalMs} ms for a full cycle, and ${bytes}× the bytes.`,
  history: "Compare runs",
  historyHint: "Runs are kept until you close this browser tab.",
  runName: (n: number, time: string, count: number) => `Run ${n}, ${time}, ${count} algorithms`,
  before: "Before",
  after: "After",
  noOverlap: "These two runs have no algorithms in common.",
  clearHistory: "Clear history",
  copy: "Copy results",
  download: "Download JSON",
  note: "Pure JavaScript, measured in this browser. Native implementations such as wolfCrypt or liboqs are usually faster.",
  verdictFaster: "faster",
  verdictSlower: "slower",
  verdictSame: "no clear change",
};