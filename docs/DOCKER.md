# Tout lancer avec Docker

```bash
docker compose up --build
```

Premier lancement : compter plusieurs minutes (images, Maven, npm, compilateur Solidity). Ensuite c'est rapide.
Quand les services sont prets, ouvrir **http://localhost:4200** et se connecter (comptes ci-dessous).

> Prerequis : Docker Desktop (ou Docker Engine + Compose v2). Arreter d'abord la version manuelle
> (Keycloak, Hardhat, FastAPI, Spring, `npm start`) : les ports **8180**, 8000, 8081, 4200 et 8545 doivent etre libres.

## Ce qui demarre

| Service | Role | Port |
|---|---|---|
| `keycloak` | Authentification (realm `ztb`) | 8180 (8080 a l'interieur du reseau Docker) |
| `keycloak-init` | Execute `scripts/setup_keycloak.py` puis `scripts/disable_totp.py`, puis s'arrete | |
| `chain` | Noeud Hardhat local | 8545 |
| `deploy` | Deploie les contrats (une seule fois par noeud), puis s'arrete | |
| `seed` | Enregistre alice, bob, root, eve et leurs appareils, puis s'arrete | |
| `redis` | Etat d'attaque partage | |
| `api` | API Zero Trust FastAPI (IA, politique, audit) | 8000 |
| `sniffer` | Detecte les floods SYN et ecrit l'etat dans Redis | |
| `postgres` | Base du backend Spring | |
| `backend` | Backend Spring Boot | 8081 |
| `frontend` | Application Angular (nginx) | 4200 |
| `attacker` | Flood SYN a la demande (profil `attack`, ne demarre pas seul) | |

Ordre : `chain` → `deploy` → `seed` → `api` → `sniffer` / `backend` → `frontend`.

## Comptes de demonstration

| Utilisateur | Mot de passe | Role |
|---|---|---|
| alice | alice123 | User |
| bob | bob123 | Fleet |
| root | root123 | Admin |
| eve | eve123 | User (a revoquer pour la demo) |

Console Keycloak : http://127.0.0.1:8180 (admin / admin). Utiliser **127.0.0.1** pour Keycloak, pas `localhost`.

> Keycloak est publie sur **8180** (et non 8080) car 8080 est tres souvent deja pris sur un poste de developpement.
> Seul le port cote machine change : entre conteneurs, les services l'appellent toujours sur `keycloak:8080`.
> L'adresse vue par le navigateur figure dans le jeton (`iss`) : l'API et le backend acceptent donc les issuers `:8180` et `:8080`.
> Pour changer de port : modifier `ports:` du service `keycloak`, `x-issuers` dans `docker-compose.yml` et `url` dans
> `frontend/src/app/config.ts`, puis `docker compose build frontend` (l'URL est fixee a la compilation d'Angular).

## Simuler une attaque

Deux facons, au choix pendant la demonstration :

1. **Bouton** : root → Supervision → « Lancer l'attaque » (ecrit le drapeau dans Redis, sans trafic reel).
2. **Vrai flood reseau** (detecte par le sniffer) :
   ```bash
   docker compose --profile attack run --rm attacker       # 20 s par defaut
   ATTACK_SECONDS=40 docker compose --profile attack run --rm attacker
   docker compose logs -f sniffer                           # dans un autre terminal : « Attaque détectée ! »
   ```
   Pendant le flood, toute demande de charge d'alice est refusee. Environ 3 a 4 secondes apres la fin, le sniffer
   retire le drapeau et l'acces revient.

Le sniffer et l'attaquant partagent la pile reseau du conteneur `api` : l'attaque vise `127.0.0.1:8000` *dans* ce
conteneur. Ca fonctionne aussi sous Windows et macOS, mais le sniffer ne voit **pas** le trafic de votre machine.
Pour sniffer le trafic reel de la machine, lancer `scripts/sniffer.py` a la main (voir le README principal).

## Commandes utiles

```bash
docker compose ps                    # etat des services
docker compose logs -f api           # journaux d'un service
docker compose down                  # arret ; conserve la base PostgreSQL et les MFA activees
docker compose down -v               # repart de zero (efface aussi la base et les preuves)
docker compose up --build backend    # reconstruire un seul service apres une modification
```

La blockchain Hardhat est **ephemere** : elle vit en memoire. Apres `docker compose down` puis `up`, elle repart vide,
les contrats sont redeployes et `seed` re-enregistre les identites. Consequences :

- les **refus passes** d'alice repartent a zero (ils font monter le risque de 5 points chacun : sans redemarrage, Paris
  finit par donner MFA en permanence) ;
- le journal blockchain est vide, et les preuves enregistrees en base (PostgreSQL) pour d'anciennes sessions ne
  correspondent plus a la chaine ;
- seuls PostgreSQL (`pgdata`) et les profils MFA / preuves (`state`) persistent.

Pour une demonstration propre : `docker compose down -v`, puis `docker compose up`.

## Configuration

- `ADMIN_API_KEY` : lu depuis un fichier `.env` a la racine s'il existe (sinon `change-me`). Il est partage
  automatiquement entre l'API et le backend.
- Les autres reglages (URL Keycloak, base de donnees, issuers acceptes) sont dans `docker-compose.yml`.

## En cas de probleme

| Symptome | Piste |
|---|---|
| `port is already allocated` / `Only one usage of each socket address` | Un autre programme ou conteneur utilise deja ce port (8180 / 8000 / 8081 / 4200 / 8545). Le trouver : `netstat -ano \| findstr :8000` et `docker ps -a --format "table {{.Names}}\t{{.Ports}}"`. Sinon, changer le premier nombre de `ports:` (ex. `"8001:8000"`). |
| Connexion Keycloak impossible au debut | `keycloak-init` n'a pas fini : `docker compose logs keycloak-init`. Il reessaie 5 fois. |
| Toujours `MFA` meme pour alice | `seed` n'a pas termine : `docker compose logs seed`. |
| `401 invalid_token` | Ouvrir Keycloak via `127.0.0.1:8180` et l'app via `localhost:4200`, pas via l'adresse IP de la machine. |
| `no such host` pendant le telechargement des images | Docker Desktop, Settings > Docker Engine : retirer un miroir de registre mort (`registry-mirrors`) et garder des DNS fiables (`8.8.8.8`, `1.1.1.1`). |
| `image "ztb-python:latest" already exists` | Ancienne version du compose : seul le service `api` construit maintenant cette image (`docker compose build api`). |
| Erreur `\r` ou `not found` dans `deploy.sh` | Fins de ligne CRLF : `git config core.autocrlf false`, puis re-cloner (`.gitattributes` force LF). |
| Build du backend ou du frontend lent | Normal la premiere fois (telechargement Maven / npm). |

## Ce qui a ete verifie

**Sous Docker Desktop (Windows), par l'equipe** : construction des images, demarrage de tous les services, connexion
Keycloak, decisions `ALLOW`, `MFA` (avec code TOTP) et `DENY`, historique PostgreSQL, preuves ancrees sur la blockchain,
bouton « Lancer l'attaque », vrai flood SYN avec `hping3` (le sniffer leve le drapeau et l'API refuse avec une classe DoS),
creation d'utilisateur et revocation (compte Keycloak desactive, connexion refusee).

**Hors Docker, avec les memes commandes** : `docker compose config`, noeud Hardhat, `deploy.sh`, `seed_identities`,
API FastAPI contre cette chaine, sniffer face a un flood SYN reel.

**Non verifie** : la derniere modification du compose (une seule construction de l'image Python, voir plus haut). Si
`docker compose up --build` echoue sur l'image `ztb-python`, lancer d'abord `docker compose build api`.
