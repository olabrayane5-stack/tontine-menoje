# Backend — Tontine M.E.NO.JE

API PHP 8 + MySQL du projet. Ce dossier est autonome : il ne dépend d'aucun
paquet Composer, d'aucun framework, et **ne modifie rien dans `src/`**.

- Documentation des routes : [`API.md`](API.md)
- Schéma de base : [`schema.sql`](schema.sql)
- Modèle de configuration : [`config.example.php`](config.example.php)

---

## 1. Contenu du dossier

```
backend/
├── index.php            # point d'entrée unique (front controller)
├── install.php          # création de l'admin initial — À SUPPRIMER après usage
├── schema.sql           # 9 tables + réglages par défaut (MySQL / MariaDB)
├── config.example.php   # modèle de configuration à copier
├── .htaccess            # réécrit tout vers index.php, bloque .sql/.md
├── Dockerfile           # alternative d'hébergement (voir § 8)
├── API.md               # documentation complète des routes
├── lib/
│   ├── bootstrap.php    # config, fuseau, erreurs, en-têtes, CORS
│   ├── response.php     # json_response(), api_error(), read_json_body()
│   ├── db.php           # PDO singleton + helpers sql_one/sql_all/sql_value/sql_exec
│   ├── validate.php     # ValidationError, téléphone +229, montants, dates, mots de passe
│   ├── auth.php         # jetons Bearer, rôles, audit, anti-force brute
│   ├── calculs.php      # stats, série, points, badges, réglages (miroir de tontineUtils.ts)
│   └── router.php       # routeur minimaliste (méthodes + /:id)
├── routes/
│   ├── ping.php         auth.php       members.php    sessions.php
│   ├── retraits.php     annonces.php   reglages.php   export.php
│   └── me.php           classement.php
└── tests/
    └── test-api.ps1     # test d'intégration des 26 routes (PowerShell)
```

> Le dossier `tests/` ne doit **pas** être envoyé sur l'hébergement (le
> `.htaccess` le neutralise de toute façon).

Aucune dépendance externe : `php -l` suffit à vérifier la syntaxe.

---

## 2. Prérequis

| Élément | Version minimale |
|---|---|
| PHP | 8.0 (testé en 8.2) |
| Extensions PHP | `pdo_mysql`, `mbstring`, `json` |
| MySQL / MariaDB | 5.7 / 10.3 (testé en MariaDB 10.4.32) |
| Apache | `mod_rewrite` activé (ou Nginx avec `try_files`) |

Vérification rapide :

```bash
php -v
php -m | findstr /i "pdo_mysql mbstring"
```

---

## 3. Installation locale (XAMPP / Laragon)

1. **Créer la base**

   ```sql
   CREATE DATABASE tontine CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. **Copier la configuration**

   ```powershell
   Copy-Item backend\config.example.php backend\config.php
   ```

   Renseigner `db.host`, `db.name`, `db.user`, `db.pass` puis laisser
   `app.debug => true` en local.

3. **Importer le schéma et créer l'admin**

   ```powershell
   php backend\install.php --schema
   php backend\install.php "Pasteur Emmanuel" "+2290197000001" "Admin2026x"
   ```

   `--schema` est idempotent : il recrée les tables (`CREATE TABLE IF NOT EXISTS`).

4. **Servir l'API**

   Avec XAMPP, placer le dossier dans `htdocs/api` et ouvrir
   `http://localhost/api/ping`. Sans Apache :

   ```powershell
   php -S 127.0.0.1:8080 -t backend
   ```

   > Le serveur intégré de PHP ne lit pas `.htaccess`. Les URL du type
   > `/api/login` nécessitent alors un routeur : voir l'exemple en fin de
   > section.

5. **Vérifier**

   ```powershell
   curl http://127.0.0.1:8080/api/ping
   ```

   ```json
   {"ok":true,"app":"Tontine M.E.NO.JE","version":"1.0.0","time":"…","database":true}
   ```

   `database:false` = PHP répond mais MySQL est injoignable.

### Routeur pour `php -S`

`router-dev.php` (hors du livrable, à créer à côté de `backend/`) :

```php
<?php
$chemin = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($chemin !== '/' && is_file(__DIR__ . '/backend' . $chemin)) {
    return false;
}
require __DIR__ . '/backend/index.php';
```

```powershell
php -S 127.0.0.1:8080 router-dev.php
```

---

## 4. Déploiement sur InfinityFree

InfinityFree héberge gratuitement PHP 8.2 et MySQL, mais impose deux
contraintes : pas de SSH (donc `install.php` en navigateur) et un **challenge
anti-robot** sur certaines requêtes. Le § 7 explique comment vérifier ce point
avant de s'engager.

### 4.1 Créer le compte et le site

1. Créer un compte sur <https://dash.infinityfree.com>.
2. **Create Account** → choisir un sous-domaine (`tontine-menoje.infinityfreeapp.com`
   par exemple) → noter le **mot de passe FTP** généré.
3. Attendre l'activation (quelques minutes à quelques heures).

### 4.2 Créer la base MySQL

1. Panneau du compte → **MySQL Databases** → **Create Database**.
2. Noter les 4 valeurs affichées :

   | Panneau | Champ de config |
   |---|---|
   | MySQL Host Name (`sql309.infinityfree.com`) | `db.host` |
   | Database Name (`if0_12345678_tontine`) | `db.name` |
   | Username (`if0_12345678`) | `db.user` |
   | Password | `db.pass` |

   Le port reste `3306`.

### 4.3 Envoyer les fichiers

Via le **File Manager** du panneau ou un client FTP (FileZilla) :

```
/htdocs/api/          ← contenu de backend/ (sauf config.php)
/htdocs/tontine-config.php   ← configuration (hors du dossier api/, mais dans htdocs)
```

> Idéalement la configuration est **au-dessus** de `htdocs` : le backend la
> cherche d'abord dans `<compte>/tontine-config.php`. Si l'accès FTP ne permet
> pas de sortir de `htdocs`, `htdocs/tontine-config.php` fonctionne aussi (le
> `.htaccess` bloque son téléchargement, mais son exécution reste possible :
> il ne contient qu'un `return [...]`).

Arborescence attendue côté serveur :

```
htdocs/
├── tontine-config.php
└── api/
    ├── .htaccess
    ├── index.php
    ├── install.php
    ├── schema.sql
    ├── lib/…
    └── routes/…
```

### 4.4 Configuration

Créer `tontine-config.php` :

```php
<?php
return [
    'db' => [
        'host'    => 'sql309.infinityfree.com',
        'port'    => 3306,
        'name'    => 'if0_12345678_tontine',
        'user'    => 'if0_12345678',
        'pass'    => 'LE_MOT_DE_PASSE_MYSQL',
        'charset' => 'utf8mb4',
    ],
    'app' => [
        'allowed_origins' => [
            'https://tontine-menoje.vercel.app',
            'http://localhost:3000',
        ],
        'token_ttl_hours'      => 720,
        'login_max_attempts'   => 5,
        'login_window_minutes' => 15,
        'login_lock_minutes'   => 15,
        'debug'                => false,
        'timezone'             => 'Africa/Porto-Novo',
        'nom_application'      => 'Tontine M.E.NO.JE',
        'install_key'          => 'une-longue-phrase-aleatoire-unique',
    ],
];
```

`debug => false` est **obligatoire** en production : aucune trace PHP ne doit
fuiter dans les réponses.

### 4.5 Importer le schéma

Deux méthodes, sans SSH :

**a. phpMyAdmin** (le plus simple)

1. Panneau → **phpMyAdmin** → sélectionner la base `if0_…_tontine`.
2. Onglet **Importer** → choisir `schema.sql` → **Exécuter**.
3. Vérifier que 9 tables apparaissent (`users`, `sessions_dimanche`,
   `versements`, `retraits`, `annonces`, `reglages`, `auth_tokens`,
   `audit_log`, `login_attempts`).

**b. `install.php --schema`** — impossible sans SSH, sauter.

> Alternative si l'import du `.sql` échoue (limites d'InfinityFree) :
> exécuter le contenu de `schema.sql` par morceaux dans l'onglet SQL.

### 4.6 Créer l'administrateur

Ouvrir `https://VOTRE-SOUS-DOMAINE.infinityfreeapp.com/api/install.php`
(attention : le `.htaccess` réécrit tout vers `index.php`, donc l'accès direct
au fichier passe par `/api/install.php`).

1. Saisir la **clé d'installation** définie dans `install_key`.
2. Renseigner nom, téléphone `+229…`, mot de passe (8 caractères, lettres + chiffres).
3. Valider. La page confirme la création et affiche un avertissement.

Ensuite : **supprimer `install.php`** du serveur (File Manager → Delete).
Sans cela, la page reste accessible mais refuse toute création
(`Un administrateur existe déjà.`) — la suppression reste la bonne pratique.

### 4.7 Vérifier

```powershell
curl https://VOTRE-SOUS-DOMAINE.infinityfreeapp.com/api/ping
```

Attendu : `200` avec `"ok":true` et `"database":true`.

Puis test de connexion :

```powershell
curl -X POST https://VOTRE-SOUS-DOMAINE.infinityfreeapp.com/api/login `
  -H "Content-Type: application/json" `
  -d '{\"telephone\":\"+2290197000001\",\"password\":\"Admin2026x\"}'
```

---

## 5. Brancher le front Vercel

Le front lit une variable d'environnement Vite :

```bash
# .env.production (Vercel → Settings → Environment Variables)
VITE_API_URL=https://VOTRE-SOUS-DOMAINE.infinityfreeapp.com/api
```

Puis dans le client HTTP :

```ts
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';
```

Rappels :

- le jeton se stocke côté front (`localStorage`) puis s'envoie en
  `Authorization: Bearer <token>` ;
- **aucun cookie** n'est utilisé : pas de `credentials: 'include'` ;
- l'origine `https://tontine-menoje.vercel.app` doit figurer dans
  `allowed_origins`, sinon le navigateur bloque la réponse (erreur CORS) ;
- après chaque déploiement, `Ctrl + Shift + R` (le service worker sert
  l'ancienne version).

---

## 6. Test du ping depuis le navigateur

Ouvrir <https://tontine-menoje.vercel.app>, puis la console (F12) et coller :

```js
fetch('https://VOTRE-SOUS-DOMAINE.infinityfreeapp.com/api/ping', {
  headers: { 'Content-Type': 'application/json' },
})
  .then(async (r) => console.log('HTTP', r.status, await r.text()))
  .catch((e) => console.error('ÉCHEC', e));
```

| Résultat console | Interprétation |
|---|---|
| `HTTP 200 {"ok":true,…}` | ✅ tout fonctionne, CORS inclus |
| `TypeError: Failed to fetch` | ❌ requête bloquée avant d'arriver à PHP (challenge anti-robot, DNS, TLS) |
| `HTTP 403` + page HTML | ❌ challenge InfinityFree (`aes.js`, « Checking your browser ») |
| `HTTP 200` mais erreur CORS en rouge | ⚠️ origine absente de `allowed_origins` |
| `HTTP 500` | ⚠️ configuration introuvable ou MySQL injoignable (`"database":false` sur `/ping`) |

Pour isoler la cause, tester la même URL **directement dans la barre d'adresse** :

- si la barre d'adresse affiche du JSON mais que `fetch` échoue → CORS ou
  challenge ;
- si la barre d'adresse affiche une page « Checking your browser » → challenge
  anti-robot confirmé.

> **Risque connu** : InfinityFree insère parfois un script de vérification
> JavaScript (`aes.js`) qui exige un cookie. Un appel `fetch` cross-origin ne
> l'exécute pas et reçoit `403`. C'est le principal point de blocage possible,
> et il n'est pas contournable côté serveur. Le § 7 liste les solutions.

---

## 7. Si le challenge anti-robot bloque

Tester d'abord (§ 6). En cas d'échec, trois issues réalistes :

### 7.1 Héberger le front sur le même domaine (le plus simple, gratuit)

Servir le build Vite **depuis InfinityFree**, dans `htdocs/`, et l'API dans
`htdocs/api/`. Tout est en même origine : plus de CORS, plus de challenge sur
les appels internes.

1. `npm run build` → copier le contenu de `dist/` dans `htdocs/`.
2. Ajouter un `htdocs/.htaccess` pour le routage SPA :

   ```apache
   <IfModule mod_rewrite.c>
       RewriteEngine On
       RewriteCond %{REQUEST_FILENAME} !-f
       RewriteCond %{REQUEST_FILENAME} !-d
       RewriteCond %{REQUEST_URI} !^/api/
       RewriteRule ^ index.html [L]
   </IfModule>
   ```

3. Dans le front, `VITE_API_URL=/api` (chemin relatif).
4. Conserver `https://tontine-menoje.vercel.app` dans `allowed_origins` si le
   déploiement Vercel reste utilisé en parallèle.

Avantages : zéro coût, latence minimale, PWA et service worker fonctionnent.
Inconvénient : plus de déploiement automatique Vercel (upload FTP manuel).

### 7.2 Héberger l'API ailleurs (Docker fourni)

Le `Dockerfile` de ce dossier construit une image `php:8.2-apache` avec
`pdo_mysql`, prête pour Render / Railway / Fly.io / un VPS :

```bash
docker build -t tontine-api backend
docker run -p 8080:80 --env TONTINE_CONFIG=/config/tontine-config.php \
  -v "$PWD/tontine-config.php:/config/tontine-config.php:ro" tontine-api
```

Sur Render (offre gratuite, HTTPS inclus) :

1. **New → Web Service** → dépôt GitHub `olabrayane5-stack/tontine-menoje`.
2. **Root Directory** : `backend` — **Runtime** : Docker.
3. Variable d'environnement `TONTINE_CONFIG=/etc/secrets/tontine-config.php`,
   avec la configuration injectée via un *Secret File* `tontine-config.php`
   (Render le monte dans `/etc/secrets/`).
4. Ajouter l'URL Render dans `allowed_origins`.
5. Base MySQL : un service MySQL externe est nécessaire (Render ne fournit pas
   de MySQL gratuit ; utiliser une base gratuite type Aiven ou la base
   InfinityFree, accessible depuis l'extérieur — vérifier l'autorisation
   d'accès distant dans le panneau InfinityFree).

### 7.3 Hébergement mutualisé payant

Un mutualisé classique (o2switch, PlanetHoster, Hostinger…) à ~3 €/mois :
PHP 8, MySQL, `.htaccess`, aucun challenge, sous-domaine dédié à l'API. C'est
l'option la plus prévisible pour une mise en production réelle.

> Recommandation : commencer par **7.1** (gratuit, immédiat), et basculer sur
> 7.3 si l'application doit rester sur Vercel avec un domaine séparé.

---

## 8. Docker (alternative d'hébergement)

Le [`Dockerfile`](Dockerfile) de ce dossier construit une image
`php:8.2-apache` avec `pdo_mysql`, `mod_rewrite` et le passage de l'en-tête
`Authorization` à PHP. L'API est servie sous `/api`, exactement comme sur
InfinityFree : les URL et le front ne changent pas.

```bash
docker build -t tontine-api backend

# La configuration est montée, jamais copiée dans l'image.
docker run --rm -p 8080:80 \
  --env TONTINE_CONFIG=/config/tontine-config.php \
  -v "$PWD/tontine-config.php:/config/tontine-config.php:ro" \
  tontine-api

curl http://localhost:8080/api/ping
```

Création de l'administrateur (une seule fois, puis suppression du fichier) :

```bash
docker run --rm -it \
  --env TONTINE_CONFIG=/config/tontine-config.php \
  -v "$PWD/tontine-config.php:/config/tontine-config.php:ro" \
  tontine-api \
  php /var/www/html/api/install.php "Pasteur Emmanuel" "+2290197000001" "Admin2026x"
```

> `install.php` est conservé dans l'image pour cette étape. Une fois l'admin
> créé, la page web refuse toute nouvelle création ; pour aller plus loin,
> reconstruire l'image en ajoutant `rm -f /var/www/html/api/install.php` à la
> ligne `RUN` qui supprime `config.php`.

En production (Render, Railway, Fly.io, VPS) : monter la configuration en
*secret file* et laisser `TONTINE_CONFIG` pointer dessus. `debug` doit rester
`false`.

---

## 9. Sécurité — ce qui est déjà en place

| Mesure | Où |
|---|---|
| Mots de passe hachés bcrypt (`password_hash`) | `routes/auth.php`, `routes/members.php`, `install.php` |
| Requêtes 100 % préparées (aucune concaténation de valeurs) | `lib/db.php` + tous les `routes/*.php` |
| Jeton aléatoire 256 bits, stocké **haché** SHA-256, avec expiration | `lib/auth.php` |
| Aucun cookie, CORS restreint à une liste blanche | `lib/bootstrap.php` |
| Contrôle de rôle sur **chaque** route admin (`exiger_admin`) | `routes/*.php` |
| Anti-force brute : 5 échecs / 15 min → blocage 15 min, par téléphone **et** par IP | `lib/auth.php` |
| Validation stricte (téléphone +229, montants entiers, dates réelles, longueurs) | `lib/validate.php` |
| Erreurs PHP jamais détaillées au client (`debug => false`) | `lib/bootstrap.php` |
| Transactions SQL + verrous nommés (fermeture, réouverture, ouverture) | `routes/sessions.php` |
| Journal d'audit de toutes les actions sensibles | `audit_log` |
| Fichiers sensibles bloqués par `.htaccess` (`.sql`, `.md`, `*.example.php`) | `.htaccess` |
| Révocation des jetons à la désactivation / réinitialisation / changement de mot de passe | `lib/auth.php`, `routes/members.php`, `routes/auth.php` |

Points de vigilance opérationnels :

- supprimer `install.php` après usage ;
- ne jamais commiter `config.php` / `tontine-config.php` (déjà dans `.gitignore`) ;
- changer `install_key` après l'installation (ou laisser vide) ;
- sauvegarder la base régulièrement (`GET /api/export/backup` ou export
  phpMyAdmin).

---

## 10. Exploitation courante

| Besoin | Procédure |
|---|---|
| Nouveau membre | Admin → Membres → Créer (mot de passe provisoire affiché **une fois**) |
| Mot de passe oublié | Admin → Membres → Réinitialiser (révoque ses sessions) |
| Dimanche de collecte | Admin → Saisie → Ouvrir la session → saisir → Fermer |
| Correction après fermeture | Rouvrir la session (journalisé), corriger, refermer |
| Retrait partiel | Admin → Retraits (contrôlé contre le solde) |
| Changement du taux de retenue | Admin → Réglages (`taux_retenue`, source unique de vérité) |
| Sauvegarde | Admin → Réglages → Sauvegarde JSON / Export CSV |
| Diagnostic | `GET /api/ping` (200 = PHP OK, `database` = MySQL OK) |
| Historique des actions | Table `audit_log` (phpMyAdmin) |

---

## 11. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `{"error":"Configuration du serveur manquante."}` | `config.php` / `tontine-config.php` introuvable | Vérifier l'emplacement (voir § 4.4) ou définir `TONTINE_CONFIG` |
| `database: false` sur `/ping` | identifiants MySQL, port ou pare-feu | Retester les 4 valeurs du panneau ; InfinityFree refuse les connexions distantes par défaut |
| `404 {"error":"Route introuvable."}` | `mod_rewrite` inactif ou `.htaccess` absent | Vérifier `AllowOverride All`, la présence de `htdocs/api/.htaccess` |
| `401` alors que le jeton est bon | en-tête `Authorization` supprimé par Apache (CGI/FastCGI) | Ajouter `SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1` |
| Erreur CORS dans la console | origine absente de `allowed_origins` | Ajouter l'URL exacte (sans slash final) |
| `429` en série | anti-force brute déclenché | Attendre 15 min ou purger `login_attempts` |
| Import `schema.sql` refusé | limite phpMyAdmin | Exécuter les `CREATE TABLE` un par un |
| Page blanche sur `install.php` | erreur PHP masquée (`debug => false`) | Passer temporairement `debug => true`, consulter les logs, puis remettre `false` |

---

## 12. Vérification avant mise en ligne

### 12.1 Test d'intégration automatisé

`tests/test-api.ps1` enchaîne les 26 routes et vérifie chaque code HTTP ainsi
que les calculs (total après upsert, versements à 0, points, retenue, solde).

> ⚠️ Le script **écrit en base**. Il exige une base de test fraîche, jamais la
> production.

```powershell
# 1. Base de test + schéma + admin
php backend/install.php --schema
php backend/install.php "Pasteur Emmanuel" "+2290197000001" "Admin2026x"

# 2. API démarrée (Apache, ou php -S avec le routeur du § 3)
powershell -ExecutionPolicy Bypass -File backend/tests/test-api.ps1

# 3. Autre cible (recette, préproduction)
powershell -File backend/tests/test-api.ps1 `
  -BaseUrl 'https://api.exemple.tld/api' `
  -AdminPhone '+2290197000001' -AdminPassword 'Admin2026x'
```

Sortie attendue :

```
[OK]    login admin -> 200
...
[OK]    jeton revoque -> 401

SUCCES : 60 verifications, 0 echec.
```

Le script sort en code `1` au premier échec bloquant, ce qui permet de
l'enchaîner dans une CI (`exit 1` → build rouge).

### 12.2 Contrôles manuels

```powershell
# 1. Syntaxe de tous les fichiers PHP
Get-ChildItem backend -Recurse -Filter *.php |
  ForEach-Object { php -l $_.FullName }

# 2. Aucune référence à un secret dans le code versionné
Select-String -Path backend\*.php,backend\lib\*.php,backend\routes\*.php `
  -Pattern 'password\s*=\s*[''"]' -SimpleMatch

# 3. Le front n'est pas modifié
git status --short src/
```

Liste finale :

- [ ] `schema.sql` importé (9 tables)
- [ ] administrateur créé, `install.php` supprimé
- [ ] `debug => false` et `install_key` retirée ou changée
- [ ] `allowed_origins` limité au front réel
- [ ] `/api/ping` renvoie `200` + `database:true` **depuis le navigateur du front**
- [ ] `tests/test-api.ps1` : 0 échec sur la base de test
- [ ] connexion admin testée, changement de mot de passe effectué
- [ ] une session ouverte / fermée de bout en bout
- [ ] sauvegarde JSON téléchargée et relue
- [ ] `config.php` absent du dépôt Git

---

## 13. Écarts assumés par rapport au front

Détaillés dans [`API.md` § 10.1](API.md) :

1. **Participation** : seuls les versements `> 0` comptent pour les dimanches,
   la série et les badges — sinon les `0` créés à la fermeture donneraient des
   badges à tout le monde.
2. **Dimanches de référence** : les sessions **fermées** (le serveur ne connaît
   que les dimanches réellement enregistrés), et non `SUNDAYS_LIST`.

Le backend est la référence dès que l'application est branchée dessus ; l'ancien
mode démo (`localStorage`) peut afficher des points légèrement différents.

---

## 14. Licence et contexte

Projet privé de l'église **M.E.NO.JE** (Bénin). Aucune inscription publique :
les comptes sont créés par l'unique administrateur.
