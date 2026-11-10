<?php
/**
 * Annonces : lecture pour tous les utilisateurs connectés, écriture admin.
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

// --------------------------------------------------------------------------
// GET /api/annonces
// --------------------------------------------------------------------------
$router->add('GET', '/annonces', static function (): void {
    utilisateur_courant();

    $lignes = sql_all(
        'SELECT id, titre, contenu, created_at FROM annonces ORDER BY created_at DESC, id DESC'
    );

    json_response([
        'annonces' => array_map(static fn (array $ligne): array => [
            'id'        => (int) $ligne['id'],
            'titre'     => (string) $ligne['titre'],
            'contenu'   => (string) $ligne['contenu'],
            'createdAt' => (string) $ligne['created_at'],
        ], $lignes),
    ]);
});

// --------------------------------------------------------------------------
// POST /api/annonces  { titre, contenu }
// --------------------------------------------------------------------------
$router->add('POST', '/annonces', static function (): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $donnees = read_json_body();
    $titre = champ($donnees, 'titre', 'titre');
    $contenu = champ($donnees, 'contenu', 'contenu');

    if (mb_strlen($titre) > 150) {
        throw new ValidationError('Le titre ne doit pas dépasser 150 caractères.');
    }
    if (mb_strlen($contenu) > 5000) {
        throw new ValidationError('Le contenu ne doit pas dépasser 5 000 caractères.');
    }

    sql_exec(
        'INSERT INTO annonces (titre, contenu) VALUES (:titre, :contenu)',
        ['titre' => $titre, 'contenu' => $contenu]
    );

    $id = (int) db()->lastInsertId();
    $ligne = sql_one('SELECT id, titre, contenu, created_at FROM annonces WHERE id = :id', ['id' => $id]);

    journaliser((int) $utilisateur['id'], 'create_annonce', sprintf('Annonce #%d : %s', $id, $titre));

    json_response([
        'annonce' => [
            'id'        => (int) $ligne['id'],
            'titre'     => (string) $ligne['titre'],
            'contenu'   => (string) $ligne['contenu'],
            'createdAt' => (string) $ligne['created_at'],
        ],
    ], 201);
});

// --------------------------------------------------------------------------
// DELETE /api/annonces/:id
// --------------------------------------------------------------------------
$router->add('DELETE', '/annonces/:id', static function (array $params): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $id = (int) $params['id'];
    $annonce = sql_one('SELECT id, titre FROM annonces WHERE id = :id', ['id' => $id]);
    if ($annonce === null) {
        api_error('Annonce introuvable.', 404);
    }

    sql_exec('DELETE FROM annonces WHERE id = :id', ['id' => $id]);
    journaliser(
        (int) $utilisateur['id'],
        'delete_annonce',
        sprintf('Suppression de l’annonce #%d : %s', $id, (string) $annonce['titre'])
    );

    json_response(['ok' => true]);
});
