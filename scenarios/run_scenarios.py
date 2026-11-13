import json
import os
import time
import uuid

import jwt
import pyotp
import redis
import requests
from api import settings

API = os.getenv("API_URL", "http://127.0.0.1:8000")
KEYCLOAK_URL = os.getenv("SCENARIOS_KEYCLOAK_URL", os.getenv("KEYCLOAK_URL", "http://127.0.0.1:8180"))
CLIENT_ID = os.getenv("SCENARIOS_CLIENT_ID", "ztb-frontend")
PASSWORDS = {
    "alice": os.getenv("ALICE_PASSWORD", "alice123"),
    "bob": os.getenv("BOB_PASSWORD", "bob123"),
    "root": os.getenv("ROOT_PASSWORD", "root123"),
    "eve": os.getenv("EVE_PASSWORD", "eve123"),
}
TOKENS = {}
MFA_SECRETS = {}
LAST_OTP_COUNTER = {}
CONSUMED_OTP_COUNTER = {}


def access_token(user):
    if user not in TOKENS:
        response = requests.post(
            f"{KEYCLOAK_URL}/realms/ztb/protocol/openid-connect/token",
            data={
                "client_id": CLIENT_ID,
                "username": user,
                "password": PASSWORDS[user],
                "grant_type": "password",
            },
            timeout=15,
        )
        response.raise_for_status()
        TOKENS[user] = response.json()["access_token"]
    return TOKENS[user]


def new_access_request(device, resource, sample, location=None, hour=12, otp=None, index=0):
    return {
        "resource": resource,
        "device": device,
        "flow_sample": sample,
        "flow_index": index,
        "location": location,
        "hour": hour,
        "otp": otp,
        "nonce": str(uuid.uuid4()),
        "timestamp": time.time_ns() // 1_000_000,
    }


def auth_header(user):
    return {"Authorization": f"Bearer {access_token(user)}"}


def ensure_mfa(user):
    """Active la MFA de l'utilisateur par l'API, comme le ferait l'ecran « Activer la MFA » :
    /mfa/enroll renvoie le secret (une seule fois), /mfa/confirm l'active avec un premier code.
    Si la MFA est deja activee, le secret actif est lu dans le volume partage (le test tourne dans le conteneur api)."""
    response = requests.get(f"{API}/mfa/status", headers=auth_header(user), timeout=15)
    response.raise_for_status()
    if response.json()["enabled"]:
        MFA_SECRETS[user] = json.loads(settings.USERS_FILE.read_text(encoding="utf-8"))[user]["totp_secret"]
        return
    response = requests.post(f"{API}/mfa/enroll", json={}, headers=auth_header(user), timeout=15)
    response.raise_for_status()
    MFA_SECRETS[user] = response.json()["secret"]
    code = fresh_otp(user)
    response = requests.post(f"{API}/mfa/confirm", json={"otp": code}, headers=auth_header(user), timeout=15)
    response.raise_for_status()
    CONSUMED_OTP_COUNTER[user] = LAST_OTP_COUNTER[user]
    print(f"MFA de {user} activée via /mfa/enroll + /mfa/confirm")


def fresh_otp(user):
    """Code TOTP courant ; attend la fenetre suivante si le code courant a deja ete accepte (anti-rejeu)."""
    totp = pyotp.TOTP(MFA_SECRETS[user])
    while True:
        counter = int(time.time() // totp.interval)
        if counter > CONSUMED_OTP_COUNTER.get(user, -1):
            break
        wait = totp.interval - time.time() % totp.interval + 0.5
        print(f"  (attente {wait:.0f} s du prochain code TOTP de {user} : un code ne sert qu'une fois)")
        time.sleep(wait)
    LAST_OTP_COUNTER[user] = counter
    return totp.at(counter * totp.interval)


def send_access(user, body):
    response = requests.post(
        f"{API}/access",
        json=body,
        params={"sync_audit": "true"},
        headers=auth_header(user),
        timeout=60,
    )
    response.raise_for_status()
    res = response.json()
    if body.get("otp") and res.get("mfa_passed") is not None:
        CONSUMED_OTP_COUNTER[user] = LAST_OTP_COUNTER[user]
    return res


def access(user, device, resource, sample, location=None, hour=12, otp=None, index=0):
    body = new_access_request(device, resource, sample, location, hour, otp, index)
    return send_access(user, body)


def reverify(session_id, body):
    response = requests.post(f"{API}/session/{session_id}/reverify", json=body, params={"sync_audit": "true"}, timeout=60)
    response.raise_for_status()
    return response.json()


def reset_travel_state(users):
    with redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0, decode_responses=True) as store:
        for user in users:
            claims = jwt.decode(
                access_token(user),
                options={
                    "verify_signature": False,
                    "verify_exp": False,
                    "verify_aud": False,
                    "verify_iss": False,
                },
            )
            store.delete(f"last_location:{claims['sub']}")


def ensure_revoked(user):
    response = requests.get(f"{API}/identity/{user}", timeout=15)
    response.raise_for_status()
    identity = response.json()
    if not identity["registered"]:
        raise RuntimeError(f"L'utilisateur de démonstration {user} n'est pas enregistré sur la blockchain")
    if identity["active"]:
        response = requests.post(
            f"{API}/admin/users/{user}/revoke",
            headers={"x-api-key": settings.ADMIN_API_KEY},
            timeout=30,
        )
        response.raise_for_status()


def main():
    if not settings.USERS_FILE.exists():
        raise FileNotFoundError(
            f"Profils de démonstration introuvables ({settings.USERS_FILE}). "
            "Lancez ce script avec `docker compose exec api python -m scenarios.run_scenarios`."
        )
    reset_travel_state(("alice", "bob", "root", "eve"))
    ensure_revoked("eve")
    results = []

    def check(name, expected, res, note=""):
        got = res["decision"]
        ok = got == expected
        results.append({
            "scenario": name,
            "expected": expected,
            "got": got,
            "reason": res.get("reason"),
            "risk": res.get("risk", {}).get("final"),
            "context_reasons": res.get("risk", {}).get("context_reasons", []),
            "ok": ok,
            "request_id": res.get("request_id"),
        })
        print(
            f"{'OK ' if ok else 'ECHEC'} {name:52s} attendu={expected:5s} obtenu={got:5s} "
            f"raison={res.get('reason')} risque={res.get('risk', {}).get('final')} {note}"
        )
        return res

    ensure_mfa("alice")
    ensure_mfa("root")
    alice_otp = lambda: fresh_otp("alice")
    root_otp = lambda: fresh_otp("root")

    # Le secret n'est plus jamais renvoye une fois la MFA activee (sans code valide de l'application).
    reissue = requests.post(f"{API}/mfa/enroll", json={}, headers=auth_header("alice"), timeout=15)
    ok = reissue.status_code == 409 and "secret" not in reissue.json()
    results.append({"scenario": "0. Secret TOTP non réaffiché après activation", "expected": "409", "got": str(reissue.status_code), "ok": ok})
    print(f"{'OK ' if ok else 'ECHEC'} {'0. Secret TOTP non réaffiché après activation':52s} attendu=409   obtenu={reissue.status_code}")

    r1 = check(
        "1. Utilisateur légitime (alice, téléphone connu)",
        "ALLOW",
        access("alice", "alice-phone", "charge:start", "Benign", "Lyon", otp=alice_otp()),
    )
    sid = r1["session"]["id"]
    check(
        "1a. Session réévaluée, trafic normal",
        r1["policy_decision"],
        reverify(sid, {"flow_sample": "Benign", "flow_index": 1, "hour": 12}),
    )
    check(
        "1b. Session réévaluée, trafic devient attaque",
        "DENY",
        reverify(sid, {"flow_sample": "DoS", "flow_index": 1, "hour": 12}),
    )

    check("2a. Appareil inconnu -> MFA", "MFA", access("alice", "unknown-tablet", "charge:start", "Benign", "Lyon"))
    check(
        "2b. Appareil inconnu + code TOTP valide",
        "ALLOW",
        access("alice", "unknown-tablet", "charge:start", "Benign", "Lyon", otp=alice_otp()),
    )
    check(
        "2c. Impossible travel (Lyon -> Marseille)",
        "DENY",
        access("alice", "alice-phone", "charge:start", "Benign", "Marseille"),
    )

    stale_request = new_access_request("alice-phone", "charge:start", "Benign", "Lyon")
    stale_request["timestamp"] -= 60_000
    check("2d. Horodatage expiré", "DENY", send_access("alice", stale_request))

    replay_request = new_access_request("alice-phone", "charge:start", "Benign", "Lyon", otp=alice_otp())
    check("2e. Première requête avec nonce", "ALLOW", send_access("alice", replay_request))
    check("2f. Rejeu exact de la requête", "DENY", send_access("alice", replay_request))

    check(
        "3a. Attaque DoS depuis un appareil de confiance",
        "DENY",
        access("bob", "bob-laptop", "fleet:dashboard", "DoS", "Paris"),
    )
    check(
        "3b. Reconnaissance (scan)",
        "DENY",
        access("bob", "bob-laptop", "fleet:dashboard", "Recon", "Paris"),
    )
    check("4. Utilisateur révoqué (eve)", "DENY", access("eve", "eve-phone", "charge:start", "Benign", "Lyon"))
    check(
        "5a. Rôle insuffisant (alice -> admin:firmware)",
        "DENY",
        access("alice", "alice-phone", "admin:firmware", "Benign", "Lyon"),
    )
    check(
        "5b. Admin hors plage horaire (23h UTC)",
        "DENY",
        access("root", "root-laptop", "admin:firmware", "Benign", "Lyon", hour=23),
    )
    check(
        "5c. Admin de confiance, 10h UTC + code TOTP",
        "ALLOW",
        access("root", "root-laptop", "admin:firmware", "Benign", "Lyon", hour=10, otp=root_otp()),
    )

    time.sleep(0.5)
    integrity = requests.get(f"{API}/audit/{r1['request_id']}", timeout=30).json()
    ok = integrity["integrity_ok"]
    results.append({
        "scenario": "8. Intégrité du journal (empreinte on-chain)",
        "expected": "True",
        "got": str(ok),
        "ok": ok,
    })
    print(
        f"{'OK ' if ok else 'ÉCHEC'} 8. Intégrité du journal (empreinte on-chain) "
        f"local={integrity['local_hash'][:18]}... on-chain={str(integrity['onchain_hash'])[:18]}..."
    )

    passed = sum(result["ok"] for result in results)
    print(f"\n{passed}/{len(results)} scénarios conformes")
    report_dir = settings.ROOT / "reports"
    report_dir.mkdir(exist_ok=True)
    (report_dir / "scenarios.json").write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    if passed != len(results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
