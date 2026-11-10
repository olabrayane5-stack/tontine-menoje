<?php
/**
 * Modèle de configuration — copier en `config.php` (ou mieux : en
 * `tontine-config.php` à la racine du compte, hors de `htdocs`).
 *
 * ATTENTION : `config.php` contient les identifiants MySQL, il ne doit
 * JAMAIS être commité. Il est déjà listé dans `.gitignore`.
 *
 * Ordre de recherche par le backend :
 *   1. variable d'environnement TONTINE_CONFIG (chemin absolu)
 *   2. <compte>/tontine-config.php          (au-dessus de htdocs, recommandé)
 *   3. <htdocs>/tontine-config.php
 *   4. api/config.php                       (dernier recours)
 */
return [
    'db' => [
        // InfinityFree : MySQL Host Name affiché dans le panneau (ex. sql309.infinityfree.com)
        'host'    => 'sqlXXX.infinityfree.com',
        'port'    => 3306,
        // Nom de la base : if0_XXXXXXXX_tontine
        'name'    => 'if0_XXXXXXXX_tontine',
        'user'    => 'if0_XXXXXXXX',
        'pass'    => 'MOT_DE_PASSE_MYSQL',
        'charset' => 'utf8mb4',
    ],

    'app' => [
        // Origines autorisées pour CORS. Aucun joker « * » : le front est connu.
        'allowed_origins' => [
            'https://tontine-menoje.vercel.app',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:5173',
        ],
        // Durée de vie d'un jeton (heures) : 30 jours.
        'token_ttl_hours'        => 720,
        // Anti-force brute : 5 échecs sur 15 minutes => blocage 15 minutes.
        'login_max_attempts'     => 5,
        'login_window_minutes'   => 15,
        'login_lock_minutes'     => 15,
        // Mettre à false en production : aucune erreur PHP n'est renvoyée au client.
        'debug'                  => false,
        'timezone'               => 'Africa/Porto-Novo',
        'nom_application'        => 'Tontine M.E.NO.JE',
        // Protège install.php en mode navigateur. Chaîne longue et aléatoire.
        // Laisser vide interdit l'installation par le web (CLI uniquement).
        'install_key'            => 'CHANGER-CETTE-CLE-ALEATOIRE',
    ],
];
