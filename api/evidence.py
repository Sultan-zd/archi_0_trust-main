import hashlib
import json
from pathlib import Path
import requests

def canonical(doc: dict) -> bytes:
    return json.dumps(doc, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()

class EvidenceStore:
    def __init__(self, directory: Path, ipfs_api_url: str = ""):
        self.dir = directory
        self.dir.mkdir(parents=True, exist_ok=True)
        self.ipfs = ipfs_api_url.rstrip("/")

    def save(self, request_id: str, doc: dict) -> tuple[bytes, str | None]:
        raw = canonical(doc)
        digest = hashlib.sha256(raw).digest()
        (self.dir / f"{request_id}.json").write_bytes(raw)
        cid = None
        if self.ipfs:
            try:
                r = requests.post(f"{self.ipfs}/api/v0/add", files={"file": (f"{request_id}.json", raw)}, timeout=10)
                r.raise_for_status()
                cid = r.json()["Hash"]
                (self.dir / f"{request_id}.cid").write_text(cid)
            except requests.RequestException:
                cid = None
        return digest, cid

    def load(self, request_id: str) -> tuple[dict, str] | None:
        f = self.dir / f"{request_id}.json"
        if not f.exists():
            return None
        raw = f.read_bytes()
        return json.loads(raw), "0x" + hashlib.sha256(raw).hexdigest()
