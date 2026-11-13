from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import requests
from jwt import PyJWKClient
from api import settings

bearer = HTTPBearer(auto_error=False)

KEYCLOAK_URL = settings.KEYCLOAK_URL
REALM = settings.KEYCLOAK_REALM
JWKS_URL = f"{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/certs"
ISSUER = f"{KEYCLOAK_URL}/realms/{REALM}"
# Le meme Keycloak peut etre joint via 127.0.0.1 ou localhost : les deux issuers sont acceptes.
# La signature reste verifiee avec les cles du realm, seul le nom d'hote de l'issuer differe.
ALLOWED_ISSUERS = list(dict.fromkeys([ISSUER, *settings.KEYCLOAK_EXTRA_ISSUERS]))

_jwks_client = PyJWKClient(JWKS_URL, cache_keys=True)

class Principal:
    def __init__(self, sub: str, username: str, role: str):
        self.sub = sub
        self.username = username
        self.role = role

def current_principal(cred: HTTPAuthorizationCredentials = Depends(bearer)) -> Principal:
    if cred is None:
        raise HTTPException(status_code=401, detail="missing_token")
    token = cred.credentials
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(token, signing_key.key, algorithms=["RS256"], issuer=ALLOWED_ISSUERS, options={"verify_aud": False})
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"invalid_token: {e}")

    roles = payload.get("realm_access", {}).get("roles", [])
    role = next((r for r in ("Admin", "Fleet", "User") if r in roles), None)
    if role is None:
        raise HTTPException(status_code=403, detail="no_role")
    return Principal(sub=payload["sub"], username=payload.get("preferred_username", ""), role=role)
