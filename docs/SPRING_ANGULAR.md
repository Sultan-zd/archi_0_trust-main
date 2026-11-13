# Backend Spring Boot + Frontend Angular

Cette partie remplace l'ancienne interface Streamlit et ajoute un vrai backend metier.
Le moteur Zero Trust (FastAPI + IA + smart contracts) reste inchange : c'est lui qui **decide**.

```
Angular :4200 ──JWT Keycloak──▶ Spring Boot :8081 ──JWT utilisateur──▶ FastAPI :8000 ──▶ IA + blockchain
 (keycloak-js, PKCE)            │  roles User / Fleet / Admin            (PEP / PDP)
                                ├─ PostgreSQL :5432 (bornes, historique des charges)
                                ├─ x-api-key ──▶ FastAPI /admin/* et /attack/*   (la cle ne quitte jamais le backend)
                                └─ admin Keycloak (creation / desactivation de comptes)
```

| Qui | Ce qu'il fait |
|---|---|
| Angular | Connexion Keycloak (aucun mot de passe dans l'app), bornes, saisie du code MFA, historique, micro-segments, supervision admin |
| Spring Boot | Valide le JWT et les roles, enregistre bornes et sessions en base, relaie les demandes d'acces vers FastAPI avec le jeton de l'utilisateur, gere les comptes (Keycloak + blockchain) |
| FastAPI | Decision Zero Trust : score IA, politique on-chain, journal d'audit |

> Pour tout lancer d'un coup avec Docker, voir [DOCKER.md](DOCKER.md). Ce qui suit decrit le lancement manuel.

## Prerequis

Java 21, Node 22, Docker, et le reste du projet deja en marche (voir le README principal) :
Keycloak (`scripts/setup_keycloak.py` + `scripts/disable_totp.py`), nœud Hardhat, contrats deployes, `seed_identities`, Redis, FastAPI.

> **Important** : relancer `python -m scripts.seed_identities` apres avoir recupere la branche. Il enregistre
> les appareils `<utilisateur>-device` ; sans eux, chaque demande donne MFA.

## Demarrage

```bash
# 1. Base PostgreSQL (une fois)
cd backend && docker compose up -d

# 2. Backend Spring Boot  (http://localhost:8081)
#    Ouvrir backend/pom.xml dans IntelliJ puis lancer EvChargeApplication, ou :
mvn spring-boot:run

# 3. Frontend Angular  (http://localhost:4200)
cd ../frontend
npm install
npm start
```

Variables utiles du backend (valeurs par defaut dans `backend/src/main/resources/application.yml`) :
`ADMIN_API_KEY` (doit etre egal a celui du `.env` FastAPI), `KEYCLOAK_URL`, `FASTAPI_URL`, `ZTB_DB_*`.

> Utiliser **`127.0.0.1`** (et non `localhost`) pour Keycloak : c'est l'issuer attendu par FastAPI.
> `frontend/src/app/config.ts` pointe sur le port **8180** (celui de Docker). En lancement manuel, demarrer Keycloak
> avec `-p 8180:8080`, ou remettre `8080` dans `config.ts` (et dans `application.yml` cote backend).
> Le backend Spring accepte les deux, FastAPI aussi depuis la branche `fix/api-spring-prep`.

## Comptes de demonstration

| Utilisateur | Mot de passe | Role |
|---|---|---|
| alice | alice123 | User |
| bob | bob123 | Fleet |
| root | root123 | Admin |
| eve | eve123 | User (a revoquer pour la demonstration : root, Utilisateurs, Revoquer) |

## Parcours a presenter

1. **alice**, borne A (Lyon) → `ALLOW`, risque 0. Borne B (Paris) → `ALLOW` mais risque **25** avec la mention « zone inhabituelle » : c'est juste sous le seuil MFA (30) de `charge:start`. Chaque refus passe ajoute 5 points : apres un premier refus (etape 3), Paris donne `MFA`.
2. **alice**, « Appareil inconnu » dans le mode test → `MFA` ; saisir le code de l'application d'authentification (MFA activee au prealable dans Securite (MFA) en scannant un QR code).
3. **alice**, onglet Micro-segments → tester `admin:firmware` → `DENY` (role insuffisant).
4. **root**, Supervision → « Lancer l'attaque » ; retour sur le compte alice → `DENY` (flux DoS). Arreter l'attaque.
5. **root**, journal blockchain → « Verifier » : integrite de la preuve.
6. **root**, Utilisateurs → creer un compte (l'utilisateur active lui-meme sa MFA), reinitialiser une MFA, puis revoquer un compte (par exemple eve : son acces est coupe sur la blockchain et dans Keycloak).

## API du backend (`/api`)

| Route | Role | Description |
|---|---|---|
| `GET /health` | public | Etat du backend et de FastAPI |
| `GET /me` | tous | Profil + identite on-chain |
| `GET /stations` | tous | Bornes et disponibilite |
| `POST /stations/{id}/charge` | tous | Demande de charge `{device?, otp?}` → decision ; rejouer avec `otp` apres un MFA |
| `GET /sessions` · `POST /sessions/{id}/stop` | tous | Historique personnel · arret de charge |
| `GET /resources` · `POST /access/{resource}` | tous | Micro-segments et test d'acces |
| `GET /admin/overview` · `/admin/sessions` | Admin | Statistiques et sessions de tous les utilisateurs |
| `GET /admin/audit` · `/admin/audit/{requestId}` | Admin | Journal blockchain · controle d'integrite |
| `GET/POST /admin/users` · `POST /admin/users/{u}/revoke` · `POST /admin/users/{u}/mfa/reset` | Admin | Gestion des comptes |
| `GET /mfa/status` · `POST /mfa/enroll` · `POST /mfa/confirm` | Utilisateur connecte (son propre compte) | Activation de la MFA par QR code |
| `GET /admin/attack` · `POST /admin/attack/start` · `/stop` | Admin | Simulation d'attaque (Redis) |

## Limites connues

- Les etats « session de charge » sont stockes dans PostgreSQL ; la re-verification periodique
  (`/session/{id}/reverify` de FastAPI) n'est pas encore branchee.
- Le mode test (appareil inconnu) est une aide de demonstration, a retirer en production. L'affichage du code TOTP cote admin a ete supprime.
- Le compte administrateur Keycloak (`admin/admin`) est utilise par le backend pour creer des comptes :
  en production, utiliser un client a « service account » aux droits limites.
