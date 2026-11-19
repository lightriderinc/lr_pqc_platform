// Network collector: connects to a server the way a browser does and reports
// the key exchange it negotiates and the certificates it presents.
// Server only. Nothing is sent after the handshake; each connection closes
// as soon as it is established.
//
// Two connections at most:
//   1. A browser-like offer: X25519MLKEM768 first, then classical groups.
//      Node reports no group name for ML-KEM hybrids, so a TLS 1.3 handshake
//      with no classical group means the hybrid was chosen.
//   2. Only if (1) settled on a classical group: X25519MLKEM768 alone, over
//      TLS 1.3 only, to see whether the server supports it but prefers less.

import { X509Certificate } from "crypto";
import { lookup } from "dns/promises";
import { BlockList, isIP } from "net";
import { checkServerIdentity, connect, type DetailedPeerCertificate, type TLSSocket } from "tls";

/** Ports where TLS starts immediately. STARTTLS ports (25, 587, 143) are not checked. */
export const TLS_PORTS = [443, 8443, 4443, 9443, 6443, 465, 636, 853, 993, 995, 5061];

const TIMEOUT_MS = 5000;
const PQ_GROUP = "X25519MLKEM768";
const BROWSER_GROUPS = `${PQ_GROUP}:X25519:P-256:P-384`;

export type PqSupport = "default" | "available" | "none" | "unknown";

export interface CertInfo {
  subject: string;
  issuer: string;
  /** For example "RSA-2048", "ECDSA/ECDH P-256", "Ed25519" or "ML-DSA-65". */
  keyAlgorithm: string;
  signatureAlgorithm: string;
  notValidBefore: string;
  notValidAfter: string;
  fingerprint: string;
}

export interface ServerCheck {
  host: string;
  port: number;
  address: string;
  checkedAt: string;
  protocol: string;
  cipher: string;
  /** What a browser offering post-quantum and classical groups gets. */
  keyExchange: string;
  pqSupport: PqSupport;
  trusted: boolean;
  trustProblem: string | null;
  chain: CertInfo[];
}

/** Error with a message that is safe to show to the user. */
export class CheckError extends Error {}

// ---------- target validation ----------

/** Addresses the website must never connect to: private, local and reserved ranges. */
const BLOCKED = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  BLOCKED.addSubnet(net, bits, "ipv4");
}
for (const [net, bits] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  BLOCKED.addSubnet(net, bits, "ipv6");
}

export function isBlockedAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return BLOCKED.check(mapped[1], "ipv4");
  const family = isIP(address);
  if (family === 4) return BLOCKED.check(address, "ipv4");
  if (family === 6) return BLOCKED.check(address, "ipv6");
  return true;
}

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Hostname and port from what the user typed: "example.com", "example.com:8443" or a URL. */
export function parseTarget(input: string, portInput?: number): { host: string; port: number } {
  let text = input.trim().toLowerCase();
  if (!text) throw new CheckError("Enter a hostname, such as example.com.");
  if (text.length > 300) throw new CheckError("That hostname is too long.");
  let port = portInput;
  if (!text.includes("://")) text = `https://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new CheckError("That is not a valid hostname.");
  }
  if (url.port) port = Number(url.port);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!isIP(host) && !HOSTNAME.test(host)) throw new CheckError("That is not a valid hostname.");
  port ??= 443;
  if (!TLS_PORTS.includes(port)) {
    throw new CheckError(`Port ${port} cannot be checked. Use one of: ${TLS_PORTS.join(", ")}.`);
  }
  return { host, port };
}

/** The public address to connect to. Refused if any address the name resolves to is private. */
async function resolvePublic(host: string): Promise<string> {
  let addresses: string[];
  if (isIP(host)) addresses = [host];
  else {
    try {
      addresses = (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);
    } catch {
      throw new CheckError(`${host} could not be found.`);
    }
  }
  if (addresses.length === 0) throw new CheckError(`${host} could not be found.`);
  if (addresses.some(isBlockedAddress)) {
    throw new CheckError("This name points to a private or reserved address, which cannot be checked from here.");
  }
  return addresses.find((a) => isIP(a) === 4) ?? addresses[0];
}

// ---------- certificates ----------

type Node = { tag: number; start: number; end: number };

function tlv(b: Uint8Array, pos: number, limit: number): Node | null {
  if (pos + 2 > limit) return null;
  const tag = b[pos];
  let len = b[pos + 1];
  let start = pos + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4 || start + n > limit) return null;
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + b[start + i];
    start += n;
  }
  return start + len <= limit ? { tag, start, end: start + len } : null;
}

function children(b: Uint8Array, node: Node | null): Node[] {
  const out: Node[] = [];
  if (!node) return out;
  for (let pos = node.start; pos < node.end; ) {
    const child = tlv(b, pos, node.end);
    if (!child) return [];
    out.push(child);
    pos = child.end;
  }
  return out;
}

const hex = (b: Uint8Array, node: Node | undefined) =>
  node && node.tag === 0x06 ? Buffer.from(b.subarray(node.start, node.end)).toString("hex") : "";

const SIGNATURES: Record<string, string> = {
  "2a864886f70d010105": "RSA with SHA-1",
  "2a864886f70d01010b": "RSA with SHA-256",
  "2a864886f70d01010c": "RSA with SHA-384",
  "2a864886f70d01010d": "RSA with SHA-512",
  "2a864886f70d01010a": "RSA-PSS",
  "2a8648ce3d040301": "ECDSA with SHA-1",
  "2a8648ce3d040302": "ECDSA with SHA-256",
  "2a8648ce3d040303": "ECDSA with SHA-384",
  "2a8648ce3d040304": "ECDSA with SHA-512",
  "2b6570": "Ed25519",
  "2b6571": "Ed448",
  "608648016503040311": "ML-DSA-44",
  "608648016503040312": "ML-DSA-65",
  "608648016503040313": "ML-DSA-87",
};

/** Public key algorithms Node cannot read yet, named from the certificate itself. */
const KEYS: Record<string, string> = {
  "608648016503040311": "ML-DSA-44",
  "608648016503040312": "ML-DSA-65",
  "608648016503040313": "ML-DSA-87",
};

const CURVES: Record<string, string> = { prime256v1: "P-256", secp384r1: "P-384", secp521r1: "P-521" };

function keyAlgorithm(cert: X509Certificate, der: Uint8Array): string {
  try {
    const key = cert.publicKey;
    const d = key.asymmetricKeyDetails ?? {};
    switch (key.asymmetricKeyType) {
      case "rsa":
      case "rsa-pss":
        return d.modulusLength ? `RSA-${d.modulusLength}` : "RSA";
      case "ec":
        return `ECDSA/ECDH ${CURVES[d.namedCurve ?? ""] ?? d.namedCurve ?? ""}`.trim();
      case "ed25519":
        return "Ed25519";
      case "ed448":
        return "Ed448";
      case "dsa":
        return d.modulusLength ? `DSA-${d.modulusLength}` : "DSA";
      default:
        if (key.asymmetricKeyType) return key.asymmetricKeyType.toUpperCase();
    }
  } catch {
    // Not readable by this Node version; fall through to the certificate's OID.
  }
  // Certificate: tbsCertificate fields [0] version?, serial, signature, issuer, validity, subject, spki.
  const cert0 = children(der, tlv(der, 0, der.length));
  const tbs = children(der, cert0[0] ?? null);
  const first = tbs[0]?.tag === 0xa0 ? 1 : 0;
  const algId = children(der, children(der, tbs[first + 5] ?? null)[0] ?? null);
  return KEYS[hex(der, algId[0])] ?? "Unknown key type";
}

function signatureAlgorithm(der: Uint8Array): string {
  const parts = children(der, tlv(der, 0, der.length));
  const oid = hex(der, children(der, parts[1] ?? null)[0]);
  return SIGNATURES[oid] ?? (oid ? `Unknown (${oid})` : "Unknown");
}

function chainOf(peer: DetailedPeerCertificate): CertInfo[] {
  const chain: CertInfo[] = [];
  const seen = new Set<string>();
  for (let c: DetailedPeerCertificate | undefined = peer; c?.raw && !seen.has(c.fingerprint256); c = c.issuerCertificate) {
    seen.add(c.fingerprint256);
    const der = new Uint8Array(c.raw);
    const x = new X509Certificate(c.raw);
    chain.push({
      subject: x.subject.split("\n").join(", "),
      issuer: x.issuer.split("\n").join(", "),
      keyAlgorithm: keyAlgorithm(x, der),
      signatureAlgorithm: signatureAlgorithm(der),
      notValidBefore: new Date(x.validFrom).toISOString(),
      notValidAfter: new Date(x.validTo).toISOString(),
      fingerprint: x.fingerprint256.replace(/:/g, "").toLowerCase(),
    });
    if (chain.length >= 10) break;
  }
  return chain;
}

/** Plain wording for the certificate errors servers most often have. */
const TRUST_PROBLEMS: Record<string, string> = {
  SELF_SIGNED_CERT_IN_CHAIN: "The chain ends in a certificate authority that browsers do not trust, such as a private one.",
  DEPTH_ZERO_SELF_SIGNED_CERT: "The certificate is self-signed.",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "The server does not send the full certificate chain, or its issuer is not trusted.",
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "The server does not send the full certificate chain, or its issuer is not trusted.",
  CERT_HAS_EXPIRED: "The certificate has expired.",
  CERT_NOT_YET_VALID: "The certificate is not valid yet.",
};

// ---------- handshakes ----------

/** One TLS handshake; resolves with the open socket's details, then closes it. */
function handshake<T>(
  address: string,
  host: string,
  port: number,
  options: { groups: string; minVersion: "TLSv1.2" | "TLSv1.3" },
  read: (socket: TLSSocket) => T,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const socket = connect({
      host: address,
      port,
      servername: isIP(host) ? undefined : host,
      ecdhCurve: options.groups,
      minVersion: options.minVersion,
      // Trust is checked and reported below; the handshake must complete to inspect it.
      rejectUnauthorized: false,
    });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new CheckError(`${host}:${port} did not answer within ${TIMEOUT_MS / 1000} seconds.`));
    }, TIMEOUT_MS);
    socket.once("secureConnect", () => {
      clearTimeout(timer);
      try {
        resolve(read(socket));
      } catch (e) {
        reject(e);
      } finally {
        socket.destroy();
      }
    });
    socket.once("error", (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      socket.destroy();
      reject(e);
    });
  });
}

/** Name of the group a handshake settled on. */
function groupName(socket: TLSSocket): string {
  const info = socket.getEphemeralKeyInfo() as { type?: string; name?: string; size?: number };
  if (info.type === "ECDH" && info.name) {
    return info.name === "X25519" || info.name === "X448" ? info.name : `ECDH ${CURVES[info.name] ?? info.name}`;
  }
  if (info.type === "DH") return info.size ? `DH-${info.size}` : "DH";
  if (socket.getProtocol() === "TLSv1.3") return PQ_GROUP; // the only non-ECDH group offered
  return "RSA key transport"; // TLS 1.2 without an ephemeral key
}

function connectionError(e: unknown, host: string, port: number): CheckError {
  if (e instanceof CheckError) return e;
  const code = (e as NodeJS.ErrnoException)?.code ?? "";
  if (code === "ECONNREFUSED") return new CheckError(`${host} refused the connection on port ${port}.`);
  if (code === "ECONNRESET") return new CheckError(`${host} closed the connection during the handshake.`);
  if (code.startsWith("ERR_SSL")) return new CheckError(`${host}:${port} did not complete a TLS handshake.`);
  return new CheckError(`${host}:${port} could not be reached.`);
}

export async function checkServer(input: string, portInput?: number): Promise<ServerCheck> {
  const { host, port } = parseTarget(input, portInput);
  const address = await resolvePublic(host);

  let first;
  try {
    first = await handshake(address, host, port, { groups: BROWSER_GROUPS, minVersion: "TLSv1.2" }, (s) => {
      const peer = s.getPeerCertificate(true);
      const identity = peer.raw && !isIP(host) ? checkServerIdentity(host, peer) : undefined;
      const chainError = s.authorized ? null : String(s.authorizationError ?? "");
      const problems = [
        chainError !== null ? (TRUST_PROBLEMS[chainError] ?? `The certificate chain is not trusted (${chainError}).`) : null,
        identity ? `The certificate is not issued for ${host}.` : null,
      ].filter((p): p is string => p !== null);
      const trustProblem = problems.length ? problems.join(" ") : null;
      return {
        protocol: s.getProtocol() ?? "unknown",
        cipher: s.getCipher()?.name ?? "unknown",
        keyExchange: groupName(s),
        trustProblem,
        chain: peer.raw ? chainOf(peer) : [],
      };
    });
  } catch (e) {
    throw connectionError(e, host, port);
  }

  let pqSupport: PqSupport = first.keyExchange === PQ_GROUP ? "default" : "none";
  if (pqSupport === "none" && first.protocol === "TLSv1.3") {
    try {
      await handshake(address, host, port, { groups: PQ_GROUP, minVersion: "TLSv1.3" }, () => null);
      pqSupport = "available";
    } catch (e) {
      // A handshake failure means "not supported"; anything else means we could not tell.
      const code = (e as NodeJS.ErrnoException)?.code ?? "";
      if (!code.startsWith("ERR_SSL")) pqSupport = "unknown";
    }
  }

  return {
    host,
    port,
    address,
    checkedAt: new Date().toISOString(),
    protocol: first.protocol,
    cipher: first.cipher,
    keyExchange: first.keyExchange,
    pqSupport,
    trusted: first.trustProblem === null,
    trustProblem: first.trustProblem,
    chain: first.chain,
  };
}

/** The result as findings, so it can be exported in the same CBOM as code scans. */
export function serverFindings(check: ServerCheck) {
  const asset = `tls://${check.host}:${check.port}`;
  const base = { asset, risk: "high", detail: "", provenance: "directly observed", confidence: "high" };
  const pq = check.keyExchange === PQ_GROUP;
  return [
    {
      ...base,
      algorithm: pq ? "X25519MLKEM768 hybrid" : check.keyExchange,
      classification: pq ? "pqc-ready" : "quantum-vulnerable",
      risk: pq ? "info" : "high",
      evidence: asset,
      service: `key establishment (${check.protocol})`,
    },
    ...check.chain.map((c) => ({
      ...base,
      algorithm: c.keyAlgorithm,
      classification: c.keyAlgorithm.startsWith("ML-") ? "pqc-ready" : "quantum-vulnerable",
      risk: c.keyAlgorithm.startsWith("ML-") ? "info" : "medium",
      evidence: `sha256:${c.fingerprint}`,
      service: "authentication (X.509 certificate)",
      certificate: {
        subject: c.subject,
        issuer: c.issuer,
        notValidBefore: c.notValidBefore,
        notValidAfter: c.notValidAfter,
      },
    })),
  ];
}