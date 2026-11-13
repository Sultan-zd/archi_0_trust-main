import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

def _path(name: str, default: str) -> Path:
    p = Path(os.getenv(name, default))
    return p if p.is_absolute() else ROOT / p

CHAIN_RPC_URL = os.getenv("CHAIN_RPC_URL", "http://127.0.0.1:8545")
DEPLOYMENTS_FILE = _path("DEPLOYMENTS_FILE", "deployments/localhost.json")
PDP_PRIVATE_KEY = os.getenv("PDP_PRIVATE_KEY", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
RISK_BUNDLE = _path("RISK_BUNDLE", "models/risk_bundle.joblib")
DEMO_FLOWS = _path("DEMO_FLOWS", "data/processed/demo_flows.json")
USERS_FILE = _path("USERS_FILE", "data/users.json")
EVIDENCE_DIR = _path("EVIDENCE_DIR", "data/evidence")
IPFS_API_URL = os.getenv("IPFS_API_URL", "")
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "change-me")
ASYNC_AUDIT = os.getenv("ASYNC_AUDIT", "true").lower() == "true"
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "300"))

# Keycloak : l'issuer du JWT depend de l'URL utilisee par le client (127.0.0.1 ou localhost).
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://127.0.0.1:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "ztb")
# Issuers supplementaires acceptes, separes par des virgules (ex. http://localhost:8080/realms/ztb).
KEYCLOAK_EXTRA_ISSUERS = [s.strip() for s in os.getenv("KEYCLOAK_EXTRA_ISSUERS", "http://localhost:8080/realms/ztb").split(",") if s.strip()]

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

CONTEXT_RISK_LOCATION_MISMATCH = 25
CONTEXT_RISK_PER_FAST_DENY = 5
CONTEXT_RISK_FAST_DENY_CAP = 20
REQUEST_MAX_AGE_SECONDS = 30
REQUEST_MAX_FUTURE_SKEW_SECONDS = 5
REQUEST_NONCE_TTL_SECONDS = REQUEST_MAX_AGE_SECONDS + REQUEST_MAX_FUTURE_SKEW_SECONDS
TRAVEL_STATE_TTL_SECONDS = 24 * 60 * 60
CONTEXT_RISK_IMPOSSIBLE_TRAVEL = 50
MAX_TRAVEL_SPEED_KMH = 150
