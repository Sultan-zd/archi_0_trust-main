from api import settings
from api.chain import Chain
from api.pdp import UserProfiles

USERS = [
    ("alice", "User", "Lyon"),
    ("bob", "Fleet", "Paris"),
    ("root", "Admin", "Lyon"),
    ("eve", "User", "Lyon"),
]
DEVICES = [
    ("alice-phone", "alice"),
    ("dev-alice-01", "alice"),
    ("bob-laptop", "bob"),
    ("root-laptop", "root"),
    ("eve-phone", "eve"),
    # Appareil par defaut utilise par POST /access quand le client n'envoie pas de "device".
    ("alice-device", "alice"),
    ("bob-device", "bob"),
    ("dev-bob-01", "bob"),
    ("root-device", "root"),
    ("eve-device", "eve"),
]

def main() -> None:
    chain = Chain(settings.CHAIN_RPC_URL, settings.DEPLOYMENTS_FILE, settings.PDP_PRIVATE_KEY)
    profiles = UserProfiles(settings.USERS_FILE)

    for user, role, zone in USERS:
        if not chain.user(user)["registered"]:
            tx = chain.register_user(user, role)
            print(f"utilisateur {user:6s} ({role}) gas={tx.gas_used}")
        if not profiles.get(user):
            # Pas de secret TOTP : chaque utilisateur active sa MFA lui-meme (ecran « Activer la MFA »).
            profiles.set(user, {"home_location": zone})

    for device, owner in DEVICES:
        if not chain.registry.functions.getDevice(chain.w3.keccak(text=device)).call()[2]:
            tx = chain.register_device(device, owner)
            print(f"appareil {device:12s} -> {owner} gas={tx.gas_used}")

    print(f"Profils hors chaine (zones habituelles, MFA) : {settings.USERS_FILE}")
    for user, *_ in USERS:
        state = "activee" if profiles.get(user).get("mfa_enabled") else "a activer par l'utilisateur"
        print(f" MFA de {user:5s} : {state}")

if __name__ == "__main__":
    main()
