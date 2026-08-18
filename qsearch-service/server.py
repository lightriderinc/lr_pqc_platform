import io
import json
import os
import subprocess
import tempfile
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

HOST = "127.0.0.1"
PORT = int(os.getenv("QSEARCH_SERVICE_PORT", "8787"))
MAX_UPLOAD = 50 * 1024 * 1024
MAX_FILES = 5000
MAX_EXTRACTED = 200 * 1024 * 1024
TIMEOUT = 300

BASE = Path(__file__).resolve().parent
QSEARCH_BIN = Path(os.getenv("QSEARCH_BIN", str(BASE / "qsearch.exe"))).resolve()

SINGLE_FILE_EXTS = {
    ".py", ".js", ".ts", ".go", ".rs", ".cpp", ".c", ".h", ".hpp",
    ".java", ".rb", ".cs", ".yaml", ".yml", ".toml", ".json",
    ".cfg", ".conf", ".ini", ".tf", ".sh",
    ".pem", ".crt", ".cer",
}

def safe_extract(zf, dest):
    total = 0
    count = 0
    root = dest.resolve()
    for info in zf.infolist():
        if info.is_dir():
            continue
        count += 1
        if count > MAX_FILES:
            raise ValueError("ZIP contains too many files.")
        name = info.filename.replace("\\", "/")
        target = (root / name).resolve()
        if target != root and root not in target.parents:
            raise ValueError("Unsafe ZIP path detected.")
        total += info.file_size
        if total > MAX_EXTRACTED:
            raise ValueError("Extracted ZIP is too large.")
    zf.extractall(root)

def wrap_single_file(body: bytes, filename: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(filename, body)
    return buf.getvalue()

def scan_zip(body: bytes):
    if len(body) > MAX_UPLOAD:
        raise ValueError("File is larger than 50 MB.")
    if not QSEARCH_BIN.is_file():
        raise RuntimeError(f"qSearch binary not found: {QSEARCH_BIN}")

    with tempfile.TemporaryDirectory(prefix="qsearch-") as tmp:
        tmp_path = Path(tmp)
        archive = tmp_path / "source.zip"
        source = tmp_path / "source"
        output = tmp_path / "output"
        archive.write_bytes(body)
        source.mkdir()
        output.mkdir()

        with zipfile.ZipFile(archive) as zf:
            safe_extract(zf, source)

        subprocess.run(
            [str(QSEARCH_BIN), "scan", str(source), "--out", str(output), "--quiet"],
            check=True,
            timeout=TIMEOUT,
            capture_output=True,
            text=True,
        )

        data = json.loads((output / "findings.json").read_text(encoding="utf-8"))
        findings = data.get("findings", [])

        return {
            "files_scanned": data.get("files_scanned", 0),
            "quantum_vulnerable": sum(x.get("classification") == "quantum-vulnerable" for x in findings),
            "high_risk": sum(x.get("risk") == "high" for x in findings),
            "pqc_ready": sum(x.get("classification") == "pqc-ready" for x in findings),
            "findings": [
                {
                    "algorithm": x.get("algorithm", ""),
                    "classification": x.get("classification", ""),
                    "risk": x.get("risk", ""),
                    "asset": x.get("asset", ""),
                    "evidence": x.get("evidence", ""),
                }
                for x in findings
            ],
        }

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/scan":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_UPLOAD:
                raise ValueError("Invalid file size.")

            body = self.rfile.read(length)
            content_type = self.headers.get("Content-Type", "")
            filename = unquote(self.headers.get("X-File-Name", "upload.zip"))
            ext = Path(filename).suffix.lower()

            # Wrap single source files into a ZIP before scanning
            if content_type != "application/zip" and ext in SINGLE_FILE_EXTS:
                body = wrap_single_file(body, filename)

            result = scan_zip(body)
            payload = json.dumps(result).encode()
            self.send_response(200)
        except zipfile.BadZipFile:
            payload = b"Invalid ZIP file."
            self.send_response(400)
        except (ValueError, RuntimeError) as exc:
            payload = str(exc).encode()
            self.send_response(400)
        except subprocess.TimeoutExpired:
            payload = b"qSearch timed out."
            self.send_response(504)
        except subprocess.CalledProcessError:
            payload = b"qSearch process failed."
            self.send_response(500)

        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *_):
        pass

print(f"qSearch service: http://{HOST}:{PORT}/scan")
print(f"qSearch binary: {QSEARCH_BIN}")
ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()