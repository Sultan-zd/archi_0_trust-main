import json, random, time
from uuid import UUID
import redis
from contextlib import asynccontextmanager
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query
from pydantic import BaseModel, Field
from ai.risk import RiskEngine
from api import settings
from api.chain import Chain
from api.evidence import EvidenceStore
from api.mfa import MfaError
from api.pdp import UserProfiles, ZeroTrustEngine
from api.request_security import impossible_travel_risk, timestamp_error
from api.security import current_principal, Principal

STATE: dict = {}
r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0, decode_responses=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    chain = Chain(settings.CHAIN_RPC_URL, settings.DEPLOYMENTS_FILE, settings.PDP_PRIVATE_KEY)
    STATE["engine"] = ZeroTrustEngine(chain, RiskEngine(settings.RISK_BUNDLE), EvidenceStore(settings.EVIDENCE_DIR, settings.IPFS_API_URL), UserProfiles(settings.USERS_FILE))
    STATE["demo_flows"] = json.loads(settings.DEMO_FLOWS.read_text()) if settings.DEMO_FLOWS.exists() else []
    yield

app = FastAPI(title="AI-ZTB - API Zero Trust", version="1.0.0", lifespan=lifespan)

def engine() -> ZeroTrustEngine:
    return STATE["engine"]

def require_admin(x_api_key: str = Header(default="")):
    if x_api_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Cle d'administration invalide")

class AccessRequest(BaseModel):
    resource: str = Field(examples=["charge:start"])
    nonce: UUID
    timestamp: int = Field(gt=0, description="Heure d'envoi en millisecondes depuis l'époque Unix")
    # Appareil utilise. Sa confiance est verifiee on-chain (il doit etre enregistre pour cet utilisateur).
    # Par defaut : "<utilisateur>-device", enregistre par scripts/seed_identities.py.
    device: str | None = None
    flow: dict[str, float] | None = None
    flow_sample: str | None = None
    flow_index: int | None = None
    location: str | None = None
    hour: int | None = Field(default=None, ge=0, le=23)
    otp: str | None = None

class ReverifyRequest(BaseModel):
    flow: dict[str, float] | None = None
    flow_sample: str | None = None
    flow_index: int | None = None
    hour: int | None = Field(default=None, ge=0, le=23)

class NewUser(BaseModel):
    user: str
    role: str = Field(pattern="^(User|Fleet|Admin)$")
    home_location: str | None = None

class MfaEnrollRequest(BaseModel):
    # Obligatoire uniquement pour renouveler un secret deja actif (code de l'application actuelle).
    current_otp: str | None = Field(default=None, max_length=10)

class MfaConfirmRequest(BaseModel):
    otp: str = Field(min_length=6, max_length=10)

class NewDevice(BaseModel):
    device: str
    owner: str

def pick_flow(flow: dict | None, sample: str | None, index: int | None = None) -> dict:
    if flow: return flow
    candidates = [f for f in STATE["demo_flows"] if sample is None or f["label"] == sample]
    if not candidates: raise HTTPException(status_code=422, detail="Fournir flow ou flow_sample valide")
    if index is not None: return candidates[index % len(candidates)]["features"]
    return random.choice(candidates)["features"]

def finish(result: dict, background: BackgroundTasks, sync_audit: bool) -> dict:
    args = result.pop("_audit")
    eng = engine()
    if sync_audit or not settings.ASYNC_AUDIT:
        t = time.perf_counter()
        result["audit"] = eng.write_audit(args)
        result["timings"]["audit_ms"] = (time.perf_counter() - t) * 1000
    else:
        background.add_task(eng.write_audit, args)
        result["audit"] = {"status": "en file d'attente (asynchrone)"}
    return result

@app.get("/health")
def health():
    eng = engine()
    return {"status": "ok", "chain_id": eng.chain.chain_id, "block": eng.chain.w3.eth.block_number, "model": eng.risk.meta, "pdp_account": eng.chain.account.address}

@app.post("/access")
def access(req: AccessRequest, background: BackgroundTasks, principal: Principal = Depends(current_principal), sync_audit: bool = Query(False)):
    user = principal.username
    device = req.device or f"{user}-device"
    print(f"ACCESS user={user!r} raw_device={req.device!r} device_used={device!r}", flush=True)

    now_ms = time.time_ns() // 1_000_000
    added_risk = 0
    added_reasons = []
    timestamp_problem = timestamp_error(req.timestamp, now_ms)
    nonce_valid = False

    if timestamp_problem:
        added_risk += 100
        added_reasons.append(f"requête refusée : {timestamp_problem} (+100)")
    else:
        try:
            nonce_valid = bool(r.set(
                f"request_nonce:{principal.sub}:{req.nonce}",
                "1",
                nx=True,
                ex=settings.REQUEST_NONCE_TTL_SECONDS,
            ))
        except redis.RedisError as exc:
            raise HTTPException(status_code=503, detail="anti_replay_store_unavailable") from exc
        if not nonce_valid:
            added_risk += 100
            added_reasons.append("requête refusée : nonce déjà utilisé (+100)")

    if nonce_valid and req.location:
        location_key = f"last_location:{principal.sub}"
        try:
            last_location = r.get(location_key)
            if last_location:
                previous = json.loads(last_location)
                travel_risk, travel_reason = impossible_travel_risk(
                    previous.get("location"),
                    previous.get("timestamp_ms"),
                    req.location,
                    now_ms,
                )
                added_risk += travel_risk
                if travel_reason:
                    added_reasons.append(travel_reason)
        except (redis.RedisError, json.JSONDecodeError, TypeError, ValueError) as exc:
            raise HTTPException(status_code=503, detail="request_context_store_unavailable") from exc

    # --- LECTURE DE L'ÉTAT D'ATTAQUE DANS REDIS ---
    if r.get("attack_active") == "1":
        # Si une attaque est détectée par le sniffer, on utilise un flux malveillant
        flow = {"bidirectional_duration_ms": 1.0, "bidirectional_packets": 5000, "bidirectional_bytes": 500000.0}
    else:
        flow = pick_flow(req.flow, req.flow_sample, req.flow_index)
        
    result = engine().decide(
        user,
        device,
        req.resource,
        flow,
        req.location,
        req.hour,
        req.otp,
        additional_context_risk=added_risk,
        additional_context_reasons=added_reasons,
    )
    if nonce_valid and req.location and result["decision"] == "ALLOW":
        try:
            r.set(
                f"last_location:{principal.sub}",
                json.dumps({"location": req.location, "timestamp_ms": now_ms}),
                ex=settings.TRAVEL_STATE_TTL_SECONDS,
            )
        except redis.RedisError as exc:
            raise HTTPException(status_code=503, detail="request_context_store_unavailable") from exc
    return finish(result, background, sync_audit)

# --- Etat d'attaque (lecture seule) : seul le sniffer leve attack_active ---
# Meme mecanisme que sniffer.py : la cle Redis "attack_active" force un flux malveillant dans /access.
@app.get("/attack/status")
def attack_status():
    return {"attack_active": r.get("attack_active") == "1"}


@app.get("/resources")
def resources():
    eng = engine()
    return {r: eng.chain.policy_of(r) for r in eng.chain.resources}

@app.get("/identity/{user}")
def identity(user: str):
    eng = engine()
    profile = eng.profiles.get(user)
    return {**eng.chain.user(user), "home_location": profile.get("home_location"), "past_denies": eng.chain.deny_count(user)}

@app.get("/audit")
def audit_list(limit: int = Query(50, ge=1, le=500)):
    eng = engine()
    total = eng.chain.audit_count()
    start = max(0, total - limit)
    entries = eng.chain.audit_entries(start, limit)
    return {"total": total, "entries": list(reversed(entries))}

@app.get("/audit/{request_id}")
def audit_detail(request_id: str):
    eng = engine()
    found = eng.evidence.load(request_id)
    if found is None:
        raise HTTPException(status_code=404, detail="Aucune preuve pour cette requête")
    doc, local_hash = found
    entry = eng.chain.find_entry(request_id)
    return {"request_id": request_id, "evidence": doc, "local_hash": local_hash, "onchain_hash": entry["evidence_hash"] if entry else None, "integrity_ok": bool(entry and entry["evidence_hash"] == local_hash), "onchain_entry": entry}

@app.post("/admin/users", dependencies=[Depends(require_admin)])
def add_user(u: NewUser):
    """Enregistre un utilisateur sur la blockchain (IdentityRegistry), cree son profil hors chaine
    (zone habituelle) et lui lie l'appareil par defaut "<user>-device".
    Aucun secret TOTP n'est cree ici : l'utilisateur active lui-meme sa MFA (POST /mfa/enroll).
    Appelee par le backend Spring Boot apres la creation du compte dans Keycloak."""
    eng = engine()
    if eng.chain.user(u.user)["registered"]:
        raise HTTPException(status_code=409, detail="Utilisateur deja enregistre sur la blockchain")
    tx = eng.chain.register_user(u.user, u.role)
    eng.profiles.set(u.user, {"home_location": u.home_location})
    device = f"{u.user}-device"
    dev_tx = eng.chain.register_device(device, u.user)
    return {"tx_hash": tx.tx_hash, "gas_used": tx.gas_used, "device": device, "device_tx_hash": dev_tx.tx_hash}

@app.post("/admin/users/{user}/mfa/reset", dependencies=[Depends(require_admin)])
def reset_user_mfa(user: str):
    """Perte du telephone : desactive la MFA de l'utilisateur. Le secret n'est jamais renvoye a l'admin ;
    l'utilisateur devra reactiver sa MFA en scannant un nouveau QR code."""
    eng = engine()
    if not eng.chain.user(user)["registered"]:
        raise HTTPException(status_code=404, detail="Utilisateur inconnu")
    return eng.mfa.reset(user)

@app.post("/admin/users/{user}/revoke", dependencies=[Depends(require_admin)])
def revoke_user(user: str):
    eng = engine()
    tx = eng.chain.revoke_user(user)
    for sid in [k for k, s in eng.sessions.items() if s["user"] == user]:
        eng.sessions.pop(sid)
    return {"tx_hash": tx.tx_hash, "gas_used": tx.gas_used}

@app.post("/admin/devices", dependencies=[Depends(require_admin)])
def add_device(d: NewDevice):
    eng = engine()
    tx = eng.chain.register_device(d.device, d.owner)
    return {"tx_hash": tx.tx_hash, "gas_used": tx.gas_used}

# --- Activation de la MFA par l'utilisateur (QR code) ---
# Identite tiree du JWT Keycloak : un utilisateur ne peut agir que sur sa propre MFA.
def _mfa(call):
    try:
        return call()
    except MfaError as e:
        raise HTTPException(status_code=e.status, detail=e.detail) from e

@app.get("/mfa/status")
def mfa_status(principal: Principal = Depends(current_principal)):
    return engine().mfa.status(principal.username)

@app.post("/mfa/enroll")
def mfa_enroll(req: MfaEnrollRequest | None = None, principal: Principal = Depends(current_principal)):
    """Genere un nouveau secret en attente et le renvoie (avec le QR code) au seul proprietaire du compte."""
    return _mfa(lambda: engine().mfa.enroll(principal.username, req.current_otp if req else None))

@app.post("/mfa/confirm")
def mfa_confirm(req: MfaConfirmRequest, principal: Principal = Depends(current_principal)):
    """Active la MFA si le premier code est valide. Le secret n'est plus jamais renvoye ensuite."""
    return _mfa(lambda: engine().mfa.confirm(principal.username, req.otp))

@app.post("/session/{session_id}/reverify")
def reverify(session_id: str, req: ReverifyRequest, background: BackgroundTasks, sync_audit: bool = Query(False)):
    result = engine().reverify(session_id, pick_flow(req.flow, req.flow_sample, req.flow_index), req.hour)
    if result is None:
        raise HTTPException(status_code=404, detail="Session inconnue ou déjà révoquée")
    if "_audit" not in result:
        return result
    return finish(result, background, sync_audit)

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/register-device", dependencies=[Depends(require_admin)])
def register_device(user: str, device: str):
    eng = engine()
    if eng.chain.device_trusted(device, user):
        return {"status": "already_exists"}
    tx = eng.chain.register_device(device, user)
    return {"status": "registered", "tx_hash": tx.tx_hash}
