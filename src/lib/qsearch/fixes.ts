// Fix generator: for each finding, how to fix it. Pure: runs in the browser.
//
// Every code example here was run before it was written down: Python
// (cryptography 50), Node.js (@noble/post-quantum 0.6), Go 1.26 (crypto/mlkem
// and Cloudflare CIRCL), Java 25 and C (OpenSSL 3.5.4). TLS group lines were
// tested with OpenSSL 3.5's own server and client; SSH lines with OpenSSH 9.6.
// Minimum versions come from each project's release notes.

import { describeAlgorithm } from "./algorithms";
import { isComment, isTestPath } from "./tags";

export type FixGroup = "now" | "config" | "code" | "plan";

export interface Fix {
    /** Same fix, same id: findings that need it are grouped. */
    id: string;
    group: FixGroup;
    title: string;
    why: string;
    steps: string[];
    /** A tested example of the fix, in the finding's language or config format. */
    code?: { language: string; text: string };
    /** Minimum versions or packages needed. */
    requires?: string;
    /** How to confirm the fix worked. */
    verify?: string;
}

export interface FixFinding {
    algorithm: string;
    classification: string;
    confidence: string;
    service: string;
    asset: string;
    evidence: string;
    detail?: string;
    keyBits?: number | null;
    parameterSet?: string | null;
    certificate?: { notValidAfter: string } | null;
}

export const GROUPS: { group: FixGroup; label: string; intro: string }[] = [
    { group: "now", label: "Fix now", intro: "Broken or exposed today. No quantum computer is needed to exploit these." },
    {
        group: "config",
        label: "Change configuration",
        intro: "The fastest protection against harvest now, decrypt later: a setting, not a code change.",
    },
    { group: "code", label: "Migrate code", intro: "Replace quantum-vulnerable algorithms in your own code with ML-DSA and ML-KEM." },
    {
        group: "plan",
        label: "Plan with vendors and standards",
        intro: "Depends on software, providers or standards outside your code. Track these and act when support arrives.",
    },
];

type Lang = "python" | "node" | "go" | "java" | "c" | "rust";

const LANGS: Record<string, Lang> = {
    py: "python",
    js: "node",
    mjs: "node",
    cjs: "node",
    jsx: "node",
    ts: "node",
    tsx: "node",
    go: "go",
    java: "java",
    kt: "java",
    scala: "java",
    c: "c",
    h: "c",
    cc: "c",
    cpp: "c",
    hpp: "c",
    rs: "rust",
};

const LANG_NAME: Record<Lang, string> = {
    python: "Python",
    node: "Node.js",
    go: "Go",
    java: "Java",
    c: "C and C++",
    rust: "Rust",
};

const baseName = (asset: string) => asset.split("/").pop() ?? asset;
const langOf = (asset: string): Lang | null => LANGS[baseName(asset).split(".").pop()?.toLowerCase() ?? ""] ?? null;

// ---------- fix now ----------

const PRIVATE_KEY: Fix = {
    id: "now:private-key",
    group: "now",
    title: "Replace private keys stored in the code",
    why: "Anyone who can read this repository can use these keys today. Keys used only by tests are usually harmless, but only if they were never used anywhere else.",
    steps: [
        "Generate a new key pair, and move every system that uses the old key to the new one.",
        "Revoke the old key: revoke its certificate, or remove its public key wherever it is trusted (servers, identity providers, partners).",
        "Delete the file and remove it from the repository's history, then force-push and ask everyone to clone again. Deleting it in a new commit leaves it in the history.",
        "Keep keys out of code from now on: use a secret manager or environment variables, and a secret scanner before each commit.",
        "For test keys: generate them when the tests run instead of storing them.",
    ],
    code: { language: "bash", text: "# Removes the file from every commit (needs git-filter-repo)\ngit filter-repo --invert-paths --path path/to/private-key.pem" },
};

const EXPIRED_CERT: Fix = {
    id: "now:expired-certificate",
    group: "now",
    title: "Renew or remove expired certificates",
    why: "An expired certificate fails verification today: connections and signature checks that rely on it break.",
    steps: [
        "If the certificate is still in use, renew it, and set up automatic renewal (for example ACME) so it cannot expire unnoticed again.",
        "If nothing uses it any more, delete it from the repository.",
        "If it is a test fixture meant to be expired, mark the file clearly as test data.",
    ],
};

const HASH_CODE: Partial<Record<Lang, string>> = {
    python: 'import hashlib\n\ndigest = hashlib.sha256(data).hexdigest()   # instead of hashlib.md5 or hashlib.sha1',
    node: 'const { createHash } = require("node:crypto");\n\nconst digest = createHash("sha256").update(data).digest("hex"); // instead of "md5" or "sha1"',
    go: 'import "crypto/sha256"\n\ndigest := sha256.Sum256(data) // instead of md5.Sum or sha1.Sum',
    java: 'byte[] digest = MessageDigest.getInstance("SHA-256").digest(data); // instead of "MD5" or "SHA-1"',
    c: "/* OpenSSL: use EVP_sha256() instead of EVP_md5() or EVP_sha1() */\nEVP_Digest(data, data_len, digest, &digest_len, EVP_sha256(), NULL);",
};

const hashFix = (lang: Lang | null): Fix => ({
    id: `now:hash:${lang ?? "other"}`,
    group: "now",
    title: `Replace MD5 and SHA-1${lang ? ` (${LANG_NAME[lang]})` : ""}`,
    why: "Collisions in MD5 and SHA-1 can be produced today. Use SHA-256 (or SHA-3). For passwords, use a password hashing function such as Argon2id, scrypt or bcrypt, never a plain hash.",
    steps: [
        "Replace MD5 and SHA-1 with SHA-256 wherever the result protects something: signatures, integrity checks, tokens, file verification.",
        "Where a stored value was created with the old hash, compute both during a transition period, or re-hash when the data is next written.",
        "Where the hash is only a non-security checksum (a cache key, for example), the change is not urgent, but it avoids confusion and repeated scanner findings.",
    ],
    code: lang && HASH_CODE[lang] ? { language: lang, text: HASH_CODE[lang]! } : undefined,
});

const CIPHER_CODE: Partial<Record<Lang, string>> = {
    python:
        'import os\nfrom cryptography.hazmat.primitives.ciphers.aead import AESGCM\n\nkey = AESGCM.generate_key(bit_length=256)\nnonce = os.urandom(12)  # never reuse a nonce with the same key\nciphertext = AESGCM(key).encrypt(nonce, data, None)',
    node:
        'const { createCipheriv, randomBytes } = require("node:crypto");\n\nconst key = randomBytes(32), iv = randomBytes(12); // never reuse an IV with the same key\nconst cipher = createCipheriv("aes-256-gcm", key, iv);\nconst encrypted = Buffer.concat([cipher.update(data), cipher.final()]);\nconst tag = cipher.getAuthTag(); // store with the ciphertext; needed to decrypt',
    go:
        'key := make([]byte, 32)\nrand.Read(key)\nblock, err := aes.NewCipher(key)\nif err != nil {\n\treturn err\n}\ngcm, err := cipher.NewGCM(block)\nif err != nil {\n\treturn err\n}\nnonce := make([]byte, gcm.NonceSize()) // never reuse a nonce with the same key\nrand.Read(nonce)\nciphertext := gcm.Seal(nil, nonce, data, nil)',
    java:
        'KeyGenerator kg = KeyGenerator.getInstance("AES");\nkg.init(256);\nSecretKey key = kg.generateKey();\nbyte[] iv = new byte[12];\nnew SecureRandom().nextBytes(iv); // never reuse an IV with the same key\nCipher cipher = Cipher.getInstance("AES/GCM/NoPadding");\ncipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));\nbyte[] ciphertext = cipher.doFinal(data);',
};

const cipherFix = (lang: Lang | null): Fix => ({
    id: `now:cipher:${lang ?? "other"}`,
    group: "now",
    title: `Replace DES, 3DES and RC4${lang ? ` (${LANG_NAME[lang]})` : ""}`,
    why: "These ciphers can be broken or are deprecated today. Use AES-256-GCM (or ChaCha20-Poly1305), which also detects tampering. AES-256 stays strong against quantum computers.",
    steps: [
        "Encrypt new data with AES-256-GCM, using a fresh random nonce for every message.",
        "Decrypt existing data with the old cipher once, and re-encrypt it with the new one.",
        "Rotate any keys that were used with the old cipher.",
    ],
    code: lang && CIPHER_CODE[lang] ? { language: lang, text: CIPHER_CODE[lang]! } : undefined,
});

const SMALL_KEY: Fix = {
    id: "now:small-key",
    group: "now",
    title: "Replace keys that are too small to be safe today",
    why: "RSA keys under 2048 bits, and DSA keys, are weak or deprecated today, before any quantum computer. OpenSSH 10 has removed DSA altogether.",
    steps: [
        "Replace these keys now. Where the code changes anyway, go straight to post-quantum: ML-DSA for signing, ML-KEM for key exchange (see the code migrations below).",
        "Where something must stay classical for now, use at least RSA-3072 or ECDSA P-256 as a stopgap.",
        "Revoke the old keys once nothing uses them.",
    ],
};

// ---------- configuration ----------

const TLS_VERIFY =
    "From a machine with OpenSSL 3.5 or later: `openssl s_client -connect your.host:443 -groups X25519MLKEM768 -brief </dev/null`. \"Negotiated TLS1.3 group: X25519MLKEM768\" means it works; \"handshake failure\" means it is not on yet. Or run qSearch's Check a server.";

const TLS_FIXES: Record<"nginx" | "apache" | "haproxy" | "tls", Fix> = {
    nginx: {
        id: "config:nginx",
        group: "config",
        title: "Turn on post-quantum key exchange in nginx",
        why: "Traffic recorded today can be decrypted once a large quantum computer exists. The hybrid X25519MLKEM768 protects it now, and keeps working with clients that only know X25519 or P-256.",
        steps: [
            "Check which OpenSSL nginx uses: `nginx -V`. It needs OpenSSL 3.5 or later; upgrade the package or the build if not.",
            "With OpenSSL 3.5, nginx's default already prefers X25519MLKEM768. An explicit ssl_ecdh_curve list without it turns it off: change the line as shown, or remove it.",
            "Reload: `nginx -t && nginx -s reload`.",
        ],
        code: {
            language: "nginx",
            text: "# In the http or server block\nssl_protocols TLSv1.2 TLSv1.3;\nssl_ecdh_curve X25519MLKEM768:X25519:prime256v1;",
        },
        requires: "nginx built with OpenSSL 3.5 or later",
        verify: TLS_VERIFY,
    },
    apache: {
        id: "config:apache",
        group: "config",
        title: "Turn on post-quantum key exchange in Apache",
        why: "Traffic recorded today can be decrypted once a large quantum computer exists. The hybrid X25519MLKEM768 protects it now, and keeps working with older clients.",
        steps: [
            "Check that mod_ssl uses OpenSSL 3.5 or later (the server's startup log names the version).",
            "Add the line shown to the SSL virtual host, or replace an existing Curves line.",
            "Reload: `apachectl configtest && apachectl graceful`.",
        ],
        code: { language: "apache", text: "SSLOpenSSLConfCmd Curves X25519MLKEM768:X25519:prime256v1" },
        requires: "Apache 2.4 with mod_ssl built against OpenSSL 3.5 or later",
        verify: TLS_VERIFY,
    },
    haproxy: {
        id: "config:haproxy",
        group: "config",
        title: "Turn on post-quantum key exchange in HAProxy",
        why: "Traffic recorded today can be decrypted once a large quantum computer exists. The hybrid X25519MLKEM768 protects it now, and keeps working with older clients.",
        steps: [
            "Check the TLS library: `haproxy -vv` must show OpenSSL 3.5 or later (or AWS-LC).",
            "Set the curves in the global section as shown, or with `curves` on each bind line.",
            "Reload HAProxy.",
        ],
        code: { language: "haproxy", text: "global\n    ssl-default-bind-curves X25519MLKEM768:X25519:P-256" },
        requires: "HAProxy built with OpenSSL 3.5 or later, or AWS-LC",
        verify: TLS_VERIFY,
    },
    tls: {
        id: "config:tls",
        group: "config",
        title: "Turn on post-quantum key exchange in TLS settings",
        why: "Traffic recorded today can be decrypted once a large quantum computer exists. The hybrid X25519MLKEM768 protects it now.",
        steps: [
            "Find the TLS library behind this setting. OpenSSL 3.5 or later, and Go 1.24 or later, offer X25519MLKEM768 by default.",
            "Remove explicit group or curve lists that leave it out, or put X25519MLKEM768 first, followed by X25519 for older clients.",
            "For managed load balancers and CDNs, check the provider's post-quantum setting or roadmap.",
        ],
        code: { language: "text", text: "X25519MLKEM768:X25519:prime256v1" },
        verify: TLS_VERIFY,
    },
};

const SSH_KEX: Fix = {
    id: "config:ssh-kex",
    group: "config",
    title: "Turn on post-quantum key exchange in OpenSSH",
    why: "Recorded SSH sessions could be decrypted later. OpenSSH 10 already uses post-quantum key exchange by default; a KexAlgorithms line that leaves it out switches it off. Use the line for your version: older versions reject names they do not know, and sshd will not start.",
    steps: [
        "Check the version on the server: `ssh -V`.",
        "If your config has a KexAlgorithms line, replace it with the line for your version. If not, OpenSSH 9.0 and later already use post-quantum key exchange.",
        "Before reloading, test the configuration: `sshd -t`. Keep an existing session open until a new one connects.",
        "Older than 9.0: upgrade OpenSSH.",
    ],
    code: {
        language: "sshd_config",
        text: "# OpenSSH 9.9 or later\nKexAlgorithms mlkem768x25519-sha256,sntrup761x25519-sha512@openssh.com,curve25519-sha256\n\n# OpenSSH 9.0 to 9.8\nKexAlgorithms sntrup761x25519-sha512@openssh.com,curve25519-sha256",
    },
    requires: "OpenSSH 9.0 or later; 9.9 or later for mlkem768x25519-sha256 (the default from 10.0)",
    verify: "`ssh -v your.host 2>&1 | grep \"kex: algorithm\"` should name mlkem768x25519-sha256 or sntrup761x25519-sha512.",
};

const SSH_HOST_KEY: Fix = {
    id: "plan:ssh-host-key",
    group: "plan",
    title: "SSH host and user keys: track post-quantum support",
    why: "SSH keys sign the connection as it happens, so a future quantum computer cannot forge sessions recorded today. Key exchange is the urgent part (see the OpenSSH configuration fix).",
    steps: [
        "Check your OpenSSH version's release notes for post-quantum signature keys, and plan to adopt them when available.",
        "Meanwhile prefer Ed25519 keys over RSA, and remove DSA keys now (OpenSSH 10 removed DSA).",
    ],
};

// ---------- code ----------

const SIGN_CODE: Partial<Record<Lang, string>> = {
    python:
        'from cryptography.hazmat.primitives.asymmetric import mldsa\n\nprivate_key = mldsa.MLDSA65PrivateKey.generate()\nsignature = private_key.sign(message)\nprivate_key.public_key().verify(signature, message)  # raises InvalidSignature if it does not match',
    node:
        'import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";\n\nconst { publicKey, secretKey } = ml_dsa65.keygen();\nconst signature = ml_dsa65.sign(message, secretKey);\nconst valid = ml_dsa65.verify(signature, message, publicKey);',
    go:
        'import "github.com/cloudflare/circl/sign/mldsa/mldsa65"\n\npublicKey, privateKey, err := mldsa65.GenerateKey(rand.Reader)\nif err != nil {\n\treturn err\n}\nsignature := make([]byte, mldsa65.SignatureSize)\nif err := mldsa65.SignTo(privateKey, message, nil, true, signature); err != nil {\n\treturn err\n}\nvalid := mldsa65.Verify(publicKey, message, nil, signature)',
    java:
        'KeyPair keys = KeyPairGenerator.getInstance("ML-DSA-65").generateKeyPair();\nSignature signer = Signature.getInstance("ML-DSA");\nsigner.initSign(keys.getPrivate());\nsigner.update(message);\nbyte[] signature = signer.sign();',
    c:
        '/* OpenSSL 3.5 or later */\nEVP_PKEY *key = EVP_PKEY_Q_keygen(NULL, NULL, "ML-DSA-65");\nEVP_MD_CTX *ctx = EVP_MD_CTX_new();\nsize_t sig_len = 0;\nEVP_DigestSignInit_ex(ctx, NULL, NULL, NULL, NULL, key, NULL);\nEVP_DigestSign(ctx, NULL, &sig_len, message, message_len);   /* size first */\nunsigned char *sig = OPENSSL_malloc(sig_len);\nEVP_DigestSign(ctx, sig, &sig_len, message, message_len);',
};

const KEM_CODE: Partial<Record<Lang, string>> = {
    python:
        "from cryptography.hazmat.primitives.asymmetric import mlkem\n\n# Receiver: create a key pair and publish the public key.\nprivate_key = mlkem.MLKEM768PrivateKey.generate()\npublic_key = private_key.public_key()\n\n# Sender: create a fresh shared secret for that public key.\nshared_secret, ciphertext = public_key.encapsulate()\n\n# Receiver: recover the same shared secret.\nshared_secret = private_key.decapsulate(ciphertext)",
    node:
        'import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";\n\nconst receiver = ml_kem768.keygen();\nconst { cipherText, sharedSecret } = ml_kem768.encapsulate(receiver.publicKey);\nconst same = ml_kem768.decapsulate(cipherText, receiver.secretKey);',
    go:
        'import "crypto/mlkem"\n\nreceiver, err := mlkem.GenerateKey768()\nif err != nil {\n\treturn err\n}\nsharedSecret, ciphertext := receiver.EncapsulationKey().Encapsulate()\nsame, err := receiver.Decapsulate(ciphertext)',
    java:
        'KeyPair receiver = KeyPairGenerator.getInstance("ML-KEM-768").generateKeyPair();\nKEM.Encapsulated sent = KEM.getInstance("ML-KEM").newEncapsulator(receiver.getPublic()).encapsulate();\nSecretKey received = KEM.getInstance("ML-KEM").newDecapsulator(receiver.getPrivate()).decapsulate(sent.encapsulation());',
    c:
        '/* OpenSSL 3.5 or later */\nEVP_PKEY *kem = EVP_PKEY_Q_keygen(NULL, NULL, "ML-KEM-768");\nEVP_PKEY_CTX *enc = EVP_PKEY_CTX_new_from_pkey(NULL, kem, NULL);\nsize_t ct_len = 0, secret_len = 0;\nEVP_PKEY_encapsulate_init(enc, NULL);\nEVP_PKEY_encapsulate(enc, NULL, &ct_len, NULL, &secret_len);  /* sizes first */\nunsigned char *ct = OPENSSL_malloc(ct_len), *secret = OPENSSL_malloc(secret_len);\nEVP_PKEY_encapsulate(enc, ct, &ct_len, secret, &secret_len);',
};

const REQUIRES: Record<Lang, string> = {
    python: 'cryptography 49 or later: pip install "cryptography>=49"',
    node: "@noble/post-quantum: npm install @noble/post-quantum",
    go: "Go 1.24 or later for crypto/mlkem; github.com/cloudflare/circl for ML-DSA (not in Go's standard library as of Go 1.26)",
    java: "Java 24 or later (ML-KEM and ML-DSA are built in); Bouncy Castle for older Java",
    c: "OpenSSL 3.5 or later",
    rust: "RustCrypto's ml-kem and ml-dsa crates (still pre-1.0: check their status before production use), or aws-lc-rs",
};

type Use = "sign" | "kem" | "both";

/** Go needs every import at the top, so its combined example is written out whole. */
const GO_BOTH =
    'import (\n\t"crypto/mlkem"\n\n\t"github.com/cloudflare/circl/sign/mldsa/mldsa65"\n)\n\n// Signing\npublicKey, privateKey, err := mldsa65.GenerateKey(rand.Reader)\nif err != nil {\n\treturn err\n}\nsignature := make([]byte, mldsa65.SignatureSize)\nif err := mldsa65.SignTo(privateKey, message, nil, true, signature); err != nil {\n\treturn err\n}\nvalid := mldsa65.Verify(publicKey, message, nil, signature)\n\n// Key exchange\nreceiver, err := mlkem.GenerateKey768()\nif err != nil {\n\treturn err\n}\nsharedSecret, ciphertext := receiver.EncapsulationKey().Encapsulate()\nsame, err := receiver.Decapsulate(ciphertext)';

function combine(lang: Lang | null, sign?: string, kem?: string): string | undefined {
    if (!sign || !kem) return sign ?? kem;
    const comment = lang === "c" || lang === "java" ? "/* Key exchange */" : lang === "python" ? "# Key exchange" : "// Key exchange";
    return `${sign}\n\n${comment}\n${kem}`;
}

function codeFix(lang: Lang | null, use: Use): Fix {
    const where = lang ? ` (${LANG_NAME[lang]})` : "";
    const sign = lang ? SIGN_CODE[lang] : undefined;
    const kem = lang ? KEM_CODE[lang] : undefined;
    const text = use === "sign" ? sign : use === "kem" ? kem : lang === "go" ? GO_BOTH : combine(lang, sign, kem);
    const hybrid =
        "For a protocol you design yourself, combine ML-KEM with X25519 (a hybrid) and derive the key from both secrets, as TLS does with X25519MLKEM768: you stay protected if either one is broken.";
    const steps: Record<Use, string[]> = {
        sign: [
            "Generate an ML-DSA-65 key pair and sign with it, as shown.",
            "Update every verifier to accept ML-DSA. During the move, sign with both the old and new key, or version your signature format, so old and new verifiers both work.",
            "ML-DSA signatures and public keys are much larger (3,309 and 1,952 bytes for ML-DSA-65): check size limits in databases, headers and protocols.",
            "Retire the old key once every verifier uses the new one.",
        ],
        kem: [
            "Replace the key agreement with ML-KEM-768, as shown. ML-KEM is a key encapsulation: one side creates the secret for the other's public key, rather than both sides combining key shares.",
            hybrid,
            "ML-KEM public keys and ciphertexts are larger (1,184 and 1,088 bytes for ML-KEM-768): check size limits in protocols and storage.",
        ],
        both: [
            "These keys may sign, agree keys, or both. Find which in the code: signing moves to ML-DSA, key exchange to ML-KEM.",
            "Signing: generate ML-DSA-65 keys and update every verifier; sign with both old and new keys during the move.",
            `Key exchange: use ML-KEM-768. ${hybrid}`,
            "Post-quantum keys, signatures and ciphertexts are much larger: check size limits.",
        ],
    };
    return {
        id: `code:${use}:${lang ?? "other"}`,
        group: "code",
        title:
            use === "sign"
                ? `Move signing to ML-DSA${where}`
                : use === "kem"
                    ? `Move key exchange to ML-KEM${where}`
                    : `Move RSA and elliptic-curve keys to ML-DSA and ML-KEM${where}`,
        why: "A large quantum computer breaks RSA and elliptic-curve cryptography. ML-DSA (FIPS 204) replaces them for signatures; ML-KEM (FIPS 203) for key exchange.",
        steps: steps[use],
        code: text && lang ? { language: lang, text } : undefined,
        requires: lang ? REQUIRES[lang] : "A maintained ML-KEM and ML-DSA implementation for this language, such as OpenSSL 3.5 bindings",
    };
}

// ---------- plan ----------

const JWT: Fix = {
    id: "plan:jwt",
    group: "plan",
    title: "JWT signing: track post-quantum support",
    why: "RS256, ES256 and similar sign tokens with RSA or ECDSA. Post-quantum signature algorithms for JWTs (ML-DSA for JOSE) are going through the IETF standards process, and libraries and identity providers are adding support.",
    steps: [
        "Ask your identity provider and JWT library when they will support ML-DSA signatures.",
        "Keep token lifetimes short and rotate signing keys regularly, so moving to a new algorithm is a key rotation rather than a redesign.",
        "Choose the signing algorithm in one place instead of hard-coding it across services.",
    ],
};

const CERTIFICATE: Fix = {
    id: "plan:certificate",
    group: "plan",
    title: "Certificates: plan for post-quantum signatures",
    why: "A certificate's signature can only be forged once a large quantum computer exists, so this is less urgent than key exchange. Post-quantum certificates for public websites depend on certificate authorities and browsers, which are still moving to them.",
    steps: [
        "Automate renewal, so moving to a new algorithm becomes a configuration change.",
        "List which clients verify these certificates; each must support ML-DSA before you switch.",
        "For a private (internal) certificate authority, you can try ML-DSA certificates now with OpenSSL 3.5, as shown.",
    ],
    code: {
        language: "bash",
        text: '# OpenSSL 3.5 or later: an ML-DSA-65 test certificate authority\nopenssl req -x509 -newkey ML-DSA-65 -nodes -keyout ca.key -out ca.pem -days 365 -subj "/CN=Internal Test CA"',
    },
};

const KEY_FILE: Fix = {
    id: "plan:key-file",
    group: "plan",
    title: "Key files: replace when the code using them migrates",
    why: "These public keys are RSA or elliptic-curve. They are replaced together with the code that uses them.",
    steps: [
        "Find what uses each key: what it signs or verifies, or which connections it protects.",
        "When that code moves to ML-DSA or ML-KEM, generate the new keys, as shown.",
    ],
    code: {
        language: "bash",
        text: "# OpenSSL 3.5 or later\nopenssl genpkey -algorithm ML-DSA-65 -out signing-key.pem\nopenssl genpkey -algorithm ML-KEM-768 -out kem-key.pem",
    },
};

// ---------- matching ----------

const SIGN_ONLY = new Set(["DSA", "Ed25519", "Ed448"]);
const AGREE_ONLY = new Set(["DH", "X25519", "X448"]);

function kindOfUse(family: string, service: string): Use {
    if (SIGN_ONLY.has(family)) return "sign";
    if (AGREE_ONLY.has(family)) return "kem";
    const sig = /signature|authentication/i.test(service);
    const ke = /key establishment|encrypt/i.test(service);
    return sig && !ke ? "sign" : ke && !sig ? "kem" : "both";
}

function configKind(asset: string, detail: string): "ssh" | "nginx" | "apache" | "haproxy" | "tls" | null {
    const base = baseName(asset).toLowerCase();
    if (/^sshd?_config$/.test(base) || /\b(KexAlgorithms|HostKey|HostKeyAlgorithms|PubkeyAcceptedAlgorithms)\b/.test(detail)) return "ssh";
    if (/\bssl_(ecdh_curve|ciphers|conf_command|protocols)\b/.test(detail) || base.includes("nginx")) return "nginx";
    if (/\bSSL(OpenSSLConfCmd|CipherSuite|Protocol)\b/.test(detail) || /^(httpd|apache2?|ssl)\.conf$/.test(base)) return "apache";
    if (/\bssl-default-(bind|server)-|\bcurves\b/.test(detail) || base.includes("haproxy")) return "haproxy";
    if (/\.(conf|cnf|cfg|ini|ya?ml|toml|properties)$/.test(base) && /\b(ecdh|curves?|groups|ciphers?|tls|ssl)\b/i.test(detail)) return "tls";
    return null;
}

const WEAK_HASH = new Set(["MD5", "SHA-1"]);
const WEAK_CIPHER = new Set(["DES", "3DES", "RC4"]);

/** The fix for one finding, or null when none is needed (post-quantum, context, comments). */
export function fixFor(f: FixFinding, now: Date): Fix | null {
    if (f.classification !== "quantum-vulnerable" || isComment(f)) return null;
    const detail = f.detail ?? "";
    const lang = langOf(f.asset);
    if (/key material at rest/i.test(f.service)) return PRIVATE_KEY;
    if (f.certificate && new Date(f.certificate.notValidAfter) < now) return EXPIRED_CERT;

    const info = describeAlgorithm(f.algorithm, f.service, f);
    const family = info?.family ?? "";
    if (WEAK_HASH.has(family)) return hashFix(lang);
    if (WEAK_CIPHER.has(family)) return cipherFix(lang);
    if ((family === "RSA" && f.keyBits && f.keyBits < 2048) || family === "DSA") return SMALL_KEY;
    if (f.certificate || /X\.509 certificate/i.test(f.service)) return CERTIFICATE;

    const config = configKind(f.asset, detail);
    if (config === "ssh") return /\b(HostKey|ssh-rsa|ssh-dss|ecdsa-sha2|ssh-ed25519)\b/.test(detail) && !/KexAlgorithms/.test(detail) ? SSH_HOST_KEY : SSH_KEX;
    if (config) return TLS_FIXES[config];

    if (/\(JWT /.test(f.algorithm)) return JWT;
    if (/public key material/i.test(f.service)) return KEY_FILE;
    if (!info) return null;
    return codeFix(lang, kindOfUse(family, f.service));
}

// ---------- the plan ----------

export interface PlanItem {
    fix: Fix;
    count: number;
    /** "file:line" or file, as the scan reports it. */
    locations: string[];
}

export interface FixPlan {
    groups: { group: FixGroup; label: string; intro: string; items: PlanItem[] }[];
    /** Findings that need a fix. */
    total: number;
}

/** Fixes for asymmetric algorithm use, most specific first; null for other fixes. */
function asymmetricRank(fix: Fix): number | null {
    if (fix.id === JWT.id) return 0;
    if (/^code:(sign|kem):/.test(fix.id)) return 1;
    if (fix.id.startsWith("code:both:")) return 2;
    return null;
}

/**
 * Every finding's fix, grouped. Comments are left out; test files too unless
 * asked for, except private keys, which matter wherever they are.
 */
export function buildFixPlan(findings: FixFinding[], options: { includeTests: boolean; now: Date }): FixPlan {
    // Each finding's fix and place. One line can hold several findings about
    // the same asymmetric algorithm use (a JWT algorithm and its curve, say):
    // there the most specific fix wins, so the line gets one fix. Different
    // problems on one line, such as MD5 beside RSA, keep their own fixes.
    const chosen: { fix: Fix; where: string }[] = [];
    for (const f of findings) {
        const fix = fixFor(f, options.now);
        if (!fix) continue;
        if (!options.includeTests && isTestPath(f.asset) && fix.id !== PRIVATE_KEY.id) continue;
        chosen.push({ fix, where: f.evidence.startsWith("sha256:") ? f.asset : f.evidence });
    }
    const best = new Map<string, Fix>();
    for (const c of chosen) {
        const rank = asymmetricRank(c.fix);
        if (rank === null) continue;
        const current = best.get(c.where);
        if (!current || rank < asymmetricRank(current)!) best.set(c.where, c.fix);
    }
    for (const c of chosen) if (asymmetricRank(c.fix) !== null) c.fix = best.get(c.where)!;

    const items = new Map<string, PlanItem>();
    for (const { fix, where } of chosen) {
        const item = items.get(fix.id) ?? { fix, count: 0, locations: [] };
        item.count += 1;
        if (!item.locations.includes(where)) item.locations.push(where);
        items.set(fix.id, item);
    }
    const total = chosen.length;
    const groups = GROUPS.map((g) => ({
        ...g,
        items: [...items.values()].filter((i) => i.fix.group === g.group).sort((a, b) => b.count - a.count),
    })).filter((g) => g.items.length > 0);
    return { groups, total };
}

/** How each example's format is labelled on screen, and named in Markdown code blocks. */
export const FORMATS: Record<string, { label: string; fence: string }> = {
    python: { label: "Python", fence: "python" },
    node: { label: "JavaScript", fence: "javascript" },
    go: { label: "Go", fence: "go" },
    java: { label: "Java", fence: "java" },
    c: { label: "C", fence: "c" },
    bash: { label: "Shell", fence: "bash" },
    nginx: { label: "nginx", fence: "nginx" },
    apache: { label: "Apache", fence: "apache" },
    haproxy: { label: "HAProxy", fence: "text" },
    sshd_config: { label: "sshd_config", fence: "text" },
    text: { label: "Text", fence: "text" },
};

export const places = (count: number, locations: string[]) =>
    `${count} ${count === 1 ? "finding" : "findings"}${locations.length !== count ? ` in ${locations.length} ${locations.length === 1 ? "place" : "places"}` : ""}`;

/** The plan as a Markdown document a team can work through. */
export function fixPlanMarkdown(plan: FixPlan, source: string): string {
    const out: string[] = [`# Post-quantum fix plan`, "", `${source}. ${plan.total} findings need a fix.`, ""];
    for (const g of plan.groups) {
        out.push(`## ${g.label}`, "", g.intro, "");
        for (const { fix, count, locations } of g.items) {
            out.push(`### ${fix.title}`, "", `${places(count, locations)}. ${fix.why}`, "");
            if (fix.requires) out.push(`**Requires:** ${fix.requires}`, "");
            fix.steps.forEach((s, i) => out.push(`${i + 1}. ${s}`));
            out.push("");
            if (fix.code) out.push("```" + (FORMATS[fix.code.language]?.fence ?? "text"), fix.code.text, "```", "");
            if (fix.verify) out.push(`**Check it worked:** ${fix.verify}`, "");
            out.push("**Where:**", "", ...locations.slice(0, 50).map((l) => `- \`${l.replace(/`/g, "'")}\``));
            if (locations.length > 50) out.push(`- and ${locations.length - 50} more`);
            out.push("");
        }
    }
    return out.join("\n");
}