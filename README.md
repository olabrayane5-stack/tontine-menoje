# Tontine M.E.NO.JE

Application web (SPA + PWA) de gestion de la tontine de l'église **M.E.NO.JE** : suivi des versements du dimanche, retraits partiels, retenue de l'église (3 % par défaut), relevés individuels, classement solidaire et assistant.

## Fonctionnalités

- **Espace administrateur** : collecte du dimanche par membre, saisie rapide par texte, retraits partiels, gestion des membres, annonces, bilan de clôture, analyses et réglages.
- **Collecte du dimanche (registre déclaratif)** : sur téléphone comme sur ordinateur, l'administrateur touche le nom du membre puis saisit le montant remis. Un pavé de collecte s'ouvre avec le nom complet, les raccourcis de montant, le rappel du dernier versement et le cumul du membre ; « Enregistrer et suivant » (ou Entrée) enchaîne directement sur le membre suivant non noté. Rien n'est encaissé par l'application : c'est une preuve de suivi que le membre retrouve dans son historique. Un seul versement par membre et par dimanche — une nouvelle saisie met à jour la ligne existante au lieu de créer un doublon.
- **Espace membre** : épargne et solde disponible, historique, relevé imprimable, message WhatsApp/SMS, changement de mot de passe.
- **Classement** : série de dimanches consécutifs, points et badges à la manière de Duolingo.
- **Assistant** : réponses en français sur les cotisations, retraits, soldes et prévisions de fin d'année.
- **Sauvegarde et export** : téléchargement d'une sauvegarde JSON complète, restauration avec validation du fichier, et export CSV des opérations (compatible Excel).
- **Calendrier des dimanches** : ajout et suppression des dates de cotisation depuis les réglages, avec protection des dimanches déjà utilisés.
- **Réglages cohérents** : le taux de retenue de l'église est configurable et utilisé partout (relevés, messages, analyses, classement).
- **Thème clair / sombre** : bascule animée (révélation circulaire), bouton animé et choix mémorisé.
- **Interface responsive** : en-tête en verre dépoli, navigation réduite (Pilotage / Mon espace, Classement), barre mobile fixe, tuiles d'administration et podium de classement adaptés à tous les écrans.
- **Animations** : transitions douces entre les onglets et les sections (`PageTransition`, ~0,4 s), apparitions en cascade des cartes (`Stagger`), compteurs de montants animés (`AnimatedAmount`), barres de progression, podium avec médailles, modales et toasts animés — le tout limité à `transform` / `opacity` et désactivé si l'utilisateur préfère réduire les animations.
- **Design system** : palette unique bleu nuit / or / vert / rouge définie dans `src/styles/theme.css` (variables CSS) et consommée par les classes communes (`.app-card`, `.btn`, `.field`, `.badge-*`, `.progress-*`…) ; polices locales Poppins (titres) et Inter (texte), aucune couleur écrite en dur dans les composants.
- **Accessibilité** : lien d'évitement, navigation au clavier, fermeture des menus avec Échap, libellés ARIA et messages d'erreur annoncés.
- **PWA** : installable sur smartphone et consultable hors ligne après la première visite (en production).

## Stack

React 19, TypeScript, Vite 8, Tailwind CSS 4, Framer Motion, lucide-react, Poppins + Inter (polices locales via `@fontsource/poppins` et `@fontsource-variable/inter`).

## Démarrage

```bash
npm install
npm run dev
```

L'application est servie sur <http://localhost:3000>.

```bash
npm run lint     # vérification TypeScript (tsc --noEmit)
npm run build    # build de production dans dist/
npm run preview  # prévisualisation du build
npm run clean    # supprime dist/ (multiplateforme)
```

## Comptes de démonstration

| Rôle | Téléphone | Mot de passe |
| --- | --- | --- |
| Admin | `+225 07 00 00 01` | `admin` |
| Membre | `+225 07 11 22 33` | `123` |
| Première connexion | `+225 07 10 20 30` | `temp` |

Des boutons d'accès rapide sont aussi disponibles sur l'écran de connexion.

## Données

Les données sont **persistées dans le `localStorage`** du navigateur (préfixe `tontine-menoje:v1:`). Un rechargement de page conserve donc les modifications.

Pour repartir du jeu de démonstration : se connecter en admin puis cliquer sur **« Réinitialiser la démo »** dans le pied de page, ou vider le stockage local du site dans les outils du navigateur.

Comme les données vivent uniquement dans ce navigateur, pensez à utiliser **Réglages → Sauvegarde des données** :

- **Exporter (JSON)** : sauvegarde complète (membres, versements, retraits, calendrier, annonces, réglages).
- **Restaurer une sauvegarde** : remplace les données actuelles après validation du fichier et confirmation.
- **Exporter (CSV)** : historique des versements et retraits, ouvrable dans Excel ou LibreOffice.

Le jeu initial (50 membres, 10 dimanches jusqu'au `2026-03-08`) se trouve dans `src/data/mockData.ts`.

## Structure

- `src/App.tsx` — état global, session et navigation.
- `src/styles/theme.css` — variables du design system (couleurs, rayons, ombres, polices, durées, mode sombre).
- `src/index.css` — palette Tailwind remappée, classes communes (`.app-card`, `.btn`, `.field`, `.badge-*`, `.progress-*`, `.mobile-nav`), surcharges sombres et animations.
- `src/components/` — écrans admin/membre, classement, reçus, sauvegarde, calendrier, guide technique.
- `src/components/ui/` — primitives partagées : `Modal`, `Toast` (`ToastProvider` / `useToast`), `Skeleton`.
- `src/components/motion/` — `PageTransition` et `Stagger` / `StaggerItem` (Framer Motion).
- `src/components/AnimatedAmount.tsx` — compteur de montants animé (0 → valeur).
- `src/utils/tontineUtils.ts` — calculs métier (retenue, séries, badges), assistant, et helpers de saisie (`parseAmountInput`, `normalizeText`, `upsertVersements`).
- `src/utils/backup.ts` — sauvegarde JSON versionnée, validation et génération CSV.
- `src/data/mockData.ts` — données de démonstration.
- `src/hooks/usePersistentState.ts` — persistance `localStorage`.
- `src/hooks/useTheme.ts` et `src/components/ThemeToggle.tsx` — thème clair/sombre.
- `public/` — manifeste, service worker et icônes PWA.

## Thème clair / sombre

Le bouton soleil/lune est présent dans l'en-tête et sur l'écran de connexion. Le choix est mémorisé dans `localStorage` (clé `tontine-menoje:theme`) et appliqué avant le premier rendu pour éviter un flash.

Le mode sombre est réalisé par des surcharges ciblées dans `src/index.css` (le préfixe `dark:` n'est pas utilisé dans les composants). Si vous ajoutez de nouvelles classes de couleur, vérifiez leur rendu en sombre et ajoutez la surcharge correspondante. Le reçu porte la classe `print-receipt` pour rester imprimable en clair.

## PWA

Le manifeste (`public/manifest.webmanifest`) et le service worker (`public/sw.js`) sont actifs dans le build de production. En développement, le service worker n'est pas enregistré pour ne pas perturber le HMR.

## Limites actuelles

- **Prototype front sans backend** : l'authentification est locale et les mots de passe sont en clair dans les données de démonstration. Ne pas déployer tel quel en production.
- L'assistant « IA » repose sur des **règles de mots-clés**, pas sur Gemini. Aucune clé d'API n'est utilisée par le front.
- Les montants du dimanche sont **déclaratifs** : l'application sert de registre de suivi, elle ne déplace aucun argent. La collecte réelle se fait en main propre ou par Mobile Money, puis l'administrateur la note.
- Le schéma MySQL et l'API PHP/PDO cibles sont documentés dans `src/components/TechGuideModal.tsx` (bouton **« Code PHP & SQL »**).
- Les données sont propres à chaque navigateur : la sauvegarde JSON est le seul moyen de les transférer vers un autre appareil.

## Déploiement

```bash
npm run build
```

Déposer le contenu de `dist/` sur un hébergement statique. Le guide intégré décrit la cible InfinityFree avec API PHP/MySQL.
