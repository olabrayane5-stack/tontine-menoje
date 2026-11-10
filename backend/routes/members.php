<?php
/**
 * Gestion des membres (administrateur uniquement).
 *
 * Aucune inscription publique : l'admin crée le compte, remet un mot de passe
 * provisoire, et le membre doit le changer à la première connexion.
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

const TONTINE_CHAMPS_USER = 'id, nom, telephone, role, actif, must_change_password, created_at';

// --------------------------------------------------------------------------
// GET /api/members
// --------------------------------------------------------------------------
$router->add('GET', '/members', static function (): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $lignes = sql_all(
        'SELECT ' . TONTINE_CHAMPS_USER . '
           FROM users
          ORDER BY (role = \'admin\') DESC, nom ASC'
    );

    $stats = stats_tous();
    $membres = [];

    foreach ($lignes as $ligne) {
        $id = (int) $ligne['id'];
        $membre = utilisateur_public($ligne);
        $membre['stats'] = $stats[$id] ?? stats_pour_user($id);
        $membres[] = $membre;
    }

    json_response(['members' => $membres]);
});

// --------------------------------------------------------------------------
// POST /api/members
// --------------------------------------------------------------------------
$router->add('POST', '/members', static function (): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $donnees = read_json_body();
    $nom = valider_nom(champ($donnees, 'nom', 'nom'));
    $telephone = valider_telephone(champ($donnees, 'telephone', 'téléphone'));

    $motDePasseFourni = champ_optionnel($donnees, 'motDePasse');
    $motDePasse = $motDePasseFourni === null
        ? generer_mot_de_passe()
        : valider_mot_de_passe($motDePasseFourni, 'mot de passe provisoire');

    $existe = sql_value('SELECT id FROM users WHERE telephone = :telephone', ['telephone' => $telephone]);
    if ($existe !== null) {
        api_error('Ce numéro de téléphone est déjà utilisé.', 409);
    }

    sql_exec(
        'INSERT INTO users (nom, telephone, password_hash, role, actif, must_change_password)
         VALUES (:nom, :telephone, :hash, \'membre\', 1, 1)',
        [
            'nom'       => $nom,
            'telephone' => $telephone,
            'hash'      => password_hash($motDePasse, PASSWORD_BCRYPT),
        ]
    );

    $id = (int) db()->lastInsertId();
    $ligne = sql_one('SELECT ' . TONTINE_CHAMPS_USER . ' FROM users WHERE id = :id', ['id' => $id]);

    journaliser(
        (int) $utilisateur['id'],
        'create_member',
        sprintf('Création du membre #%d (%s)', $id, $nom)
    );

    json_response([
        'member'              => utilisateur_public($ligne ?? []),
        'motDePasseProvisoire' => $motDePasse,
    ], 201);
});

// --------------------------------------------------------------------------
// PUT /api/members/:id
// --------------------------------------------------------------------------
$router->add('PUT', '/members/:id', static function (array $params): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $id = (int) $params['id'];
    $cible = sql_one('SELECT ' . TONTINE_CHAMPS_USER . ' FROM users WHERE id = :id', ['id' => $id]);
    if ($cible === null) {
        api_error('Membre introuvable.', 404);
    }

    $donnees = read_json_body();
    $nom = array_key_exists('nom', $donnees)
        ? valider_nom(champ($donnees, 'nom', 'nom'))
        : (string) $cible['nom'];

    $telephone = array_key_exists('telephone', $donnees)
        ? valider_telephone(champ($donnees, 'telephone', 'téléphone'))
        : (string) $cible['telephone'];

    $conflit = sql_value(
        'SELECT id FROM users WHERE telephone = :telephone AND id <> :id',
        ['telephone' => $telephone, 'id' => $id]
    );
    if ($conflit !== null) {
        api_error('Ce numéro de téléphone est déjà utilisé par un autre membre.', 409);
    }

    sql_exec(
        'UPDATE users SET nom = :nom, telephone = :telephone WHERE id = :id',
        ['nom' => $nom, 'telephone' => $telephone, 'id' => $id]
    );

    journaliser((int) $utilisateur['id'], 'update_member', sprintf('Modification du membre #%d', $id));

    $ligne = sql_one('SELECT ' . TONTINE_CHAMPS_USER . ' FROM users WHERE id = :id', ['id' => $id]);
    json_response(['member' => utilisateur_public($ligne ?? [])]);
});

// --------------------------------------------------------------------------
// POST /api/members/:id/reset-password
// --------------------------------------------------------------------------
$router->add('POST', '/members/:id/reset-password', static function (array $params): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $id = (int) $params['id'];
    if ($id === (int) $utilisateur['id']) {
        api_error('Utilisez /api/change-password pour votre propre compte.', 409);
    }

    $cible = sql_one('SELECT ' . TONTINE_CHAMPS_USER . ' FROM users WHERE id = :id', ['id' => $id]);
    if ($cible === null) {
        api_error('Membre introuvable.', 404);
    }

    $donnees = read_json_body();
    $fourni = champ_optionnel($donnees, 'motDePasse');
    $motDePasse = $fourni === null
        ? generer_mot_de_passe()
        : valider_mot_de_passe($fourni, 'mot de passe provisoire');

    sql_exec(
        'UPDATE users SET password_hash = :hash, must_change_password = 1 WHERE id = :id',
        ['hash' => password_hash($motDePasse, PASSWORD_BCRYPT), 'id' => $id]
    );

    revoquer_tokens_utilisateur($id);
    journaliser(
        (int) $utilisateur['id'],
        'reset_password',
        sprintf('Mot de passe provisoire régénéré pour le membre #%d', $id)
    );

    json_response([
        'ok'                   => true,
        'motDePasseProvisoire' => $motDePasse,
    ]);
});

// --------------------------------------------------------------------------
// PATCH /api/members/:id/active
// --------------------------------------------------------------------------
$router->add('PATCH', '/members/:id/active', static function (array $params): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $id = (int) $params['id'];
    $cible = sql_one('SELECT ' . TONTINE_CHAMPS_USER . ' FROM users WHERE id = :id', ['id' => $id]);
    if ($cible === null) {
        api_error('Membre introuvable.', 404);
    }

    if ($cible['role'] === 'admin') {
        api_error('Le compte administrateur ne peut pas être désactivé.', 409);
    }

    $donnees = read_json_body();
    if (!array_key_exists('actif', $donnees)) {
        api_error('Le champ « actif » est obligatoire.', 422);
    }
    $actif = valider_booleen($donnees['actif'], 'actif');

    sql_exec('UPDATE users SET actif = :actif WHERE id = :id', ['actif' => $actif ? 1 : 0, 'id' => $id]);

    if (!$actif) {
        revoquer_tokens_utilisateur($id);
    }

    journaliser(
        (int) $utilisateur['id'],
        'toggle_member',
        sprintf('Membre #%d %s', $id, $actif ? 'réactivé' : 'désactivé')
    );

    $ligne = sql_one('SELECT ' . TONTINE_CHAMPS_USER . ' FROM users WHERE id = :id', ['id' => $id]);
    json_response(['member' => utilisateur_public($ligne ?? [])]);
});
