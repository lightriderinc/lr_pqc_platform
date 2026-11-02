// Test Vector Check: logic only. Settings live in testVectorConfig.ts.
//
// Runs NIST's official ACVP test vectors (built by scripts/build-pqc-vectors.mjs)
// against the @noble/post-quantum library this site uses. Each test passes only
// when the computed output matches NIST's expected output byte for byte, or,
// for verification tests, when the accept/reject decision matches NIST's.
// A test that throws counts as failed. A function this app cannot run is
// reported as skipped, never as passed. Everything runs in the browser.

import { concatBytes, hexToBytes } from "@noble/hashes/utils.js";
import { ml_dsa44, ml_dsa65, ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import { ml_kem1024, ml_kem512, ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { FUNCTIONS, TAMPER_MASK, TESTS_PER_PAUSE, TEXT, VECTOR_FORMAT, type FunctionId } from "./testVectorConfig";

/** Error with a message that is safe to show to the user. */
export class VectorError extends Error {}

export type VectorTest = { tcId: number } & Record<string, string | number | boolean>;

export interface VectorGroup {
  parameterSet: string;
  tests: VectorTest[];
}

export interface VectorFunction {
  id: string;
  groups: VectorGroup[];
}

export interface VectorFile {
  format: string;
  source: { name: string; page: string; retrieved: string; files: { folder: string; url: string; sha256: string }[] };
  library: { name: string; version: string };
  functions: VectorFunction[];
}

/** Checks the loaded file has the shape this app expects. */
export function parseVectorFile(data: unknown): VectorFile {
  const f = data as VectorFile;
  const ok =
    f !== null &&
    typeof f === "object" &&
    f.format === VECTOR_FORMAT &&
    Array.isArray(f.functions) &&
    f.functions.every((fn) => typeof fn.id === "string" && Array.isArray(fn.groups)) &&
    typeof f.source?.name === "string" &&
    typeof f.library?.version === "string";
  if (!ok) throw new VectorError(TEXT.wrongFormat);
  return f;
}

/* ---------- algorithms ---------- */

const KEM = { "ML-KEM-512": ml_kem512, "ML-KEM-768": ml_kem768, "ML-KEM-1024": ml_kem1024 };
const DSA = { "ML-DSA-44": ml_dsa44, "ML-DSA-65": ml_dsa65, "ML-DSA-87": ml_dsa87 };

function pick<T>(table: Record<string, T>, set: string): T {
  if (!Object.hasOwn(table, set)) throw new VectorError(`Unknown parameter set ${set}.`);
  return table[set];
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Copy of the bytes with one bit of the first byte flipped (see TAMPER_MASK). */
export function flipOneBit(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 0) throw new VectorError("Cannot flip a bit in an empty input.");
  const out = Uint8Array.from(bytes);
  out[0] ^= TAMPER_MASK;
  return out;
}

/**
 * Reads one hex field of a test. When tamper is on and the field is this
 * function's tamper field, one bit is flipped.
 */
function reader(id: FunctionId, test: VectorTest, tamper: boolean) {
  return (field: string): Uint8Array => {
    const value = test[field];
    if (typeof value !== "string") throw new VectorError(`Test ${test.tcId} has no field "${field}".`);
    const bytes = hexToBytes(value);
    return tamper && field === FUNCTIONS[id].tamperField ? flipOneBit(bytes) : bytes;
  };
}

type Runner = (set: string, get: (field: string) => Uint8Array, test: VectorTest) => boolean;

const RUNNERS: Record<FunctionId, Runner> = {
  "ml-kem-keygen": (set, get) => {
    const kp = pick(KEM, set).keygen(concatBytes(get("d"), get("z")));
    return same(kp.publicKey, get("ek")) && same(kp.secretKey, get("dk"));
  },
  "ml-kem-encaps": (set, get) => {
    const r = pick(KEM, set).encapsulate(get("ek"), get("m"));
    return same(r.cipherText, get("c")) && same(r.sharedSecret, get("k"));
  },
  "ml-kem-decaps": (set, get) => same(pick(KEM, set).decapsulate(get("c"), get("dk")), get("k")),
  "ml-dsa-keygen": (set, get) => {
    const kp = pick(DSA, set).keygen(get("seed"));
    return same(kp.publicKey, get("pk")) && same(kp.secretKey, get("sk"));
  },
  "ml-dsa-siggen": (set, get) => {
    const sig = pick(DSA, set).sign(get("message"), get("sk"), { context: get("context"), extraEntropy: false });
    return same(sig, get("signature"));
  },
  "ml-dsa-sigver": (set, get, test) => {
    let accepted: boolean;
    try {
      accepted = pick(DSA, set).verify(get("signature"), get("message"), get("pk"), { context: get("context") });
    } catch {
      accepted = false; // an invalid signature may be rejected by throwing
    }
    return accepted === test.testPassed;
  },
};

const isKnown = (id: string): id is FunctionId => Object.hasOwn(RUNNERS, id);

/* ---------- running ---------- */

export interface TestResult {
  functionId: FunctionId;
  parameterSet: string;
  tcId: number;
  pass: boolean;
  /** True for verification tests where NIST expects the signature to be rejected. */
  expectsRejection: boolean;
  reason?: string;
}

export interface RunOutcome {
  results: TestResult[];
  /** Function ids in the file that this app cannot run. Never counted as passed. */
  skipped: string[];
}

export class RunCancelled extends Error {}

/** Number of tests in the file that this app will actually run. */
export function runnableCount(file: VectorFile): number {
  return file.functions
    .filter((f) => isKnown(f.id))
    .reduce((n, f) => n + f.groups.reduce((m, g) => m + g.tests.length, 0), 0);
}

export async function runVectors(
  file: VectorFile,
  tamper: boolean,
  onResult: (r: TestResult) => void,
  isCancelled: () => boolean,
): Promise<RunOutcome> {
  const results: TestResult[] = [];
  const skipped: string[] = [];
  let sincePause = 0;

  for (const fn of file.functions) {
    if (!isKnown(fn.id)) {
      skipped.push(fn.id);
      continue;
    }
    const id = fn.id;
    for (const group of fn.groups) {
      for (const test of group.tests) {
        let pass: boolean;
        try {
          pass = RUNNERS[id](group.parameterSet, reader(id, test, tamper), test);
        } catch {
          pass = false; // an error is a failure, never a pass
        }
        const r: TestResult = {
          functionId: id,
          parameterSet: group.parameterSet,
          tcId: test.tcId,
          pass,
          expectsRejection: id === "ml-dsa-sigver" && test.testPassed === false,
          reason: typeof test.reason === "string" ? test.reason : undefined,
        };
        results.push(r);
        onResult(r);
        if (++sincePause >= TESTS_PER_PAUSE) {
          sincePause = 0;
          if (isCancelled()) throw new RunCancelled();
          await new Promise<void>((res) => setTimeout(res, 0));
        }
      }
    }
  }
  return { results, skipped };
}