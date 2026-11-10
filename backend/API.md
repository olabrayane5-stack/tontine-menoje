# API — Tontine M.E.NO.JE (v1)

Backend PHP 8 + MySQL du projet **Tontine M.E.NO.JE**.
Toutes les routes sont préfixées par **`/api`** et renvoient du **JSON UTF-8**.

---

## 1. Conventions

| Élément | Règle |
|---|---|
| Base URL (prod) | `https://api.votre-domaine.tld/api` |
| Base URL (local) | `http://localhost:8080/api` |
| Encodage | UTF-8, `Content-Type: application/json; charset=utf-8` |
| Casse des clés | **camelCase** (`mustChangePassword`, `totalVerse`…) |
| Dates | `AAAA-MM-JJ` (colonnes SQL `DATE`) |
| Horodatages | `AAAA-MM-JJ HH:MM:SS` (heure `Africa/Porto-Novo`) |
| Montants | **entiers** en FCFA, jamais de décimales |
| Authentification | `Authorization: Bearer <token>` |
| Cookies | **aucun** (front sur un autre domaine) |
| Erreurs | `{ "error": "message en français" }` |

### 1.1 Codes HTTP utilisés

| Code | Signification |
|---|---|
| `200` | Succès |
| `201` | Ressource créée |
| `204` | Préflight CORS (`OPTIONS`) |
| `401` | Jeton absent, expiré ou invalide — identifiants incorrects |
| `403` | Rôle insuffisant, compte désactivé, changement de mot de passe requis |
| `404` | Ressource introuvable |
| `405` | Méthode HTTP non autorisée (en-tête `Allow` fourni) |
| `409` | Conflit métier (doublon, session déjà ouverte/fermée, téléphone déjà pris…) |
| `422` | Données invalides (validation) |
| `429` | Trop de tentatives de connexion échouées |
| `500` | Erreur serveur (message générique, détail dans les logs PHP) |

En cas d'erreur de validation, une clé `details` peut préciser les champs :

```json
{ "error": "Le champ « téléphone » est obligatoire.", "details": { "telephone": "obligatoire" } }
```

### 1.2 Enums

| Champ | Valeurs |
|---|---|
| `user.role` | `admin`, `membre` |
| `session.statut` | `ouverte`, `fermee` |
| `badge.code` | `PREMIER_PAS`, `SERIE_4`, `SERIE_8`, `SERIE_12`, `REGULARITE_OR` |

### 1.3 Téléphones

Format **Bénin** uniquement. Le serveur normalise toute saisie en `+229` suivi de
8 à 10 chiffres :

- `+229 01 97 00 00 01` → `+2290197000001`
- `0197000001` → `+2290197000001`
- `00229 0197000001` → `+2290197000001`
- `+225 07 00 00 00 01` → **422** (indicatif étranger refusé)

### 1.4 CORS

Origines autorisées (configurables dans `config.php`) :

- `https://tontine-menoje.vercel.app`
- `http://localhost:3000`, `http://127.0.0.1:3000`, `http://localhost:5173`

Les préflights `OPTIONS` renvoient `204` avec les en-têtes `Access-Control-*`.
Aucun joker `*` n'est utilisé.

### 1.5 Objets partagés

**User**

```json
{
  "id": 2,
  "nom": "Jean-Baptiste Kouame",
  "telephone": "+22901112233",
  "role": "membre",
  "actif": true,
  "mustChangePassword": true,
  "createdAt": "2026-11-10 01:15:36"
}
```

**Stats** (calculées côté serveur, identiques au front)

```json
{
  "userId": 2,
  "totalVerse": 5000,
  "totalRetire": 3000,
  "soldeActuel": 2000,
  "nombreDimanches": 1,
  "serieEnCours": 1,
  "points": 220,
  "badges": [
    {
      "code": "PREMIER_PAS",
      "nom": "Premier Pas",
      "description": "A démarré son épargne tontine pour l’année",
      "icone": "Footprints",
      "points": 15
    }
  ],
  "partEglise": 150,
  "montantNetPrevisionnel": 1850,
  "tauxRetenue": 3
}
```

**Session**

```json
{
  "id": 1,
  "date": "2026-11-08",
  "statut": "fermee",
  "ouverte": false,
  "openedAt": "2026-11-08 09:00:00",
  "closedAt": "2026-11-08 12:30:00",
  "nbVersements": 50,
  "nbPresents": 47,
  "total": 125000
}
```

`nbVersements`, `nbPresents` et `total` ne sont renseignés que par `GET /api/sessions`
et les réponses de fermeture ; ils valent `null` ailleurs.

**Reglages**

```json
{
  "tauxRetenue": 3,
  "nomEglise": "M.E.NO.JE",
  "devise": "FCFA",
  "afficherMontantsClassement": true
}
```

---

## 2. Récapitulatif des routes

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| `GET` | `/api/ping` | public | Sonde de disponibilité (test CORS) |
| `POST` | `/api/login` | public | Connexion |
| `POST` | `/api/logout` | connecté | Déconnexion (révoque le jeton) |
| `POST` | `/api/change-password` | connecté | Changement de mot de passe |
| `GET` | `/api/me` | connecté | Profil + statistiques |
| `GET` | `/api/me/releve` | connecté | Relevé complet du membre |
| `GET` | `/api/classement` | connecté | Classement, séries, badges |
| `GET` | `/api/annonces` | connecté | Liste des annonces |
| `GET` | `/api/reglages` | connecté | Réglages publics |
| `GET` | `/api/members` | admin | Liste des membres + stats |
| `POST` | `/api/members` | admin | Créer un membre |
| `PUT` | `/api/members/:id` | admin | Modifier nom / téléphone |
| `POST` | `/api/members/:id/reset-password` | admin | Mot de passe provisoire |
| `PATCH` | `/api/members/:id/active` | admin | Activer / désactiver |
| `GET` | `/api/sessions` | admin | Liste des dimanches |
| `POST` | `/api/sessions` | admin | Ouvrir une session |
| `GET` | `/api/sessions/:id` | admin | Détail + versements |
| `PUT` | `/api/sessions/:id/versements` | admin | Saisir / mettre à jour un versement |
| `POST` | `/api/sessions/:id/close` | admin | Fermer (crée les versements à 0) |
| `POST` | `/api/sessions/:id/reopen` | admin | Rouvrir (journalisé) |
| `GET` | `/api/retraits` | admin | Liste des retraits |
| `POST` | `/api/retraits` | admin | Accorder un retrait partiel |
| `POST` | `/api/annonces` | admin | Publier une annonce |
| `DELETE` | `/api/annonces/:id` | admin | Supprimer une annonce |
| `PUT` | `/api/reglages` | admin | Modifier les réglages |
| `GET` | `/api/export/backup` | admin | Sauvegarde JSON complète |
| `GET` | `/api/export/csv` | admin | Export CSV des opérations |

---

## 3. Routes publiques et d'authentification

### 3.1 `GET /api/ping`

Aucune authentification, aucune base requise. Sert à vérifier que le front
Vercel peut appeler l'API (CORS, challenge anti-robot de l'hébergeur).

**Réponse `200`**

```json
{
  "ok": true,
  "app": "Tontine M.E.NO.JE",
  "version": "1.0.0",
  "time": "2026-11-10T01:17:13+01:00",
  "database": true
}
```

`database: false` signifie que PHP répond mais que MySQL est injoignable
(identifiants ou serveur). La route renvoie quand même `200` : elle ne doit pas
être bloquée par un problème de base.

### 3.2 `POST /api/login`

**Entrée**

```json
{ "telephone": "+2290197000001", "password": "Admin2026x" }
```

**Réponse `200`**

```json
{
  "token": "9f2c…64 caractères hexadécimaux…",
  "expiresAt": "2026-12-10T01:20:00+01:00",
  "user": {
    "id": 1,
    "nom": "Pasteur Emmanuel",
    "telephone": "+2290197000001",
    "role": "admin",
    "actif": true,
    "mustChangePassword": true,
    "createdAt": "2026-11-10 01:15:00"
  }
}
```

**Erreurs**

| Code | Cas |
|---|---|
| `401` | Téléphone inconnu ou mot de passe incorrect (message volontairement identique) |
| `403` | Compte désactivé |
| `422` | Téléphone invalide ou champ manquant |
| `429` | 5 échecs en 15 minutes → blocage 15 minutes |

> Le jeton n'est stocké en base que sous forme d'empreinte SHA-256.
> Durée de vie : `token_ttl_hours` (720 h = 30 jours par défaut).

### 3.3 `POST /api/logout`

Aucune entrée. Révoque le jeton courant.

```json
{ "ok": true }
```

### 3.4 `POST /api/change-password`

**Entrée**

```json
{ "ancien": "Provisoire2026", "nouveau": "Nouveau2026" }
```

Règles du nouveau mot de passe : 8 à 72 caractères, au moins une lettre et un
chiffre, différent de l'ancien. `mustChangePassword` repasse à `false` et les
**autres** sessions de l'utilisateur sont révoquées (la session courante reste
valide).

**Réponse `200`** : `{ "ok": true }`

**Erreurs** : `401` (jeton), `422` (ancien incorrect, nouveau trop faible).

---

## 4. Routes du membre connecté

### 4.1 `GET /api/me`

```json
{
  "user": { "...": "User" },
  "stats": { "...": "Stats" },
  "reglages": { "...": "Reglages" }
}
```

### 4.2 `GET /api/me/releve`

Tout ce qu'un membre peut voir de lui-même : versements, retraits, totaux.
**Un membre ne voit jamais les données d'un autre membre.**

```json
{
  "membre": { "...": "User" },
  "tauxRetenue": 3,
  "totaux": {
    "totalVerse": 5000,
    "totalRetire": 3000,
    "soldeActuel": 2000,
    "partEglise": 150,
    "montantNetPrevisionnel": 1850
  },
  "stats": { "...": "Stats" },
  "versements": [
    {
      "id": 1,
      "sessionId": 1,
      "date": "2026-11-08",
      "montant": 5000,
      "createdAt": "2026-11-08 09:12:00",
      "updatedAt": "2026-11-08 09:12:00"
    }
  ],
  "retraits": [
    {
      "id": 1,
      "montant": 3000,
      "motif": "Urgence familiale",
      "date": "2026-11-09",
      "createdAt": "2026-11-09 18:00:00"
    }
  ]
}
```

> Un versement à `0` signifie « absent ce dimanche-là ». Il apparaît dans
> l'historique mais ne compte pas dans la série ni dans les badges.

### 4.3 `GET /api/classement`

```json
{
  "afficherMontants": true,
  "badges": [ { "code": "PREMIER_PAS", "nom": "Premier Pas", "description": "…", "icone": "Footprints", "points": 15 } ],
  "classement": [
    {
      "rang": 1,
      "userId": 2,
      "nom": "Jean-Baptiste Kouame",
      "points": 220,
      "serieEnCours": 1,
      "nombreDimanches": 1,
      "totalVerse": 5000,
      "badges": ["PREMIER_PAS", "REGULARITE_OR"]
    }
  ]
}
```

- Seuls les membres **actifs** figurent au classement.
- `totalVerse` vaut `null` si `afficherMontantsClassement` est désactivé —
  sauf pour l'admin, qui voit toujours les montants (`afficherMontants` reflète
  ce que le demandeur a le droit de voir).
- Tri : points décroissants, puis total versé, puis nom.

### 4.4 `GET /api/annonces`

```json
{
  "annonces": [
    {
      "id": 1,
      "titre": "Assemblée générale",
      "contenu": "Dimanche prochain après le culte.",
      "createdAt": "2026-11-09 20:00:00"
    }
  ]
}
```

### 4.5 `GET /api/reglages`

```json
{ "reglages": { "tauxRetenue": 3, "nomEglise": "M.E.NO.JE", "devise": "FCFA", "afficherMontantsClassement": true } }
```

---

## 5. Routes administrateur — membres

### 5.1 `GET /api/members`

```json
{
  "members": [
    { "id": 1, "nom": "Pasteur Emmanuel", "telephone": "+2290197000001", "role": "admin", "actif": true, "mustChangePassword": false, "createdAt": "…", "stats": { "...": "Stats" } },
    { "id": 2, "nom": "Jean-Baptiste Kouame", "telephone": "+22901112233", "role": "membre", "actif": true, "mustChangePassword": true, "createdAt": "…", "stats": { "...": "Stats" } }
  ]
}
```

Tri : administrateur d'abord, puis ordre alphabétique.

### 5.2 `POST /api/members`

**Entrée**

```json
{ "nom": "Jean-Baptiste Kouame", "telephone": "+229 01 11 22 33", "motDePasse": "Optionnel2026" }
```

`motDePasse` est facultatif. S'il est absent, le serveur en génère un lisible
(sans `0/O/1/l/I`) et le renvoie **une seule fois**.

**Réponse `201`**

```json
{
  "member": { "...": "User" },
  "motDePasseProvisoire": "4epcs5h7Nf"
}
```

`mustChangePassword` vaut toujours `true` à la création.

**Erreurs** : `409` (téléphone déjà utilisé), `422` (nom, téléphone ou mot de
passe invalide).

### 5.3 `PUT /api/members/:id`

**Entrée** (les deux champs sont facultatifs, mais au moins un est attendu)

```json
{ "nom": "Jean-Baptiste Kouamé", "telephone": "+22901112233" }
```

**Réponse `200`** : `{ "member": { "...": "User" } }`

**Erreurs** : `404`, `409` (téléphone pris par un autre), `422`.

### 5.4 `POST /api/members/:id/reset-password`

**Entrée** facultative : `{ "motDePasse": "Provisoire2026" }`

Réinitialise le mot de passe, force `mustChangePassword = true` et révoque
toutes les sessions du membre.

**Réponse `200`**

```json
{ "ok": true, "motDePasseProvisoire": "ofnJB8jCab" }
```

**Erreurs** : `404`, `409` (sa propre compte → utiliser `/api/change-password`),
`422`.

### 5.5 `PATCH /api/members/:id/active`

**Entrée**

```json
{ "actif": false }
```

Désactiver un membre révoque ses jetons. Le compte administrateur ne peut pas
être désactivé.

**Réponse `200`** : `{ "member": { "...": "User" } }`
**Erreurs** : `404`, `409` (admin), `422`.

---

## 6. Routes administrateur — sessions du dimanche

### 6.1 `GET /api/sessions`

```json
{
  "sessions": [
    { "id": 1, "date": "2026-11-08", "statut": "fermee", "ouverte": false, "openedAt": "…", "closedAt": "…", "nbVersements": 50, "nbPresents": 47, "total": 125000 }
  ]
}
```

Tri : date décroissante.

### 6.2 `POST /api/sessions`

**Entrée**

```json
{ "date": "2026-11-15" }
```

La date doit être **un dimanche** et ne doit pas déjà exister.
Une seule session peut être ouverte à la fois.

**Réponse `201`** : `{ "session": { "...": "Session" } }`

**Erreurs**

| Code | Cas |
|---|---|
| `409` | Une session est déjà ouverte (`"Une session est déjà ouverte (dimanche du 2026-11-08)…"`) |
| `409` | Ce dimanche a déjà une session |
| `422` | Date invalide ou pas un dimanche |

### 6.3 `GET /api/sessions/:id`

```json
{
  "session": { "...": "Session" },
  "versements": [
    {
      "id": 1,
      "userId": 2,
      "nom": "Jean-Baptiste Kouame",
      "telephone": "+22901112233",
      "montant": 5000,
      "enregistrePar": 1,
      "createdAt": "2026-11-08 09:12:00",
      "updatedAt": "2026-11-08 09:12:00"
    }
  ],
  "membres": [
    { "id": 2, "nom": "Jean-Baptiste Kouame", "telephone": "+22901112233" }
  ],
  "total": 7000,
  "presents": 2
}
```

`membres` liste les membres **actifs** (utile pour l'écran de collecte) ;
`versements` contient aussi les lignes à `0`.

### 6.4 `PUT /api/sessions/:id/versements`

**Entrée**

```json
{ "userId": 2, "montant": 5000 }
```

**Upsert** : une seule ligne par couple `(session, membre)`. Un second appel
met à jour la ligne existante (aucun doublon). `montant` accepte `0`
(membre absent), refuse les négatifs.

**Réponse `200`**

```json
{
  "ok": true,
  "versement": { "id": 1, "sessionId": 1, "userId": 2, "nom": "Jean-Baptiste Kouame", "montant": 5000, "updatedAt": "2026-11-08 09:12:00" },
  "total": 7000,
  "presents": 2,
  "nbNotes": 2
}
```

**Erreurs**

| Code | Cas |
|---|---|
| `404` | Session ou membre introuvable |
| `409` | Session fermée : `"Session fermée : rouvrez-la avant de modifier les versements."` |
| `422` | `userId` ou `montant` invalide |

### 6.5 `POST /api/sessions/:id/close`

Ferme la session dans une **transaction SQL** :

1. verrouille la ligne de session (`SELECT … FOR UPDATE`) ;
2. crée un versement à `0` pour **chaque membre actif** qui n'a rien ce
   dimanche-là ;
3. passe `statut = 'fermee'`, `closed_at = NOW()` ;
4. journalise l'action dans `audit_log`.

**Réponse `200`**

```json
{
  "ok": true,
  "session": { "...": "Session" },
  "versementsCrees": 1,
  "total": 7000,
  "presents": 2,
  "nbVersements": 3
}
```

**Erreurs** : `404`, `409` (déjà fermée).

### 6.6 `POST /api/sessions/:id/reopen`

Rouvre une session fermée (action **journalisée** dans `audit_log`, avec la
date de fermeture d'origine). Refusé si une autre session est déjà ouverte.
Les versements à `0` créés à la fermeture sont conservés et redeviennent
modifiables.

**Réponse `200`** : `{ "ok": true, "session": { "...": "Session" } }`
**Erreurs** : `404`, `409`.

---

## 7. Routes administrateur — retraits

### 7.1 `GET /api/retraits`

```json
{
  "retraits": [
    {
      "id": 1,
      "userId": 2,
      "nom": "Jean-Baptiste Kouame",
      "telephone": "+22901112233",
      "montant": 3000,
      "motif": "Urgence familiale",
      "date": "2026-11-09",
      "enregistrePar": 1,
      "createdAt": "2026-11-09 18:00:00"
    }
  ],
  "total": 3000
}
```

### 7.2 `POST /api/retraits`

**Entrée**

```json
{ "userId": 2, "montant": 3000, "motif": "Urgence familiale", "date": "2026-11-09" }
```

`date` est facultative (aujourd'hui par défaut).

**Réponse `201`**

```json
{
  "retrait": { "id": 1, "userId": 2, "nom": "Jean-Baptiste Kouame", "montant": 3000, "motif": "Urgence familiale", "date": "2026-11-09", "createdAt": "…" },
  "soldeActuel": 2000
}
```

**Erreurs**

| Code | Cas |
|---|---|
| `404` | Membre introuvable |
| `422` | Montant ≤ 0, motif vide, date invalide ou **solde insuffisant** (`"Solde insuffisant : 2 000 FCFA disponibles, 9 000 FCFA demandés."`) |

---

## 8. Routes administrateur — annonces et réglages

### 8.1 `POST /api/annonces`

**Entrée**

```json
{ "titre": "Assemblée générale", "contenu": "Dimanche prochain après le culte." }
```

**Réponse `201`** : `{ "annonce": { "id": 1, "titre": "…", "contenu": "…", "createdAt": "…" } }`
**Erreurs** : `422` (titre > 150 caractères, contenu > 5 000 caractères).

### 8.2 `DELETE /api/annonces/:id`

**Réponse `200`** : `{ "ok": true }` — **Erreur** : `404`.

### 8.3 `PUT /api/reglages`

Tous les champs sont facultatifs, mais au moins un est attendu.

```json
{ "tauxRetenue": 4, "nomEglise": "M.E.NO.JE", "devise": "FCFA", "afficherMontantsClassement": false }
```

`tauxRetenue` : nombre entre 0 et 100 (accepte `3`, `3.5`, `"3,5"`).
**Réponse `200`** : `{ "reglages": { "...": "Reglages" } }`
**Erreurs** : `422` (aucun champ, taux hors bornes, devise trop longue).

> Le taux de retenue est la **seule source de vérité** : il est relu à chaque
> calcul, jamais codé en dur.

---

## 9. Routes administrateur — exports

### 9.1 `GET /api/export/backup`

Téléchargement `tontine-menoje-backup-AAAA-MM-JJ.json`.

Le format est **volontairement celui du front** (`src/utils/backup.ts`) pour
que le bouton « Restaurer » continue de fonctionner :

```json
{
  "app": "tontine-menoje",
  "version": 1,
  "exported_at": "2026-11-10T01:20:00+01:00",
  "data": {
    "users": [ { "id": 2, "nom_complet": "Jean-Baptiste Kouame", "telephone": "+22901112233", "role": "membre", "statut": "actif", "must_change_password": true, "whatsapp_disponible": true, "created_at": "…" } ],
    "versements": [ { "id": 1, "session_id": 1, "user_id": 2, "date_dimanche": "2026-11-08", "montant": 5000, "mode_reglement": "especes", "enregistre_par": 1, "created_at": "…" } ],
    "retraits": [ { "id": 1, "session_id": 0, "user_id": 2, "date_retrait": "2026-11-09", "montant": 3000, "motif": "…", "enregistre_par": 1, "created_at": "…" } ],
    "sundaysList": ["2026-11-08"],
    "annonces": [ { "id": 1, "titre": "…", "contenu": "…", "priorite": "normale", "publie_par": 1, "date_publication": "…" } ],
    "parametres": { "nom_eglise": "M.E.NO.JE", "devise": "FCFA", "afficher_montants_classement": true, "quota_ia_quotidien": 5, "pourcentage_retenue": 3 }
  }
}
```

C'est la **seule** réponse en `snake_case`, imposée par la compatibilité avec
la restauration React.

### 9.2 `GET /api/export/csv`

Téléchargement `tontine-menoje-operations-AAAA-MM-JJ.csv`.

- séparateur `;`, BOM UTF-8 (Excel affiche les accents), fins de ligne `CRLF` ;
- colonnes : `Date;Type;Membre;Téléphone;Montant;Mode / motif;Enregistré par` ;
- une ligne par versement (y compris les `0`) et par retrait, triées par date.

```csv
Date;Type;Membre;Téléphone;Montant;Mode / motif;Enregistré par
2026-11-08;Versement;Jean-Baptiste Kouame;+22901112233;5000;Espèces;Pasteur Emmanuel
2026-11-09;Retrait;Jean-Baptiste Kouame;+22901112233;3000;Urgence familiale;Pasteur Emmanuel
```

---

## 10. Règles métier appliquées côté serveur

1. **Un seul administrateur** : `POST /api/members` crée toujours un `membre` ;
   aucun endpoint ne change le rôle.
2. **Pas d'inscription publique** : seul un admin connecté crée des comptes.
3. **Une session ouverte à la fois** : vérifié dans une transaction + verrou
   nommé MySQL (`GET_LOCK`).
4. **Un versement par membre et par session** : `UNIQUE(session_id, user_id)`
   + `INSERT … ON DUPLICATE KEY UPDATE`.
5. **Fermeture** : transaction, versements à `0` pour les membres actifs sans
   versement, horodatage, journal d'audit.
6. **Session fermée = verrouillée** : `PUT …/versements` renvoie `409` tant que
   l'admin n'a pas rouvert.
7. **Réouverture journalisée** : `audit_log.action = 'reopen_session'`.
8. **Montants entiers** : validation stricte, `INT UNSIGNED` en base.
9. **Retenue de l'église** : `parametres`/`reglages.taux_retenue`, appliquée
   comme dans `src/utils/tontineUtils.ts` :
   - `partEglise = round(totalVerse × taux / 100)`
   - `soldeActuel = max(0, totalVerse − totalRetire)`
   - `montantNetPrevisionnel = max(0, totalVerse − partEglise − totalRetire)`
10. **Retraits partiels** : admin uniquement, contrôlés contre le solde.
11. **Annonces** : admin en écriture, tous en lecture.
12. **Cloisonnement** : un membre n'accède qu'à `/me`, `/me/releve`,
    `/classement`, `/annonces`, `/reglages`, `/ping` ; toute route admin
    renvoie `403`.
13. **Mot de passe provisoire** : `mustChangePassword = true` à la création et
    après une réinitialisation ; le front doit imposer l'écran de changement.

### 10.1 Deux écarts assumés par rapport au front

| Sujet | Front (`tontineUtils.ts`) | Backend | Pourquoi |
|---|---|---|---|
| Participation | compte **toutes** les lignes de versement | compte les versements **> 0** | sinon les `0` créés automatiquement à la fermeture donneraient une série et des badges à tout le monde |
| Dimanches de référence | `SUNDAYS_LIST` (calendrier local) | sessions **fermées** | le serveur ne connaît que les dimanches réellement enregistrés |

Conséquence : le nombre de points peut différer légèrement entre l'ancien mode
démo (localStorage) et le backend. Le backend est la référence dès que
l'application est branchée dessus.

---

## 11. Exemple de client JavaScript

```ts
const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.exemple.tld/api';
const TOKEN_KEY = 'tontine-menoje:token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string | null) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    setToken(null);
    throw new Error('Session expirée. Reconnectez-vous.');
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? 'Erreur inattendue.');
  return body as T;
}

export const login = (telephone: string, password: string) =>
  request<{ token: string; user: User }>('/login', {
    method: 'POST',
    body: JSON.stringify({ telephone, password }),
  });
```

Téléchargements (le `fetch` doit lire le blob pour conserver le nom de fichier) :

```ts
const res = await fetch(`${API_URL}/export/csv`, {
  headers: { Authorization: `Bearer ${getToken()}` },
});
const blob = await res.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'tontine-menoje-operations.csv';
a.click();
URL.revokeObjectURL(url);
```

---

## 12. Journal d'audit

Chaque action sensible écrit une ligne dans `audit_log` :

| Action | Déclencheur |
|---|---|
| `login` / `logout` | connexion / déconnexion |
| `change_password` | changement par l'utilisateur |
| `create_member` / `update_member` / `toggle_member` | gestion des membres |
| `reset_password` | mot de passe provisoire régénéré |
| `open_session` / `close_session` / `reopen_session` | cycle de vie des dimanches |
| `upsert_versement` | saisie ou correction d'un montant |
| `create_retrait` | retrait partiel |
| `create_annonce` / `delete_annonce` | annonces |
| `update_reglages` | taux de retenue, nom, devise… |
| `export_backup` / `export_csv` | téléchargements |
| `install` | création de l'admin initial |
