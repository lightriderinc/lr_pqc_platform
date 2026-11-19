// Adds key sizes to qSearch findings from the scanned files themselves:
// the line of code each finding points to, or the certificate it names.
// Server only: reads the uploaded files before they are deleted.

import { X509Certificate } from "crypto";
import { readFile, stat } from "fs/promises";
import { isAbsolute, join, relative } from "path";
import { CURVES, STANDARD_KEY_BITS, describeAlgorithm } from "./algorithms";

/** qSearch skips files larger than this, so they are never read here. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;

export type KeySource = "algorithm" | "code" | "certificate";

export interface CertificateDetails {
  subject: string;
  issuer: string;
  notValidBefore: string;
  notValidAfter: string;
}

export interface KeyDetails {
  keyBits: number | null;
  parameterSet: string | null;
  keySource: KeySource | null;
  certificate: CertificateDetails | null;
}

interface FindingRef {
  algorithm: string;
  service: string;
  asset: string;
  evidence: string;
}

const NONE: KeyDetails = { keyBits: null, parameterSet: null, keySource: null, certificate: null };

/** Reads files inside root only, once each. Missing or unsafe paths give null. */
function fileReader(root: string) {
  const cache = new Map<string, Promise<Buffer | null>>();
  return (asset: string) => {
    if (!cache.has(asset)) {
      const path = join(root, asset);
      const rel = relative(root, path);
      const safe = rel && !rel.startsWith("..") && !isAbsolute(rel);
      cache.set(
        asset,
        safe
          ? stat(path)
              .then((s) => (s.isFile() && s.size <= MAX_FILE_BYTES ? readFile(path) : null))
              .catch(() => null)
          : Promise.resolve(null),
      );
    }
    return cache.get(asset)!;
  };
}

/** The one value of a kind on a line, or null when there is none or several. */
function only<T>(values: T[]): T | null {
  const distinct = [...new Set(values)];
  return distinct.length === 1 ? distinct[0] : null;
}

/** Key size or parameter set written on the line of code a finding points to. */
function fromCode(family: string, line: string): Pick<KeyDetails, "keyBits" | "parameterSet"> | null {
  if (family === "ML-KEM") {
    const set = only([...line.matchAll(/(?:ml[-_]?kem|kyber)[-_]?(512|768|1024)/gi)].map((m) => m[1]));
    return set ? { keyBits: null, parameterSet: set } : null;
  }
  if (family === "ML-DSA") {
    const dilithium: Record<string, string> = { "2": "44", "3": "65", "5": "87" };
    const set = only(
      [...line.matchAll(/ml[-_]?dsa[-_]?(44|65|87)|dilithium[-_]?([235])\b/gi)].map((m) => m[1] ?? dilithium[m[2]]),
    );
    return set ? { keyBits: null, parameterSet: set } : null;
  }
  if (family === "ECDSA/ECDH" || family === "RSA/EC") {
    const curve = only(CURVES.filter((c) => c.pattern.test(line)));
    if (curve) return { keyBits: curve.bits, parameterSet: curve.label };
  }
  if (["RSA", "RSA/EC", "DSA", "DH"].includes(family)) {
    const bits = only((line.match(/\b\d{3,5}\b/g) ?? []).map(Number).filter((n) => STANDARD_KEY_BITS.includes(n)));
    if (bits) return { keyBits: bits, parameterSet: String(bits) };
  }
  return null;
}

/** The certificate in this file whose SHA-256 fingerprint qSearch reported. */
function fromCertificate(file: Buffer, fingerprint: string): Omit<KeyDetails, "keySource"> | null {
  const text = file.toString("latin1");
  const blocks = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [file];
  for (const block of blocks) {
    let cert: X509Certificate;
    try {
      cert = new X509Certificate(block);
    } catch {
      continue;
    }
    if (cert.fingerprint256.replace(/:/g, "").toLowerCase() !== fingerprint) continue;
    // Node cannot read every key type yet (ML-DSA in Node 22, for example);
    // the certificate's details are still reported, with the size from its name.
    let key: { modulusLength?: number; namedCurve?: string } = {};
    try {
      key = cert.publicKey.asymmetricKeyDetails ?? {};
    } catch {
      /* unreadable key type */
    }
    const curve = key.namedCurve ? CURVES.find((c) => c.pattern.test(key.namedCurve!)) : undefined;
    const keyBits = key.modulusLength ?? curve?.bits ?? null;
    return {
      keyBits,
      parameterSet: curve?.label ?? (key.modulusLength ? String(key.modulusLength) : null),
      certificate: {
        subject: cert.subject.split("\n").join(", "),
        issuer: cert.issuer.split("\n").join(", "),
        notValidBefore: new Date(cert.validFrom).toISOString(),
        notValidAfter: new Date(cert.validTo).toISOString(),
      },
    };
  }
  return null;
}

/** Key details for each finding, in the same order. Never throws for one bad file. */
export async function keyDetails(findings: FindingRef[], root: string): Promise<KeyDetails[]> {
  const read = fileReader(root);
  return Promise.all(
    findings.map(async (f): Promise<KeyDetails> => {
      const known = describeAlgorithm(f.algorithm, f.service);
      if (!known) return NONE;
      // Sizes fixed by the algorithm name, such as "RSA-2048" or "X25519".
      const byName =
        known.keyBits || (known.parameterSet && known.family !== "RSA")
          ? { keyBits: known.keyBits, parameterSet: known.parameterSet, keySource: "algorithm" as const }
          : null;

      const cert = /^sha256:([0-9a-f]{64})$/i.exec(f.evidence);
      if (cert) {
        const file = await read(f.asset);
        const found = file ? fromCertificate(file, cert[1].toLowerCase()) : null;
        if (!found) return byName ? { ...byName, certificate: null } : NONE;
        return found.keyBits
          ? { ...found, keySource: "certificate" }
          : { ...found, keyBits: byName?.keyBits ?? null, parameterSet: byName?.parameterSet ?? null, keySource: byName ? "algorithm" : null };
      }
      if (byName) return { ...byName, certificate: null };

      const line = /^(.+):(\d+)$/.exec(f.evidence);
      const file = line ? await read(line[1]) : null;
      if (!line || !file) return NONE;
      const text = file.toString("utf8").split(/\r?\n/)[Number(line[2]) - 1] ?? "";
      const found = fromCode(known.family, text);
      return found ? { ...found, keySource: "code", certificate: null } : NONE;
    }),
  );
}