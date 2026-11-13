# AI-ZTB : Zero Trust pour bornes de recharge de véhicules électriques

Application de démonstration pour un système de recharge de véhicules électriques protégé par une architecture Zero Trust. Chaque demande est évaluée par une IA (score de risque), validée par un smart contract (ALLOW / MFA / DENY), puis journalisée dans une blockchain avec preuve d'intégrité.

## Présentation

Le projet met en œuvre une architecture de sécurité orientée "never trust, always verify" :

- analyse du contexte de la demande (utilisateur, borne, emplacement, appareil, géolocalisation, activité réseau),
- scoring de risque par un moteur IA,
- décision de politique via un smart contract,
- authentification et MFA avec Keycloak,
- supervision et journalisation de la blockchain,
- interface web pour l'administration et la supervision.

## Prérequis

Une seule dépendance est nécessaire : Docker.

| Système | À installer |
| --- | --- |
| Windows 10/11 | Docker Desktop (backend WSL 2) |
| Linux (poste local) | Docker Engine + plugin Compose v2 |
| macOS | Docker Desktop |
| Serveur Ubuntu partagé | Docker Engine + plugin Compose v2 |

> Java, Node, Python, Maven et PostgreSQL ne sont pas à installer manuellement : tout est encapsulé dans des conteneurs Docker.

## Démarrage rapide

### 1. Récupérer le projet

Clonez le dépôt dans un dossier dont le chemin ne contient pas d'espace :

```bash
git clone <url-du-depot> ztb
```

### 2. Ouvrir un terminal dans le dossier du projet

```bash
cd ztb
```

### 3. Construire et lancer les services

```bash
docker compose up --build
```

Le premier lancement peut prendre 10 à 20 minutes. Les suivants sont généralement plus rapides. Laissez le terminal ouvert pendant le démarrage.

### 4. Vérifier que l'application est prête

Dans un second terminal :

```bash
docker compose ps
```

L'application est prête lorsque les services `keycloak`, `chain`, `redis`, `postgres`, `api`, `sniffer`, `backend` et `frontend` sont en statut `running`.

Les services `keycloak-init`, `deploy` et `seed` peuvent passer en `exited (0)` : c'est attendu.

## Accès à l'application

Ouvrez le navigateur sur :

- `http://localhost:4200`

En environnement distant (serveur Ubuntu partagé), utilisez un tunnel SSH puis ouvrez `http://localhost:4200` depuis votre poste local.

### Comptes de démonstration

| Utilisateur | Mot de passe | Rôle |
| --- | --- | --- |
| `alice` | `alice123` | User |
| `bob` | `bob123` | Fleet |
| `root` | `root123` | Admin |
| `eve` | `eve123` | User révoquée |

Console Keycloak :

- `http://127.0.0.1:8180`
- identifiants : `admin` / `admin`

> Important : utilisez toujours `localhost` ou `127.0.0.1`. Ne passez jamais par l'IP de la machine sous peine d'erreur `401 invalid_token`.

## Arrêt et remise à zéro

### Arrêt simple

```bash
Ctrl + C
```

### Arrêt sans suppression des données

```bash
docker compose down
```

### Remise à zéro complète

```bash
docker compose down -v
```

Pour une démonstration propre, il est recommandé de lancer :

```bash
docker compose down -v
docker compose up --build
```

La blockchain est éphémère : les appareils de démonstration sont réenregistrés automatiquement par `scripts/seed_identities.py`.

## Accès depuis un autre poste

Sur un serveur Ubuntu partagé, chaque membre de l'équipe peut ouvrir un tunnel SSH depuis son poste local :

```bash
ssh -L 4200:localhost:4200 -L 8180:localhost:8180 -L 8081:localhost:8081 -L 8000:localhost:8000 <user>@<ip-du-serveur>
```

Puis ouvrir :

```text
http://localhost:4200
```

Laisser le terminal SSH ouvert pendant toute la session.

## Guide de test après redémarrage de la VM

### 1. Démarrer les services et recréer le sniffer

Dans un terminal sur la VM :

```bash
cd ~/projets_amie/archi_0_trust-main
docker compose up -d
docker compose up -d --force-recreate sniffer
docker compose ps
```

Le service `sniffer` est recréé pour le rattacher au conteneur `api`. Vérifiez que `keycloak`, `chain`, `redis`, `postgres`, `api`, `sniffer`, `backend` et `frontend` sont `running` ou `healthy`. Les services d'initialisation qui se terminent avec le code `0` sont normaux.

Le service `seed` enregistre automatiquement les appareils de démonstration (`dev-alice-01`, `dev-bob-01`, etc.) dans la blockchain au démarrage.

### 2. Ouvrir le tunnel SSH depuis Windows

Dans PowerShell sur votre PC, en remplaçant `aiaiai` par votre nom d'utilisateur SSH et `192.168.163.134` par l'adresse IP de votre serveur Ubuntu. Les valeurs ci-dessous sont celles de l'exemple : ne les copiez pas telles quelles si votre compte ou votre adresse IP sont différents.

```powershell
ssh -L 4200:localhost:4200 -L 8180:localhost:8180 -L 8081:localhost:8081 -L 8000:localhost:8000 aiaiai@192.168.163.134
```

Laissez ce terminal ouvert, puis ouvrez `http://localhost:4200` dans votre navigateur.

### 3. Vérifier l'identifiant de l'appareil dans le navigateur

Dans le navigateur normal, ouvrez les outils de développement (`F12`) → **Application** → **Local Storage** → `http://localhost:4200`.

- Pour Alice, vérifiez que `ztb_device_id` vaut `dev-alice-01`.
- Pour Bob, vérifiez que `ztb_device_id` vaut `dev-bob-01`.

Si la valeur est différente ou absente, remplacez-la par l'identifiant correspondant, puis rafraîchissez la page (`F5`). Le navigateur crée sinon un identifiant aléatoire, qui n'est pas enregistré dans la blockchain. Le `localStorage` reste sur le PC et est conservé après le redémarrage de la VM ; une fenêtre privée dispose d'un stockage distinct.

### 4. Tester ALLOW et MFA

Dans le navigateur normal :

1. Connectez-vous avec `alice` / `alice123`, ouvrez **Recharger**, puis cliquez sur **Démarrer la charge** : la décision attendue est `ALLOW`.
2. Dans un autre navigateur normal configuré avec `dev-bob-01`, connectez-vous avec `bob` / `bob123` et répétez le test : `ALLOW`.

Pour tester la MFA, Alice doit d'abord l'activer avec son téléphone (voir ci-dessous). Ensuite, ouvrez une fenêtre privée, connectez-vous avec `alice` / `alice123` et démarrez une charge. La décision attendue est `MFA`. Saisissez le code à 6 chiffres affiché par l'application d'authentification : la décision devient `ALLOW`. Si la MFA n'est pas activée, la page propose un lien vers l'écran d'activation.

### 4 bis. Activer la MFA par QR code (Google / Microsoft Authenticator)

La MFA est gérée par l'API Zero Trust (et non par Keycloak) ; aucun e-mail n'est envoyé.

1. Installez **Google Authenticator** ou **Microsoft Authenticator** sur un téléphone.
2. Connectez-vous avec `alice` / `alice123`, puis ouvrez **Sécurité (MFA)** → **Activer la MFA**.
3. Dans l'application : *Ajouter un compte* → *Scanner un code QR*. Le compte `AI-ZTB (alice)` apparaît. (Sinon, *Saisir la clé manuellement* avec la clé affichée sous le QR code, type « basé sur l'heure ».)
4. Saisissez le code à 6 chiffres affiché par l'application, puis **Confirmer** : la MFA est activée.

Règles de sécurité :

- le secret et le QR code ne sont envoyés qu'au titulaire du compte (identité tirée de son jeton Keycloak) et ne sont plus jamais réaffichés après l'activation, ni à l'utilisateur ni à l'admin ;
- un QR code non confirmé expire au bout de 10 minutes ;
- un code accepté ne peut pas être réutilisé (anti-rejeu) : il faut attendre le code suivant (30 s) ;
- **renouvellement** (nouveau téléphone) : depuis **Sécurité (MFA)**, saisissez un code de l'application actuelle pour obtenir un nouveau QR code. L'ancien secret reste valable tant que le nouveau n'est pas confirmé ;
- **téléphone perdu** : `root` → **Utilisateurs** → **Réinitialiser MFA**, puis l'utilisateur réactive sa MFA.

> **Comptes existants** : les secrets TOTP créés avant cette version (générés par le serveur et visibles par l'admin) sont considérés comme compromis et ignorés. Chaque utilisateur, y compris `alice`, `bob` et `root`, doit réactiver sa MFA. Sur un volume `state` existant, l'écran l'indique (« Votre ancien secret TOTP a été désactivé »). Un `docker compose down -v` repart de profils sans secret.

### 5. Tester la détection d'attaque

Dans un terminal sur la VM, suivez les journaux du sniffer :

```bash
cd ~/projets_amie/archi_0_trust-main
docker compose logs -f sniffer
```

Dans un second terminal sur la VM, lancez l'attaque :

```bash
cd ~/projets_amie/archi_0_trust-main
docker compose --profile attack run --rm attacker
```

Pendant l'attaque (20 secondes par défaut), une demande de démarrage de charge doit être refusée (`DENY`). Attendez 3 à 4 secondes après la fin de l'attaque et réessayez : la décision attendue est `ALLOW`.

### 6. Tester les fonctions d'administration

Connectez-vous avec `root` / `root123` pour vérifier :

- **Bornes occupées** : consulter et arrêter les charges en cours ;
- **Supervision** : statistiques, graphiques des décisions et des risques, répartition des décisions par borne, journal blockchain et alertes ;
- **Politiques d'accès** : consulter et tester les règles ;
- **Utilisateurs** : créer un compte, réinitialiser la MFA d'un utilisateur (téléphone perdu) et révoquer un compte, par exemple `eve`. L'admin ne voit jamais les secrets ni les codes TOTP.

### 7. Arrêter la VM

Arrêtez les conteneurs puis, si nécessaire, la VM :

```bash
cd ~/projets_amie/archi_0_trust-main
docker compose down
sudo shutdown now
```

## Scénario de démonstration

Le projet a été conçu pour illustrer plusieurs cas de sécurité Zero Trust :

- `alice` arrive à la borne A à Lyon : `ALLOW`
- `alice` arrive à la borne B à Paris après un délai compatible : risque contextuel accru (zone inhabituelle)
- une même demande avec le même nonce est rejouée : `DENY` ; un horodatage expiré est également refusé
- `alice` passe de Lyon à Marseille en quelques minutes : risque élevé et `DENY` pour déplacement impossible
- `alice` avec un appareil inconnu (navigation privée) : `MFA` demandée, code saisi depuis son application d'authentification (MFA activée au préalable par QR code)
- `alice`, sur un micro-segment avec rôle insuffisant (`admin:firmware`) : `DENY`
- `root` voit la charge d'`alice` et peut l'arrêter, mais pas la démarrer, lorsque la borne est occupée
- pendant une vraie attaque réseau, `alice` est automatiquement `DENY` avec risque élevé (`95/100`), et un bandeau rouge apparaît côté supervision
- `root` peut vérifier l'intégrité de la preuve dans le journal blockchain
- `root` peut créer un compte (l'utilisateur active lui-même sa MFA), puis révoquer `eve` pour couper son accès

## Scénarios automatisés

Après reconstruction des services, lancez le test depuis le conteneur API afin qu'il utilise les profils du volume partagé et les URL internes Docker :

```bash
docker compose up -d --build api backend frontend
docker compose up -d --force-recreate sniffer
docker compose exec api python -m unittest api.test_request_security api.test_mfa
docker compose exec api python -m scenarios.run_scenarios
```

Le script obtient les jetons utilisateurs auprès de Keycloak et appelle `/access` avec un jeton Bearer. Il vérifie le rejeu exact d'une requête, un horodatage expiré et le déplacement Lyon–Marseille. Le rapport est écrit dans `reports/scenarios.json`.

La protection anti-rejeu exige un UUID unique et un horodatage en millisecondes : les requêtes de plus de 30 secondes ou situées à plus de 5 secondes dans le futur sont refusées. Redis conserve chaque nonce pendant 35 secondes. La détection de déplacement compare les dernières localisations autorisées connues pour Lyon, Marseille et Paris ; une vitesse supérieure à 150 km/h ajoute 50 points de risque.

## Simulation d'une attaque réseau

L'admin ne peut plus lancer l'attaque depuis l'interface. L'attaque est déclenchée depuis un terminal :

```bash
docker compose --profile attack run --rm attacker
```

Durée par défaut : 20 secondes.

Pour modifier la durée :

- Linux / macOS :

```bash
ATTACK_SECONDS=60 docker compose --profile attack run --rm attacker
```

- Windows `cmd` :

```cmd
set ATTACK_SECONDS=60 && docker compose --profile attack run --rm attacker
```

### Suivre la détection

Dans un second terminal :

```bash
docker compose logs -f sniffer
```

Une ligne de ce type doit apparaître :

```text
⚠️ Attaque détectée ! <N> SYN en 2s.
```

Pendant l'attaque, toute demande est refusée (`DENY`). Environ 3 à 4 secondes après la fin, l'accès redevient normal.

> Important : si le service `api` a été reconstruit, le conteneur `sniffer` reste attaché à l'ancien conteneur. Il faut le recréer avec :
>
> ```bash
> docker compose up -d --force-recreate sniffer
> ```

## Tests

### 1. Tests unitaires backend

```bash
docker run --rm -v "$PWD/backend:/app" -v ztb-m2:/root/.m2 -w /app maven:3.9-eclipse-temurin-21 mvn -B test
```

Windows : remplacer `$PWD` par `%cd%` ou `${PWD}`.

Résultat attendu : `BUILD SUCCESS`.

### 2. Vérification du frontend (compilation)

```bash
docker run --rm -v "$PWD/frontend:/app" -w /app node:22 sh -c "npm ci && npx ng build"
```

Résultat attendu : `Application bundle generation complete`.

### 3. Test de bout en bout

```bash
curl http://localhost:8000/health
curl http://localhost:8081/api/health
curl -i http://localhost:8081/api/stations
```

Le dernier appel doit renvoyer un `401` si aucun jeton n'est fourni.

## Commandes utiles

```bash
docker compose ps
docker compose logs -f backend
docker compose up -d --build backend
docker compose up -d --force-recreate sniffer
docker compose down
docker compose down -v
```

## Dépannage

| Symptôme | Solution |
| --- | --- |
| `Cannot connect to the Docker daemon` | Démarrer Docker Desktop ou exécuter `sudo systemctl start docker` |
| `port is already allocated` | Libérer le port concerné ou modifier le premier chiffre dans `docker-compose.yml` |
| `401 invalid_token` | Passer par `localhost:4200` ou `127.0.0.1:8180`, jamais par l'IP de la machine |
| `Toujours MFA pour alice` | Relancer avec `docker compose down -v && docker compose up --build` |
| `L'attaque ne déclenche rien` | Recréer le service `sniffer` puis relancer l'attaque |
| `Build très long la première fois` | C'est normal ; Maven et npm télécharge des dépendances et utilisent le cache ensuite |
| `Manque de mémoire` | Donner 6 à 8 Go de RAM à Docker Desktop |
| `Tout est cassé` | Exécuter `docker compose down -v` puis `docker compose up --build` |

## Structure du projet

```text
ztb/
├── docker-compose.yml        # Lance toute la chaîne (docker compose up --build)
├── .env.example              # Variables à copier dans .env (secrets locaux)
├── frontend/                 # Interface web Angular
├── backend/                  # API métier Spring Boot (bornes, sessions, admin) + tests
├── api/                      # Moteur Zero Trust FastAPI : décision, MFA, anti-rejeu + tests
├── ai/                       # Pipeline IA : prétraitement, entraînement, scoring de risque
├── models/                   # Modèles IA entraînés (risk_bundle.joblib utilisé par l'API)
├── data/processed/           # Flux réseau de démonstration
├── reports/                  # Résultats d'entraînement (métriques, comparaison des modèles)
├── blockchain/               # Smart contracts Solidity + Hardhat
├── scripts/                  # Initialisation (Keycloak, identités on-chain) et sniffer réseau
├── scenarios/                # Scénarios de test automatisés de bout en bout
├── docker/                   # Dockerfiles Python et attaquant de démonstration
└── docs/                     # Documentation détaillée
```

Fichiers générés, non versionnés : `deployments/` (adresses des contrats), `blockchain/artifacts|cache|types/`, `backend/target/`, `frontend/.angular/`, `node_modules/`, `reports/scenarios.json`.

## Limites connues

- Les mots de passe et secrets par défaut (`admin/admin`, `change-me`) sont destinés à la démonstration uniquement.
- La blockchain locale Hardhat est éphémère.
- Le `sniffer` observe le trafic du conteneur `api` ; il faut le recréer après un rebuild complet de `api`.
- La politique Zero Trust est stricte : un appareil non enregistré ne devient jamais "de confiance" automatiquement.
- Les scénarios automatisés nécessitent les comptes de démonstration Keycloak et les profils initialisés par le service `seed`. Si la MFA d'`alice` ou de `root` n'est pas activée, le script l'active lui-même via `/mfa/enroll` + `/mfa/confirm` : le secret n'est alors connu que du script. Pour tester ensuite avec un vrai téléphone, réinitialisez la MFA (`root` → **Utilisateurs** → **Réinitialiser MFA**) ou lancez `docker compose down -v`.
- Le secret TOTP est stocké en clair dans le volume `state` (`users.json`), côté serveur uniquement. En production, il faudrait le chiffrer (KMS/HSM).

## Conclusion

Ce projet illustre une architecture de contrôle d'accès Zero Trust appliquée à un cas concret de recharge de véhicules électriques. Il permet de démontrer la combinaison entre IA, politiques de sécurité, authentification forte, détection d'attaque et preuve d'intégrité blockchain.
