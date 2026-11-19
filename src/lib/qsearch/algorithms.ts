// What each algorithm name qSearch reports means: its CycloneDX primitive,
// key size, curve and NIST quantum security level. Pure data and logic, used
// on the server (key sizes) and in the browser (CBOM export).
//
// Sources: FIPS 203 and 204 (ML-KEM and ML-DSA security categories), FIPS 186-5
// (curves), CycloneDX 1.6 cryptoProperties. Curve names follow the naming
// CycloneDX recommends (neuromancer.sk/std).

export type Primitive =
  | "signature"
  | "pke"
  | "kem"
  | "key-agree"
  | "hash"
  | "block-cipher"
  | "stream-cipher"
  | "unknown";

export interface AlgorithmInfo {
  /** Base name, for example "RSA", "ECDSA/ECDH" or "ML-KEM". */
  family: string;
  primitive: Primitive;
  keyBits: number | null;
  /** CycloneDX parameterSetIdentifier, for example "2048", "768" or "65". */
  parameterSet: string | null;
  curve: string | null;
  /** NIST security category 0 to 5; 0 means none is met. Null when unknown. */
  quantumLevel: number | null;
}

/** Curve aliases found in names and code, mapped to one name and key size. */
export const CURVES: { pattern: RegExp; name: string; label: string; bits: number }[] = [
  { pattern: /\b(?:secp256r1|prime256v1|p-?256|nistp256)\b/i, name: "nist/P-256", label: "P-256", bits: 256 },
  { pattern: /\b(?:secp384r1|p-?384|nistp384)\b/i, name: "nist/P-384", label: "P-384", bits: 384 },
  { pattern: /\b(?:secp521r1|p-?521|nistp521)\b/i, name: "nist/P-521", label: "P-521", bits: 521 },
  { pattern: /\bsecp256k1\b/i, name: "secg/secp256k1", label: "secp256k1", bits: 256 },
];

/** RSA, DSA and DH sizes accepted when read from a line of code. */
export const STANDARD_KEY_BITS = [512, 768, 1024, 1536, 2048, 3072, 4096, 6144, 7680, 8192, 15360, 16384];

/** FIPS 203 and 204 security categories by parameter set. */
const ML_KEM_LEVELS: Record<string, number> = { "512": 1, "768": 3, "1024": 5 };
const ML_DSA_LEVELS: Record<string, number> = { "44": 2, "65": 3, "87": 5 };

/** RSA and elliptic-curve primitives depend on what the key is used for. */
function byService(service: string, establish: Primitive): Primitive {
  const signs = /signature|authentication/i.test(service);
  const establishes = /key establishment|encrypted connection|encrypt/i.test(service);
  if (signs && !establishes) return "signature";
  if (establishes && !signs) return establish;
  return "unknown";
}

const info = (family: string, primitive: Primitive, rest: Partial<AlgorithmInfo> = {}): AlgorithmInfo => ({
  family,
  primitive,
  keyBits: null,
  parameterSet: null,
  curve: null,
  quantumLevel: null,
  ...rest,
});

/**
 * Describes an algorithm from the name qSearch reports, its service, and a
 * parameter set found elsewhere (in the code or a certificate), if any.
 * Returns null for names that are not an algorithm, such as libraries.
 */
export function describeAlgorithm(name: string, service = "", found: { keyBits?: number | null; parameterSet?: string | null } = {}): AlgorithmInfo | null {
  // "SSH host key: RSA" names the key type after the prefix.
  const n = name.trim().replace(/^SSH host key:\s*/i, "");
  let m: RegExpMatchArray | null;

  if (/X25519MLKEM768/i.test(n)) {
    // Hybrid: its post-quantum strength comes from ML-KEM-768.
    return info("X25519MLKEM768", "kem", { quantumLevel: 3 });
  }
  if (/^ML-KEM|^Kyber/i.test(n)) {
    const set = (m = n.match(/(512|768|1024)/)) ? m[1] : (found.parameterSet ?? null);
    return info("ML-KEM", "kem", { parameterSet: set, quantumLevel: set ? (ML_KEM_LEVELS[set] ?? null) : null });
  }
  if (/^ML-DSA|^Dilithium/i.test(n)) {
    const set = (m = n.match(/-(44|65|87)\b/)) ? m[1] : (found.parameterSet ?? null);
    return info("ML-DSA", "signature", { parameterSet: set, quantumLevel: set ? (ML_DSA_LEVELS[set] ?? null) : null });
  }
  if (/^SLH-DSA|^SPHINCS/i.test(n)) return info("SLH-DSA", "signature");

  if (/^RSA/i.test(n) && !/^RSA\/EC/i.test(n)) {
    const bits = (m = n.match(/^RSA-(\d{3,5})$/)) ? Number(m[1]) : (found.keyBits ?? null);
    return info("RSA", byService(service, "pke"), { keyBits: bits, parameterSet: bits ? String(bits) : null, quantumLevel: 0 });
  }
  if (/^ECDSA|^EC \(|^ECDH/i.test(n)) {
    const curve = CURVES.find((c) => c.pattern.test(n)) ?? CURVES.find((c) => c.label === found.parameterSet);
    return info("ECDSA/ECDH", byService(service, "key-agree"), {
      keyBits: curve?.bits ?? null,
      parameterSet: curve?.label ?? null,
      curve: curve?.name ?? null,
      quantumLevel: 0,
    });
  }
  if (/^RSA\/EC/i.test(n)) {
    // Library key generation that may be RSA or EC; keep what the code showed.
    return info("RSA/EC", "unknown", { keyBits: found.keyBits ?? null, parameterSet: found.parameterSet ?? null, quantumLevel: 0 });
  }
  if (/^Ed25519/i.test(n)) return info("Ed25519", "signature", { keyBits: 256, curve: "other/Ed25519", quantumLevel: 0 });
  if (/^Ed448/i.test(n)) return info("Ed448", "signature", { keyBits: 456, curve: "other/Ed448", quantumLevel: 0 });
  if (/^X25519$/i.test(n)) return info("X25519", "key-agree", { keyBits: 256, curve: "other/Curve25519", quantumLevel: 0 });
  if (/^X448$/i.test(n)) return info("X448", "key-agree", { keyBits: 448, curve: "other/Curve448", quantumLevel: 0 });
  if (/^DH$|^Diffie/i.test(n)) {
    const bits = found.keyBits ?? null;
    return info("DH", "key-agree", { keyBits: bits, parameterSet: bits ? String(bits) : null, quantumLevel: 0 });
  }
    if (/^DSA(-\d{3,5})?$/i.test(n)) {
    const bits = (m = n.match(/^DSA-(\d{3,5})$/i)) ? Number(m[1]) : (found.keyBits ?? null);
    return info("DSA", "signature", { keyBits: bits, parameterSet: bits ? String(bits) : null, quantumLevel: 0 });
  }
  // Broken today, with no quantum computer.
  if (/^3DES|^TDEA|^Triple/i.test(n)) return info("3DES", "block-cipher", { keyBits: 168, quantumLevel: 0 });
  if (/^DES$/i.test(n)) return info("DES", "block-cipher", { keyBits: 56, quantumLevel: 0 });
  if (/^RC4/i.test(n)) return info("RC4", "stream-cipher", { quantumLevel: 0 });
  if (/^MD5|^MD4/i.test(n)) return info(n.slice(0, 3).toUpperCase(), "hash", { quantumLevel: 0 });
  if (/^SHA-?1$/i.test(n)) return info("SHA-1", "hash", { quantumLevel: 0 });
  return null;
}

/** Short key size for display: "2048 bits", "P-256" or "ML-KEM-768". */
export function keyLabel(f: { algorithm: string; keyBits?: number | null; parameterSet?: string | null }): string | null {
  const family = describeAlgorithm(f.algorithm)?.family;
  if (family === "X25519MLKEM768") return "X25519 + ML-KEM-768";
  if ((family === "ML-KEM" || family === "ML-DSA") && f.parameterSet) return `${family}-${f.parameterSet}`;
  if (f.parameterSet && !/^\d+$/.test(f.parameterSet)) return f.parameterSet;
  return f.keyBits ? `${f.keyBits} bits` : null;
}