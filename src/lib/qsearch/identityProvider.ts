// Sign-in provider check: reads the public keys an OpenID Connect provider
// (Logto, Okta, Auth0, Microsoft Entra, Google…) signs login tokens with.
// Providers publish these on purpose, so apps can verify tokens: first a
// discovery document at /.well-known/openid-configuration, which names the
// key list (the JWKS, "JSON Web Key Set"), then the key list itself.
//
// Server only. The website fetches an address the user typed, so every fetch
// is HTTPS on port 443, to public addresses only (checked at connect time, so
// a name cannot be switched to a private address in between), with no
// redirects, a timeout, and a size cap.

import { lookup } from "dns/promises";
import { request } from "https";
import { isIP, type LookupFunction } from "net";
import { CheckError, isBlockedAddress } from "./serverCheck";

const TIMEOUT_MS = 5000;
const MAX_BYTES = 256 * 1024;
const MAX_KEYS = 50;

export interface ProviderKey {
  /** The key's id in the provider's list, if it has one. */
  kid: string;
  /** For example "RSA-2048", "ECDSA P-256", "Ed25519" or "ML-DSA-65". */
  name: string;
  /** Inventory family, or null for post-quantum keys, which need no migration. */
  family: "RSA" | "ECDSA/ECDH" | "Ed25519" | "Ed448" | "X25519" | "X448" | null;
  keyLength: string;
  service: "digital signatures" | "key establishment";
  quantumSafe: boolean;
}

export interface ProviderCheck {
  issuer: string;
  host: string;
  jwksUri: string;
  keys: ProviderKey[];
  /** Entries in the list that are not keys qSearch can read. */
  skipped: number;
  checkedAt: string;
}

/** Connects only to public addresses, deciding at connect time. */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  const reply = (err: NodeJS.ErrnoException | null, address = "", family = 4) =>
    options.all ? callback(err, err ? [] : [{ address, family }]) : callback(err, address, family);
  const check = (address: string) =>
    isBlockedAddress(address)
      ? reply(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }))
      : reply(null, address, isIP(address));
  if (isIP(hostname)) return check(hostname);
  lookup(hostname, { all: true, verbatim: true }).then(
    (addresses) => {
      // Every address must be public, as in the server check.
      if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
        return reply(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }));
      }
      const chosen = addresses.find((a) => a.family === 4) ?? addresses[0];
      reply(null, chosen.address, chosen.family);
    },
    () => reply(Object.assign(new Error("not found"), { code: "ENOTFOUND" })),
  );
};

/** An error carrying the HTTP status, so a 404 can lead to the next address. */
class StatusError extends CheckError {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const BLOCKED_MESSAGE = "This name points to a private or reserved address, which cannot be checked from here.";

/** GETs a JSON document over HTTPS, with every limit above. */
function getJson(url: URL): Promise<unknown> {
  if (url.protocol !== "https:" || (url.port && url.port !== "443")) {
    return Promise.reject(new CheckError("Only https:// addresses on the standard port can be checked."));
  }
  // Node connects to a raw IP address without any lookup, so check it here.
  const literal = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(literal) && isBlockedAddress(literal)) return Promise.reject(new CheckError(BLOCKED_MESSAGE));
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { accept: "application/json", "user-agent": "qSearch (Light Rider)" },
        lookup: safeLookup,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          const status = res.statusCode ?? 0;
          const message =
            status >= 300 && status < 400
              ? `${url.hostname} redirected ${url.pathname} elsewhere; redirects are not followed.`
              : `${url.hostname} answered ${status} for ${url.pathname}.`;
          return reject(new StatusError(message, status));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy();
            reject(new CheckError(`${url.hostname} sent a response too large to be a key list.`));
          } else chunks.push(chunk);
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new CheckError(`${url.hostname} did not send valid JSON from ${url.pathname}.`));
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new CheckError(`${url.hostname} did not answer within 5 seconds.`)));
    req.on("error", (e: NodeJS.ErrnoException) => {
      if (e instanceof CheckError) return reject(e);
      if (e.code === "EBLOCKED") return reject(new CheckError(BLOCKED_MESSAGE));
      if (e.code === "ENOTFOUND") return reject(new CheckError(`${url.hostname} could not be found.`));
      reject(new CheckError(`${url.hostname} could not be reached over HTTPS.`));
    });
    req.end();
  });
}

/** Where to look for the discovery document, from what the user typed. */
function candidates(input: string): URL[] {
  let text = input.trim();
  if (!text) throw new CheckError("Enter a sign-in provider, such as yourtenant.logto.app or login.microsoftonline.com/common/v2.0.");
  if (text.length > 300) throw new CheckError("That address is too long.");
  if (!/^[a-z]+:\/\//i.test(text)) text = `https://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new CheckError("That is not a valid address.");
  }
  if (url.protocol !== "https:") throw new CheckError("Only https:// addresses can be checked.");
  const base = `${url.origin}${url.pathname.replace(/\/\.well-known\/openid-configuration$/, "").replace(/\/+$/, "")}`;
  const list = [new URL(`${base}/.well-known/openid-configuration`)];
  // Logto serves OpenID Connect under /oidc; try it when only a host was given.
  if (url.pathname === "/" || url.pathname === "") list.push(new URL(`${url.origin}/oidc/.well-known/openid-configuration`));
  return list;
}

/** Size of a big-endian number written in base64url, in bits. */
function bitsOf(base64url: string): number {
  const bytes = Buffer.from(base64url, "base64url");
  let i = 0;
  while (i < bytes.length && bytes[i] === 0) i++;
  return i === bytes.length ? 0 : (bytes.length - i - 1) * 8 + (32 - Math.clz32(bytes[i]));
}

const EC_CURVES: Record<string, string> = { "P-256": "P-256", "P-384": "P-384", "P-521": "P-521", secp256k1: "secp256k1" };
const OKP_CURVES: Record<string, ProviderKey["family"]> = { Ed25519: "Ed25519", Ed448: "Ed448", X25519: "X25519", X448: "X448" };
const OKP_BITS: Record<string, string> = { Ed25519: "256 bits", Ed448: "456 bits", X25519: "256 bits", X448: "448 bits" };

/** One entry of a key list, or null when it is not a key qSearch can read. */
export function readKey(jwk: unknown): ProviderKey | null {
  if (!jwk || typeof jwk !== "object") return null;
  const k = jwk as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 100) : "");
  const kid = str(k.kid);
  const service = k.use === "enc" ? "key establishment" : "digital signatures";
  switch (k.kty) {
    case "RSA": {
      if (typeof k.n !== "string" || k.n.length > 4096) return null;
      const bits = bitsOf(k.n);
      if (bits < 256) return null;
      return { kid, name: `RSA-${bits}`, family: "RSA", keyLength: `${bits} bits`, service, quantumSafe: false };
    }
    case "EC": {
      const curve = EC_CURVES[str(k.crv)];
      if (!curve) return null;
      return { kid, name: `ECDSA ${curve}`, family: "ECDSA/ECDH", keyLength: curve, service, quantumSafe: false };
    }
    case "OKP": {
      const crv = str(k.crv);
      const family = OKP_CURVES[crv];
      if (!family) return null;
      const agree = crv.startsWith("X");
      return {
        kid,
        name: crv,
        family,
        keyLength: OKP_BITS[crv],
        service: agree ? "key establishment" : "digital signatures",
        quantumSafe: false,
      };
    }
    case "AKP": {
      // Post-quantum keys, such as ML-DSA, under the JOSE "AKP" key type.
      const alg = str(k.alg);
      if (!/^ML-DSA-(44|65|87)$|^SLH-DSA/.test(alg)) return null;
      return { kid, name: alg, family: null, keyLength: alg, service: "digital signatures", quantumSafe: true };
    }
    default:
      return null;
  }
}

const NO_CONFIG =
  "No OpenID Connect sign-in configuration was found there. Check the address, including any path such as /oidc or /v2.0.";

/** Reads a provider's signing keys. */
export async function checkProvider(input: string): Promise<ProviderCheck> {
  let config: Record<string, unknown> | null = null;
  for (const url of candidates(input)) {
    try {
      const doc = await getJson(url);
      if (doc && typeof doc === "object" && typeof (doc as Record<string, unknown>).jwks_uri === "string") {
        config = doc as Record<string, unknown>;
        break;
      }
    } catch (e) {
      // Only "not there" moves on to the next address; any other problem is
      // the real answer, and trying again would only add waiting.
      if (!(e instanceof StatusError && e.status === 404)) throw e;
    }
  }
  if (!config) throw new CheckError(NO_CONFIG);

  let jwksUri: URL;
  try {
    jwksUri = new URL(config.jwks_uri as string);
  } catch {
    throw new CheckError("The provider's configuration names an invalid key list address.");
  }
  const jwks = await getJson(jwksUri);
  const entries = jwks && typeof jwks === "object" && Array.isArray((jwks as { keys?: unknown }).keys)
    ? ((jwks as { keys: unknown[] }).keys).slice(0, MAX_KEYS)
    : null;
  if (!entries) throw new CheckError("The provider's key list could not be read.");
  const keys = entries.map(readKey).filter((k): k is ProviderKey => k !== null);

  return {
    issuer: typeof config.issuer === "string" ? config.issuer.slice(0, 300) : jwksUri.origin,
    host: jwksUri.hostname,
    jwksUri: jwksUri.toString(),
    keys,
    skipped: entries.length - keys.length,
    checkedAt: new Date().toISOString(),
  };
}