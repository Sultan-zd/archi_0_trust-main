import os
import requests
import json
import time

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://127.0.0.1:8080")
ADMIN_USER = os.getenv("KEYCLOAK_ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin")
REALM = "ztb"

# Attendre que Keycloak soit prêt
print("Attente de Keycloak...")
for i in range(30):
    try:
        r = requests.get(f"{KEYCLOAK_URL}/realms/master", timeout=5)
        if r.status_code == 200:
            break
    except:
        pass
    time.sleep(2)
else:
    print("Keycloak ne répond pas")
    exit(1)

# 1. Authentification admin
print("Connexion admin...")
r = requests.post(f"{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token",
    data={"client_id": "admin-cli", "username": ADMIN_USER, "password": ADMIN_PASS, "grant_type": "password"})
r.raise_for_status()
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 2. Créer le realm ztb
print("Création du realm ztb...")
r = requests.post(f"{KEYCLOAK_URL}/admin/realms", headers=headers,
    json={"realm": REALM, "enabled": True, "registrationAllowed": False, "loginWithEmailAllowed": True, "duplicateEmailsAllowed": False})
if r.status_code == 409:
    print("Realm existe déjà")
else:
    r.raise_for_status()

# 3. Créer les rôles
print("Création des rôles...")
for role in ["User", "Fleet", "Admin"]:
    r = requests.post(f"{KEYCLOAK_URL}/admin/realms/{REALM}/roles", headers=headers, json={"name": role})
    if r.status_code == 409:
        print(f"Rôle {role} existe déjà")
    else:
        r.raise_for_status()

# 4. Créer le client ztb-backend (pour l'API)
print("Création du client ztb-backend...")
r = requests.post(f"{KEYCLOAK_URL}/admin/realms/{REALM}/clients", headers=headers, json={
    "clientId": "ztb-backend", "enabled": True, "publicClient": False, "serviceAccountsEnabled": True,
    "secret": "ztb-secret", "redirectUris": ["*"]})
if r.status_code == 409:
    print("Client ztb-backend existe déjà")
else:
    r.raise_for_status()

# 5. Créer le client ztb-frontend (pour l'utilisateur)
print("Création du client ztb-frontend...")
r = requests.post(f"{KEYCLOAK_URL}/admin/realms/{REALM}/clients", headers=headers, json={
    "clientId": "ztb-frontend", "enabled": True, "publicClient": True, "standardFlowEnabled": True,
    "directAccessGrantsEnabled": True, "redirectUris": ["http://localhost:*"], "webOrigins": ["*"]})
if r.status_code == 409:
    print("Client ztb-frontend existe déjà")
else:
    r.raise_for_status()

# 6. Créer les utilisateurs
print("Création des utilisateurs...")
users = [
    {"username": "alice", "password": "alice123", "role": "User", "email": "alice@example.com"},
    {"username": "bob", "password": "bob123", "role": "Fleet", "email": "bob@example.com"},
    {"username": "root", "password": "root123", "role": "Admin", "email": "root@example.com"},
    {"username": "eve", "password": "eve123", "role": "User", "email": "eve@example.com"},
]

for u in users:
    r = requests.post(f"{KEYCLOAK_URL}/admin/realms/{REALM}/users", headers=headers, json={
        "username": u["username"], "email": u["email"], "enabled": True, "emailVerified": True,
        "credentials": [{"type": "password", "value": u["password"], "temporary": False}]})
    if r.status_code == 409:
        print(f"Utilisateur {u['username']} existe déjà")
        continue
    r.raise_for_status()
    user_id = r.headers["Location"].split("/")[-1]
    
    # Assigner le rôle
    role_r = requests.get(f"{KEYCLOAK_URL}/admin/realms/{REALM}/roles/{u['role']}", headers=headers)
    role = role_r.json()
    requests.post(f"{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user_id}/role-mappings/realm", headers=headers, json=[role]).raise_for_status()
    print(f"Utilisateur {u['username']} créé avec rôle {u['role']}")

print("\n=== Configuration terminée ===")
print(f"Realm: {REALM}")
print(f"Client frontend: ztb-frontend")
print(f"Client backend: ztb-backend (secret: ztb-secret)")
print(f"Utilisateurs: alice/alice123 (User), bob/bob123 (Fleet), root/root123 (Admin), eve/eve123 (User)")
