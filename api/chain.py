import json
import threading
import time
from dataclasses import dataclass
from eth_account import Account
from web3 import Web3
from web3.exceptions import Web3RPCError

ROLES = {1: "User", 2: "Fleet", 3: "Admin"}
ROLE_IDS = {v: k for k, v in ROLES.items()}
DECISIONS = {0: "ALLOW", 1: "MFA", 2: "DENY"}
DECISION_IDS = {v: k for k, v in DECISIONS.items()}
REASONS = ["OK", "RESOURCE_UNKNOWN", "RESOURCE_DISABLED", "USER_UNKNOWN", "USER_REVOKED", "ROLE_TOO_LOW", "OUTSIDE_HOURS", "DEVICE_UNTRUSTED", "RISK_MFA", "RISK_DENY", "DEVICE_UNKNOWN_MFA"]

def to_id(text: str) -> bytes:
    return Web3.keccak(text=text)

@dataclass
class TxResult:
    tx_hash: str
    block: int
    gas_used: int
    seconds: float

class Chain:
    def __init__(self, rpc_url: str, deployments_file, private_key: str):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 30}))
        if not self.w3.is_connected():
            raise RuntimeError(f"Noeud blockchain injoignable : {rpc_url}")
        d = json.loads(open(deployments_file, encoding="utf-8").read())
        c = d["contracts"]
        self.registry = self.w3.eth.contract(address=c["IdentityRegistry"]["address"], abi=c["IdentityRegistry"]["abi"])
        self.policy = self.w3.eth.contract(address=c["AccessPolicy"]["address"], abi=c["AccessPolicy"]["abi"])
        self.audit = self.w3.eth.contract(address=c["AuditLog"]["address"], abi=c["AuditLog"]["abi"])
        self.resources = d.get("resources", [])
        self.account = Account.from_key(private_key)
        self.chain_id = self.w3.eth.chain_id
        self._lock = threading.Lock()
        self._nonce = self.w3.eth.get_transaction_count(self.account.address, "pending")

    def _send(self, fn) -> TxResult:
        with self._lock:
            for attempt in range(1, 6):
                tx = fn.build_transaction({"from": self.account.address, "nonce": self._nonce, "chainId": self.chain_id})
                signed = self.account.sign_transaction(tx)
                t0 = time.perf_counter()
                try:
                    tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
                    break
                except Web3RPCError as exc:
                    if attempt == 5 or "nonce" not in str(exc).lower():
                        raise
                    self._nonce = self.w3.eth.get_transaction_count(self.account.address, "pending")
            self._nonce += 1
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
            if receipt.status != 1:
                raise RuntimeError(f"Transaction annulee : {tx_hash.hex()}")
            return TxResult("0x" + tx_hash.hex().removeprefix("0x"), receipt.blockNumber, receipt.gasUsed, time.perf_counter() - t0)

    def register_user(self, user: str, role: str) -> TxResult:
        return self._send(self.registry.functions.registerUser(to_id(user), ROLE_IDS[role]))

    def revoke_user(self, user: str) -> TxResult:
        return self._send(self.registry.functions.revokeUser(to_id(user)))

    def register_device(self, device: str, owner: str) -> TxResult:
        return self._send(self.registry.functions.registerDevice(to_id(device), to_id(owner)))

    def revoke_device(self, device: str) -> TxResult:
        return self._send(self.registry.functions.revokeDevice(to_id(device)))

    def log_decision(self, request_id: str, user: str, device: str, resource: str, risk: int, decision: str, reason: str, evidence_hash: bytes) -> TxResult:
        return self._send(self.audit.functions.logDecision(to_id(request_id), to_id(user), to_id(device), to_id(resource), int(risk), DECISION_IDS[decision], REASONS.index(reason), evidence_hash))

    def user(self, user: str) -> dict:
        role, active, registered_at, revoked_at = self.registry.functions.getUser(to_id(user)).call()
        return {"registered": registered_at != 0, "active": active, "role": ROLES.get(role, "None"), "registered_at": registered_at, "revoked_at": revoked_at}

    def device_trusted(self, device: str, user: str) -> bool:
        return self.registry.functions.isDeviceTrusted(to_id(device), to_id(user)).call()

    def evaluate(self, user: str, device: str, resource: str, risk: int, hour: int) -> tuple[str, str]:
        d, r = self.policy.functions.evaluate(to_id(user), to_id(device), to_id(resource), int(risk), int(hour)).call()
        return DECISIONS[d], REASONS[r]

    def policy_of(self, resource: str) -> dict:
        p = self.policy.functions.getPolicy(to_id(resource)).call()
        keys = ["min_role", "mfa_threshold", "deny_threshold", "start_hour", "end_hour", "require_trusted_device", "active"]
        out = dict(zip(keys, p))
        out["min_role"] = ROLES.get(out["min_role"], "None")
        return out

    def deny_count(self, user: str) -> int:
        return self.audit.functions.denyCount(to_id(user)).call()

    def audit_count(self) -> int:
        return self.audit.functions.count().call()

    def find_entry(self, request_id: str) -> dict | None:
        logs = self.audit.events.DecisionLogged.get_logs(argument_filters={"requestId": to_id(request_id)}, from_block=0)
        if not logs:
            return None
        index = logs[0]["args"]["index"]
        e = self.audit.functions.getEntry(index).call()
        req, user, dev, res, ev, ts, risk, dec, reason = e
        return {
            "index": index,
            "request_id": "0x" + req.hex(),
            "user_id": "0x" + user.hex(),
            "device_id": "0x" + dev.hex(),
            "resource_id": "0x" + res.hex(),
            "evidence_hash": "0x" + ev.hex(),
            "timestamp": ts,
            "risk": risk,
            "decision": DECISIONS[dec],
            "reason": REASONS[reason],
            "tx_hash": "0x" + logs[0]["transactionHash"].hex().removeprefix("0x"),
            "block": logs[0]["blockNumber"],
        }

    def audit_entries(self, start: int, n: int) -> list[dict]:
        total = self.audit.functions.count().call()
        out = []
        for i in range(start, min(start + n, total)):
            e = self.audit.functions.getEntry(i).call()
            req, user, dev, res, ev, ts, risk, dec, reason = e
            out.append({
                "index": i,
                "request_id": "0x" + req.hex(),
                "user_id": "0x" + user.hex(),
                "device_id": "0x" + dev.hex(),
                "resource_id": "0x" + res.hex(),
                "evidence_hash": "0x" + ev.hex(),
                "timestamp": ts,
                "risk": risk,
                "decision": DECISIONS[dec],
                "reason": REASONS[reason],
            })
        return out
