// Turns sign-in provider and server check results into inventory rows a
// person can add with one click. Pure: runs in the browser.

import type { ProviderCheck } from "./identityProvider";
import type { AddedRow } from "./inventory";
import type { ServerCheck } from "./serverCheck";

export interface Suggestions {
  /** Quantum-vulnerable cryptography found, as rows ready to add. */
  rows: AddedRow[];
  /** What was found that is already post-quantum, so nothing needs adding. */
  safe: string[];
}

const keyCount = (n: number) => (n === 1 ? "1 key" : `${n} keys`);

/** One row per algorithm, use and size; the key ids go in the note. */
export function providerRows(check: ProviderCheck): Suggestions {
  const groups = new Map<string, { row: AddedRow; kids: string[] }>();
  const safe: string[] = [];
  for (const key of check.keys) {
    if (key.quantumSafe || !key.family) {
      safe.push(`${key.name} signing key${key.kid ? ` (${key.kid})` : ""}`);
      continue;
    }
    const id = `${key.family}|${key.service}|${key.keyLength}`;
    const group = groups.get(id) ?? {
      row: {
        algorithm: key.family,
        service: key.service,
        keyLength: key.keyLength,
        source: `Sign-in tokens (${check.host})`,
        note: "",
      },
      kids: [],
    };
    if (key.kid) group.kids.push(key.kid);
    groups.set(id, group);
  }
  const rows = [...groups.values()].map(({ row, kids }) => ({
    ...row,
    note: `Published ${kids.length ? keyCount(kids.length) : "key"}${kids.length ? `: ${kids.slice(0, 3).join(", ")}${kids.length > 3 ? "…" : ""}` : ""}`.slice(0, 300),
  }));
  return { rows, safe };
}

/** The key exchange a browser gets, and the server certificate's key. */
export function serverRows(check: ServerCheck): Suggestions {
  const source = `tls://${check.host}:${check.port}`;
  const rows: AddedRow[] = [];
  const safe: string[] = [];

  const kx = check.keyExchange;
  const exchange = (algorithm: AddedRow["algorithm"], keyLength: string): AddedRow => ({
    algorithm,
    service: "key establishment",
    keyLength,
    source,
    note: check.pqSupport === "available" ? "TLS key exchange; post-quantum supported but not chosen" : "TLS key exchange",
  });
  let m: RegExpMatchArray | null;
  if (kx === "X25519MLKEM768") safe.push("X25519MLKEM768 key exchange (post-quantum hybrid)");
  else if (kx === "X25519") rows.push(exchange("X25519", "256 bits"));
  else if (kx === "X448") rows.push(exchange("X448", "448 bits"));
  else if ((m = kx.match(/^ECDH (.+)$/))) rows.push(exchange("ECDSA/ECDH", m[1]));
  else if ((m = kx.match(/^DH-(\d+)$/))) rows.push(exchange("DH", `${m[1]} bits`));
  else if (kx === "DH") rows.push(exchange("DH", ""));
  else if (kx === "RSA key transport") rows.push(exchange("RSA", ""));

  const leaf = check.chain[0];
  if (leaf) {
    const cert = (algorithm: AddedRow["algorithm"], keyLength: string): AddedRow => ({
      algorithm,
      service: "digital signatures",
      keyLength,
      source,
      note: leaf.notValidAfter ? `TLS certificate, expires ${leaf.notValidAfter.slice(0, 10)}` : "TLS certificate",
    });
    const k = leaf.keyAlgorithm;
    if (k.startsWith("ML-") || k.startsWith("SLH-")) safe.push(`${k} certificate`);
    else if ((m = k.match(/^RSA-(\d+)$/))) rows.push(cert("RSA", `${m[1]} bits`));
    else if ((m = k.match(/^ECDSA\/ECDH (.+)$/))) rows.push(cert("ECDSA/ECDH", m[1]));
    else if (k === "Ed25519") rows.push(cert("Ed25519", "256 bits"));
    else if (k === "Ed448") rows.push(cert("Ed448", "456 bits"));
    else if ((m = k.match(/^DSA-(\d+)$/))) rows.push(cert("DSA", `${m[1]} bits`));
  }
  return { rows, safe };
}