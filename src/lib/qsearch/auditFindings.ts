// A domain audit's results as findings, so they feed the same fix plan as a
// code scan. Pure: runs in the browser.

import type { DomainAudit } from "./domainAudit";
import type { FixFinding } from "./fixes";

const RSA_DNSSEC = /^RSA\//;

export function auditFindings(audit: DomainAudit): FixFinding[] {
  const out: FixFinding[] = [];
  const base = { confidence: "high", detail: "" };

  for (const { host, check } of audit.hosts ?? []) {
    if (!check) continue;
    const where = `tls://${host}:443`;
    const kx = check.keyExchange;
    if (kx !== "X25519MLKEM768") {
      const dh = /^DH-(\d+)$/.exec(kx);
      out.push({
        ...base,
        algorithm: dh ? "DH" : kx,
        keyBits: dh ? Number(dh[1]) : null,
        classification: "quantum-vulnerable",
        service: "key establishment (TLS)",
        asset: where,
        evidence: where,
      });
    }
    const leaf = check.chain[0];
    if (leaf) {
      out.push({
        ...base,
        algorithm: leaf.keyAlgorithm,
        classification: leaf.keyAlgorithm.startsWith("ML-") ? "pqc-ready" : "quantum-vulnerable",
        service: "authentication (X.509 certificate)",
        asset: where,
        evidence: `sha256:${leaf.fingerprint}`,
        certificate: { notValidAfter: leaf.notValidAfter },
      });
    }
  }

  for (const key of audit.dkim ?? []) {
    if (key.algorithm === "revoked") continue;
    const where = `dns://${key.selector}._domainkey.${audit.domain}`;
    out.push({
      ...base,
      algorithm: key.algorithm,
      keyBits: key.bits,
      classification: "quantum-vulnerable",
      service: "DKIM email signing",
      asset: where,
      evidence: where,
    });
  }

  for (const key of audit.dnssec?.keys ?? []) {
    const where = `dns://${audit.domain}`;
    const algorithm = RSA_DNSSEC.test(key.algorithm)
      ? key.bits
        ? `RSA-${key.bits}`
        : "RSA"
      : key.algorithm.startsWith("ECDSA")
        ? `ECDSA/ECDH ${key.algorithm.slice("ECDSA ".length)}`
        : key.algorithm;
    out.push({
      ...base,
      algorithm,
      keyBits: key.bits,
      classification: "quantum-vulnerable",
      service: "DNSSEC zone signing",
      asset: where,
      evidence: where,
      // The fix plan treats SHA-1 based algorithms as broken today.
      detail: key.algorithm.includes("SHA-1") ? "DNSSEC algorithm uses SHA-1" : "",
    });
  }
  return out;
}