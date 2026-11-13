import json, time, uuid
from datetime import datetime, timezone
from ai.risk import RiskEngine
from api import settings
from api.chain import Chain
from api.evidence import EvidenceStore
from api.mfa import MfaService

class UserProfiles:
    def __init__(self, path):
        self.path = path
        self.data = json.loads(path.read_text()) if path.exists() else {}

    def get(self, user: str) -> dict:
        return self.data.get(user, {})

    def set(self, user: str, profile: dict) -> None:
        self.data[user] = profile
        self._save()

    def update(self, user: str, **fields) -> None:
        """Met a jour certains champs du profil ; une valeur None supprime le champ."""
        profile = dict(self.data.get(user, {}))
        for key, value in fields.items():
            if value is None:
                profile.pop(key, None)
            else:
                profile[key] = value
        self.data[user] = profile
        self._save()

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        text = json.dumps(self.data, indent=2)
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        try:
            tmp.write_text(text)
            tmp.replace(self.path)  # ecriture atomique (Linux / Docker)
        except OSError:
            # Windows peut refuser le remplacement d'un fichier ouvert : ecriture directe.
            self.path.write_text(text)
            tmp.unlink(missing_ok=True)

class ZeroTrustEngine:
    def __init__(self, chain: Chain, risk: RiskEngine, evidence: EvidenceStore, profiles: UserProfiles):
        self.chain, self.risk, self.evidence, self.profiles = chain, risk, evidence, profiles
        self.sessions: dict[str, dict] = {}
        self.mfa = MfaService(profiles)

    def context_risk(self, user: str, location: str | None) -> tuple[int, list[str]]:
        points, why = 0, []
        home = self.profiles.get(user).get("home_location")
        if location and home and location != home:
            points += settings.CONTEXT_RISK_LOCATION_MISMATCH
            why.append(f"zone inhabituelle ({location} au lieu de {home}) +{settings.CONTEXT_RISK_LOCATION_MISMATCH}")
        past = self.chain.deny_count(user)
        if past:
            p = min(settings.CONTEXT_RISK_FAST_DENY_CAP, past * settings.CONTEXT_RISK_PER_FAST_DENY)
            points += p
            why.append(f"{past} refus passes enregistres on-chain +{p}")
        return points, why

    def verify_otp(self, user: str, otp: str | None) -> bool:
        # Seul un secret active par l'utilisateur (QR code + premier code) est accepte.
        return self.mfa.verify(user, otp)

    def decide(
        self,
        user: str,
        device: str,
        resource: str,
        flow: dict,
        location: str | None = None,
        hour: int | None = None,
        otp: str | None = None,
        session_id: str | None = None,
        additional_context_risk: int = 0,
        additional_context_reasons: list[str] | None = None,
    ) -> dict:
        t0 = time.perf_counter()
        request_id = str(uuid.uuid4())
        hour = datetime.now(timezone.utc).hour if hour is None else hour
        timings = {}

        t = time.perf_counter()
        identity = self.chain.user(user)
        trusted_device = self.chain.device_trusted(device, user)
        timings["identity_ms"] = (time.perf_counter() - t) * 1000

        t = time.perf_counter()
        ai = self.risk.score(flow)
        timings["ai_ms"] = (time.perf_counter() - t) * 1000

        ctx_points, ctx_why = self.context_risk(user, location)
        ctx_points += additional_context_risk
        if additional_context_reasons:
            ctx_why.extend(additional_context_reasons)
        final_risk = min(100, ai["ai_risk"] + ctx_points)

        t = time.perf_counter()
        decision, reason = self.chain.evaluate(user, device, resource, final_risk, hour)
        timings["policy_ms"] = (time.perf_counter() - t) * 1000
        policy_decision = decision

        mfa = None
        if decision == "MFA" and otp is not None:
            mfa = self.verify_otp(user, otp)
            decision = "ALLOW" if mfa else "DENY"

        doc = {"request_id": request_id, "time_utc": datetime.now(timezone.utc).isoformat(), "hour_utc": hour, "user": user, "device": device, "resource": resource, "location": location, "identity": identity, "trusted_device": trusted_device, "ai": ai, "context_risk": ctx_points, "context_reasons": ctx_why, "final_risk": final_risk, "policy_decision": policy_decision, "reason": reason, "mfa_passed": mfa, "decision": decision, "session_id": session_id, "flow": flow}

        evidence_hash, cid = self.evidence.save(request_id, doc)
        timings["decision_ms"] = (time.perf_counter() - t0) * 1000

        result = {"request_id": request_id, "decision": decision, "reason": reason, "policy_decision": policy_decision, "mfa_enrolled": self.mfa.enabled(user), "risk": {"final": final_risk, "ai": ai["ai_risk"], "context": ctx_points, "context_reasons": ctx_why, "components": ai["components"], "predicted_class": ai["predicted_class"]}, "identity": {"role": identity["role"], "active": identity["active"], "trusted_device": trusted_device}, "mfa_passed": mfa, "evidence_hash": "0x" + evidence_hash.hex(), "ipfs_cid": cid, "timings": timings}

        if decision == "ALLOW":
            sid = session_id or str(uuid.uuid4())
            self.sessions[sid] = {"user": user, "device": device, "resource": resource, "location": location, "expires": time.time() + settings.SESSION_TTL_SECONDS}
            result["session"] = {"id": sid, "ttl_seconds": settings.SESSION_TTL_SECONDS}
        elif session_id:
            self.sessions.pop(session_id, None)
            result["session"] = {"id": session_id, "revoked": True}
        result["_audit"] = (request_id, user, device, resource, final_risk, decision, reason, evidence_hash)
        return result

    def reverify(self, session_id: str, flow: dict, hour: int | None = None) -> dict | None:
        s = self.sessions.get(session_id)
        if not s:
            return None
        if s["expires"] < time.time():
            self.sessions.pop(session_id, None)
            return {"decision": "DENY", "reason": "SESSION_EXPIRED", "session": {"id": session_id, "revoked": True}}
        return self.decide(s["user"], s["device"], s["resource"], flow, s["location"], hour, session_id=session_id)

    def write_audit(self, args) -> dict:
        tx = self.chain.log_decision(*args)
        return {"tx_hash": tx.tx_hash, "block": tx.block, "gas_used": tx.gas_used, "tx_seconds": round(tx.seconds, 4)}
