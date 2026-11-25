# Compares qSearch's findings with the ground truth from truth.py.
# Usage: python3 compare.py <truth.json> <qsearch findings.json>
import json, sys
def norm(a): return a if a.startswith("./") else "./" + a.lstrip("/")
t = json.load(open(sys.argv[1])); f = json.load(open(sys.argv[2]))["findings"]
truth_keys = set(t["privateKeyFiles"])
found_keys = {norm(x["asset"]) for x in f if x["cryptographic_service"] == "key material at rest"}
truth_certs = {(c["file"], c["fp"]): c["key"] for c in t["certs"]}
found_certs = {(norm(x["asset"]), x["source_of_evidence"][7:].lower()): x["algorithm"] for x in f if x["source_of_evidence"].startswith("sha256:")}
hit, chit = truth_keys & found_keys, set(truth_certs) & set(found_certs)
print(f"private-key files: found {len(hit)} of {len(truth_keys)} | reported but no private key: {len(found_keys - truth_keys)}")
for m in sorted(truth_keys - found_keys): print("  missed:", m)
for m in sorted(found_keys - truth_keys): print("  extra :", m)
print(f"certificates: found {len(chit)} of {len(truth_certs)} | reported but not in the reference: {len(set(found_certs) - set(truth_certs))}")
print("  (key sizes are checked on the website, which adds certificate details the scanner alone may leave out)")
