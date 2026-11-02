// PQC Speed Test: logic only. Settings live in speedTestConfig.ts.
//
// Runs real implementations in the browser and measures them. Nothing is
// sent anywhere. Sizes are taken from the actual keys, ciphertexts, and
// signatures produced during the test, not from a table. Every timing comes
// with its measured noise, so comparisons never claim a difference the
// measurements cannot support.

import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { p256 } from "@noble/curves/nist.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { XWing } from "@noble/post-quantum/hybrid.js";
import { ml_dsa44, ml_dsa65, ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import { ml_kem1024, ml_kem512, ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { slh_dsa_sha2_128f } from "@noble/post-quantum/slh-dsa.js";
import { ALGORITHMS, HISTORY, MESSAGE_BYTES, OPERATIONS, TIMING, type AlgorithmSpec } from "./speedTestConfig";

export type Op = "keygen" | "op1" | "op2";

/** Prepared operations for one algorithm, plus the sizes they produce. */
interface Prepared {
  run: Record<Op, () => unknown>;
  sizes: { publicKey: number; output: number };
}

interface Kem {
  keygen: () => { publicKey: Uint8Array; secretKey: Uint8Array };
  encapsulate: (pk: Uint8Array) => { cipherText: Uint8Array; sharedSecret: Uint8Array };
  decapsulate: (ct: Uint8Array, sk: Uint8Array) => Uint8Array;
}

interface Sig {
  keygen: () => { publicKey: Uint8Array; secretKey: Uint8Array };
  sign: (msg: Uint8Array, sk: Uint8Array) => Uint8Array;
  verify: (sig: Uint8Array, msg: Uint8Array, pk: Uint8Array) => boolean;
}

function prepareKem(k: Kem): Prepared {
  const { publicKey, secretKey } = k.keygen();
  const { cipherText } = k.encapsulate(publicKey);
  return {
    run: {
      keygen: () => k.keygen(),
      op1: () => k.encapsulate(publicKey),
      op2: () => k.decapsulate(cipherText, secretKey),
    },
    sizes: { publicKey: publicKey.length, output: cipherText.length },
  };
}

/** X25519 is a key agreement, so "encapsulate" means: new ephemeral key plus shared secret. */
function prepareX25519(): Prepared {
  const receiver = x25519.keygen();
  const sender = x25519.keygen();
  return {
    run: {
      keygen: () => x25519.keygen(),
      op1: () => {
        const eph = x25519.keygen();
        return x25519.getSharedSecret(eph.secretKey, receiver.publicKey);
      },
      op2: () => x25519.getSharedSecret(receiver.secretKey, sender.publicKey),
    },
    sizes: { publicKey: receiver.publicKey.length, output: sender.publicKey.length },
  };
}

function prepareSig(s: Sig): Prepared {
  const msg = randomBytes(MESSAGE_BYTES);
  const { publicKey, secretKey } = s.keygen();
  const signature = s.sign(msg, secretKey);
  if (!s.verify(signature, msg, publicKey)) throw new Error("Self-check failed: signature did not verify.");
  return {
    run: {
      keygen: () => s.keygen(),
      op1: () => s.sign(msg, secretKey),
      op2: () => s.verify(signature, msg, publicKey),
    },
    sizes: { publicKey: publicKey.length, output: signature.length },
  };
}

const PREPARE: Record<string, () => Prepared> = {
  x25519: prepareX25519,
  "ml-kem-512": () => prepareKem(ml_kem512),
  "ml-kem-768": () => prepareKem(ml_kem768),
  "ml-kem-1024": () => prepareKem(ml_kem1024),
  "x-wing": () => prepareKem(XWing),
  ed25519: () => prepareSig(ed25519),
  "ecdsa-p256": () => prepareSig(p256),
  "ml-dsa-44": () => prepareSig(ml_dsa44),
  "ml-dsa-65": () => prepareSig(ml_dsa65),
  "ml-dsa-87": () => prepareSig(ml_dsa87),
  "slh-dsa-128f": () => prepareSig(slh_dsa_sha2_128f),
};

/* ---------- timing ---------- */

const yieldToBrowser = () => new Promise<void>((r) => setTimeout(r, 0));

/** Value at fraction q (0..1) of sorted values, with linear interpolation. */
export function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export interface Measurement {
  /** Median milliseconds per call. */
  ms: number;
  /**
   * Noise as a fraction of the median: half the spread of the middle 50% of
   * samples. 0.04 means the typical sample was within about ±4%.
   */
  noise: number;
  samples: number;
}

/** Turns raw per-call timings into a median and its noise. */
export function summarise(samples: number[]): Measurement {
  const s = [...samples].sort((a, b) => a - b);
  const ms = quantile(s, 0.5);
  const noise = ms > 0 ? (quantile(s, 0.75) - quantile(s, 0.25)) / 2 / ms : 0;
  return { ms, noise, samples: s.length };
}

/**
 * Times fn in batches. Each batch lasts at least TIMING.minBatchMs, so coarse
 * browser timers stay accurate. Returns the median per-call time and its noise.
 */
export async function measure(fn: () => unknown, isCancelled: () => boolean): Promise<Measurement> {
  // Warm up for a fixed time, so the browser finishes optimising the code
  // before anything is measured. The last warm-up call also sizes the batches.
  // A slow operation reaches the time limit after a few calls.
  let single = 0;
  const warmupEnd = performance.now() + TIMING.warmupMs;
  do {
    const t0 = performance.now();
    fn();
    single = Math.max(performance.now() - t0, 0.001);
    if (isCancelled()) throw new SpeedTestCancelled();
  } while (performance.now() < warmupEnd);
  const batch = Math.min(TIMING.maxBatchSize, Math.max(1, Math.ceil(TIMING.minBatchMs / single)));

  const samples: number[] = [];
  const start = performance.now();
  while (samples.length < TIMING.minSamples || performance.now() - start < TIMING.budgetMs) {
    if (isCancelled()) throw new SpeedTestCancelled();
    const t = performance.now();
    for (let i = 0; i < batch; i++) fn();
    samples.push((performance.now() - t) / batch);
    await yieldToBrowser();
  }
  return summarise(samples);
}

export class SpeedTestCancelled extends Error {}

/* ---------- run ---------- */

export interface AlgorithmResult {
  id: string;
  label: string;
  family: AlgorithmSpec["family"];
  kind: AlgorithmSpec["kind"];
  standard: string;
  ops: Record<Op, Measurement>;
  sizes: { publicKey: number; output: number };
}

export interface Progress {
  done: number;
  total: number;
  label: string;
}

/** Specs for the given ids, in the configured order. Unknown ids are ignored. */
export function selectedSpecs(ids: string[]): AlgorithmSpec[] {
  const wanted = new Set(ids);
  return ALGORITHMS.filter((a) => wanted.has(a.id));
}

/**
 * Runs the selected algorithms. onResult is called as each algorithm
 * finishes, so the screen can show real results as they arrive.
 */
export async function runSpeedTest(
  ids: string[],
  onProgress: (p: Progress) => void,
  onResult: (r: AlgorithmResult) => void,
  isCancelled: () => boolean,
): Promise<AlgorithmResult[]> {
  const specs = selectedSpecs(ids);
  const total = specs.reduce((n, a) => n + OPERATIONS[a.family].length, 0);
  let done = 0;
  const results: AlgorithmResult[] = [];

  for (const spec of specs) {
    const prepared = PREPARE[spec.id]();
    const ops = {} as Record<Op, Measurement>;
    for (const op of OPERATIONS[spec.family]) {
      onProgress({ done, total, label: `${spec.label}: ${op.label.toLowerCase()}` });
      ops[op.id] = await measure(prepared.run[op.id], isCancelled);
      done++;
    }
    const result: AlgorithmResult = {
      id: spec.id,
      label: spec.label,
      family: spec.family,
      kind: spec.kind,
      standard: spec.standard,
      ops,
      sizes: prepared.sizes,
    };
    results.push(result);
    onResult(result);
  }
  onProgress({ done, total, label: "" });
  return results;
}

/* ---------- headline comparison within one run ---------- */

export interface Comparison {
  pqcTotal: number;
  classicalTotal: number;
  /** pqcTotal / classicalTotal. Below 1 means post-quantum was faster. */
  speedRatio: number;
  /** (pqc public key + output) / (classical public key + output). */
  sizeRatio: number;
}

const total = (r: AlgorithmResult) => r.ops.keygen.ms + r.ops.op1.ms + r.ops.op2.ms;
const bytes = (r: AlgorithmResult) => r.sizes.publicKey + r.sizes.output;

export function compare(results: AlgorithmResult[], pqcId: string, classicalId: string): Comparison | null {
  const p = results.find((r) => r.id === pqcId);
  const c = results.find((r) => r.id === classicalId);
  if (!p || !c) return null;
  return {
    pqcTotal: total(p),
    classicalTotal: total(c),
    speedRatio: total(p) / total(c),
    sizeRatio: bytes(p) / bytes(c),
  };
}

/** Text for a ratio, e.g. "2.4× slower" or "1.7× faster". */
export function ratioText(ratio: number): string {
  if (ratio >= 0.95 && ratio <= 1.05) return "about the same speed";
  return ratio > 1 ? `${ratio.toFixed(1)}× slower` : `${(1 / ratio).toFixed(1)}× faster`;
}

/* ---------- comparing two runs ---------- */

export type Verdict = "faster" | "slower" | "same";

export interface RunDiff {
  id: string;
  label: string;
  op: Op;
  beforeMs: number;
  afterMs: number;
  /** (after - before) / before. Negative means faster. */
  change: number;
  /** Combined noise of both measurements, as a fraction. */
  noise: number;
  verdict: Verdict;
}

/**
 * Compares every operation the two runs have in common. A change counts as
 * faster or slower only when it is larger than the noise of both runs added
 * together. Otherwise the honest answer is "no clear change".
 */
export function diffRuns(before: AlgorithmResult[], after: AlgorithmResult[]): RunDiff[] {
  const out: RunDiff[] = [];
  for (const a of after) {
    const b = before.find((r) => r.id === a.id);
    if (!b) continue;
    for (const op of OPERATIONS[a.family]) {
      const x = b.ops[op.id];
      const y = a.ops[op.id];
      const change = (y.ms - x.ms) / x.ms;
      const noise = x.noise + y.noise;
      out.push({
        id: a.id,
        label: a.label,
        op: op.id,
        beforeMs: x.ms,
        afterMs: y.ms,
        change,
        noise,
        verdict: Math.abs(change) <= noise ? "same" : change < 0 ? "faster" : "slower",
      });
    }
  }
  return out;
}

/* ---------- run history ---------- */

export interface RunRecord {
  id: string;
  at: string;
  device: string;
  results: AlgorithmResult[];
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function loadHistory(): RunRecord[] {
  try {
    const raw = storage()?.getItem(HISTORY.storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Saves the newest runs. Storage can be full or blocked; the test still works without it. */
export function saveHistory(runs: RunRecord[]): RunRecord[] {
  const kept = runs.slice(-HISTORY.maxRuns);
  try {
    storage()?.setItem(HISTORY.storageKey, JSON.stringify(kept));
  } catch {
    /* history is a convenience, never required */
  }
  return kept;
}

export function clearHistory(): void {
  try {
    storage()?.removeItem(HISTORY.storageKey);
  } catch {
    /* nothing to clear */
  }
}

/** Short description of the device, from what the browser reports. */
export function deviceSummary(): string {
  if (typeof navigator === "undefined") return "";
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || nav.platform || "this device";
  const n = nav.hardwareConcurrency;
  const cores = n ? `, ${n} logical ${n === 1 ? "core" : "cores"}` : "";
  return `${platform}${cores}`;
}