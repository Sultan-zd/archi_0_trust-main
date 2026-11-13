import os
import requests

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://127.0.0.1:8080")
ADMIN_USER = os.getenv("KEYCLOAK_ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin")
REALM = "ztb"

r = requests.post(f"{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token",
    data={"client_id": "admin-cli", "username": ADMIN_USER, "password": ADMIN_PASS, "grant_type": "password"})
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Désactiver CONFIGURE_TOTP
actions = requests.get(f"{KEYCLOAK_URL}/admin/realms/{REALM}/authentication/required-actions", headers=headers).json()
for a in actions:
    if a["alias"] == "CONFIGURE_TOTP":
        a["enabled"] = False
        a["defaultAction"] = False
        r = requests.put(f"{KEYCLOAK_URL}/admin/realms/{REALM}/authentication/required-actions/CONFIGURE_TOTP", headers=headers, json=a)
        print(f"CONFIGURE_TOTP désactivé (status {r.status_code})")

# Aussi désactiver d'autres actions qui pourraient bloquer
for alias in ["UPDATE_PASSWORD", "UPDATE_PROFILE", "VERIFY_EMAIL", "VERIFY_PROFILE"]:
    for a in actions:
        if a["alias"] == alias:
            a["enabled"] = False
            a["defaultAction"] = False
            requests.put(f"{KEYCLOAK_URL}/admin/realms/{REALM}/authentication/required-actions/{alias}", headers=headers, json=a)
            print(f"{alias} désactivé")

print("Terminé")
