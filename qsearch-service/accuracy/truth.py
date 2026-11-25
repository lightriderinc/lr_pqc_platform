# Ground truth, computed without qSearch: private-key blocks by strict pattern,
# certificates parsed with pyca/cryptography (an independent implementation).
# Usage: python3 truth.py <repository folder> <output.json>
import json, os, re, sys
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa, ec, ed25519, ed448, dsa
MAX = 4 * 1024 * 1024  # qSearch reads files up to 4 MB; larger ones are out of scope for both
PRIV_BLOCK = re.compile(rb"-----BEGIN ((?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?)PRIVATE KEY-----(.{0,12000}?)-----END \1PRIVATE KEY-----", re.S)
LINE_OK = re.compile(rb"^[A-Za-z0-9+/=]*$|^(Proc-Type|DEK-Info):")
def has_private_key(b):
    # A real key: every line between BEGIN and END is key data (base64, possibly
    # inside quotes or indented) or a PEM header, with at least 60 characters of
    # key data in all. Parser constants and test code between markers do not qualify.
    for m in PRIV_BLOCK.finditer(b):
        body = m.group(2).replace(b"\\n", b"\n").replace(b"\\r", b"")
        lines = [re.sub(rb"^\s*b?[\"']|[\"'],?\s*$|\s+", b"", l) for l in body.split(b"\n")]
        lines = [l for l in lines if l]
        if lines and all(LINE_OK.match(l) for l in lines) and sum(len(l) for l in lines) >= 60:
            return True
    return False
CERT = re.compile(rb"-----BEGIN CERTIFICATE-----\s+[A-Za-z0-9+/=\s]+?-----END CERTIFICATE-----")
def label(k):
    if isinstance(k, rsa.RSAPublicKey): return f"RSA-{k.key_size}"
    if isinstance(k, ec.EllipticCurvePublicKey): return {"secp256r1": "P-256", "secp384r1": "P-384", "secp521r1": "P-521"}.get(k.curve.name, k.curve.name)
    if isinstance(k, ed25519.Ed25519PublicKey): return "Ed25519"
    if isinstance(k, ed448.Ed448PublicKey): return "Ed448"
    if isinstance(k, dsa.DSAPublicKey): return f"DSA-{k.key_size}"
    return type(k).__name__
import cryptography
print("reference parser: pyca/cryptography", cryptography.__version__)
if int(cryptography.__version__.split(".")[0]) < 46:
    print("  warning: the accuracy page was measured with version 50; older versions refuse some malformed certificates, so certificate counts can differ")
root = sys.argv[1]
out = {"privateKeyFiles": [], "certs": [], "unparseableCerts": 0, "skippedLarge": 0}
for d, _, files in os.walk(root):
    for n in files:
        p = os.path.join(d, n); rel = "./" + os.path.relpath(p, root)
        if os.path.getsize(p) > MAX: out["skippedLarge"] += 1; continue
        b = open(p, "rb").read()
        if has_private_key(b): out["privateKeyFiles"].append(rel)
        for m in CERT.finditer(b):
            try:
                c = x509.load_pem_x509_certificate(m.group(0))
                out["certs"].append({"file": rel, "fp": c.fingerprint(hashes.SHA256()).hex(), "key": label(c.public_key())})
            except Exception:
                out["unparseableCerts"] += 1
json.dump(out, open(sys.argv[2], "w"))
print(os.path.basename(root.rstrip("/")), "| private-key files:", len(out["privateKeyFiles"]), "| parseable certificates:", len(out["certs"]), "| unparseable:", out["unparseableCerts"], "| files over 4 MB:", out["skippedLarge"])
