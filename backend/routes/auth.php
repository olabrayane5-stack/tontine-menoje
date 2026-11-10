<?php
/**
 * Authentification : /api/login, /api/logout, /api/change-password.
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

// --------------------------------------------------------------------------
// POST /api/login
// --------------------------------------------------------------------------
$router->add('POST', '/login', static function (): void {
    $donnees = read_json_body();

    $telephone = valider_telephone(champ($donnees, 'telephone', 'téléphone'));
    $motDePasse = champ($donnees, 'password', 'mot de passe', false);

    $ip = ip_client();
    verifier_blocage($telephone, $ip);

    $utilisateur = sql_one(
        'SELECT id, nom, telephone, password_hash, role, actif, must_change_password, created_at
           FROM users WHERE telephone = :telephone LIMIT 1',
        ['telephone' => $telephone]
    );

    if ($utilisateur === null || !password_verify($motDePasse, (string) $utilisateur['password_hash'])) {
        enregistrer_tentative($telephone, $ip, false);
        api_error('Téléphone ou mot de passe incorrect.', 401);
    }

    if ((int) $utilisateur['actif'] !== 1) {
        api_error('Ce compte est désactivé. Contactez l’administrateur.', 403);
    }

    enregistrer_tentative($telephone, $ip, true);

    // Re-hachage transparent si le coût bcrypt a changé.
    if (password_needs_rehash((string) $utilisateur['password_hash'], PASSWORD_BCRYPT)) {
        sql_exec(
            'UPDATE users SET password_hash = :hash WHERE id = :id',
            ['hash' => password_hash($motDePasse, PASSWORD_BCRYPT), 'id' => (int) $utilisateur['id']]
        );
    }

    $jeton = creer_token((int) $utilisateur['id']);
    journaliser((int) $utilisateur['id'], 'login', 'Connexion réussie depuis ' . $ip);

    json_response([
        'token'     => $jeton['token'],
        'expiresAt' => $jeton['expiresAt'],
        'user'      => utilisateur_public($utilisateur),
    ]);
});

// --------------------------------------------------------------------------
// POST /api/logout
// --------------------------------------------------------------------------
$router->add('POST', '/logout', static function (): void {
    $utilisateur = utilisateur_courant();
    revoquer_token(token_depuis_requete());
    journaliser((int) $utilisateur['id'], 'logout', 'Déconnexion');

    json_response(['ok' => true]);
});

// --------------------------------------------------------------------------
// POST /api/change-password
// --------------------------------------------------------------------------
$router->add('POST', '/change-password', static function (): void {
    $utilisateur = utilisateur_courant();
    $donnees = read_json_body();

    $ancien = champ($donnees, 'ancien', 'ancien mot de passe', false);
    $nouveau = valider_mot_de_passe(champ($donnees, 'nouveau', 'nouveau mot de passe', false));

    if (!password_verify($ancien, (string) $utilisateur['password_hash'])) {
        api_error('L’ancien mot de passe est incorrect.', 422);
    }

    if (password_verify($nouveau, (string) $utilisateur['password_hash'])) {
        api_error('Le nouveau mot de passe doit être différent de l’ancien.', 422);
    }

    sql_exec(
        'UPDATE users SET password_hash = :hash, must_change_password = 0 WHERE id = :id',
        ['hash' => password_hash($nouveau, PASSWORD_BCRYPT), 'id' => (int) $utilisateur['id']]
    );

    // Toutes les autres sessions sont fermées.
    revoquer_tokens_utilisateur((int) $utilisateur['id'], token_depuis_requete());
    journaliser((int) $utilisateur['id'], 'change_password', 'Mot de passe modifié par l’utilisateur');

    json_response(['ok' => true]);
});
