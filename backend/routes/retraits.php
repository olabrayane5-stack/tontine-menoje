<?php
/**
 * Retraits partiels (administrateur uniquement).
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

// --------------------------------------------------------------------------
// GET /api/retraits
// --------------------------------------------------------------------------
$router->add('GET', '/retraits', static function (): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $lignes = sql_all(
        'SELECT r.id, r.user_id, u.nom, u.telephone, r.montant, r.motif, r.date,
                r.enregistre_par, r.created_at
           FROM retraits r
           INNER JOIN users u ON u.id = r.user_id
          ORDER BY r.date DESC, r.id DESC'
    );

    $total = 0;
    $retraits = [];
    foreach ($lignes as $ligne) {
        $total += (int) $ligne['montant'];
        $retraits[] = [
            'id'            => (int) $ligne['id'],
            'userId'        => (int) $ligne['user_id'],
            'nom'           => (string) $ligne['nom'],
            'telephone'     => (string) $ligne['telephone'],
            'montant'       => (int) $ligne['montant'],
            'motif'         => (string) $ligne['motif'],
            'date'          => (string) $ligne['date'],
            'enregistrePar' => $ligne['enregistre_par'] === null ? null : (int) $ligne['enregistre_par'],
            'createdAt'     => (string) $ligne['created_at'],
        ];
    }

    json_response(['retraits' => $retraits, 'total' => $total]);
});

// --------------------------------------------------------------------------
// POST /api/retraits  { userId, montant, motif, date? }
// --------------------------------------------------------------------------
$router->add('POST', '/retraits', static function (): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $donnees = read_json_body();

    if (!array_key_exists('userId', $donnees)) {
        api_error('Le champ « userId » est obligatoire.', 422);
    }
    $userId = valider_montant($donnees['userId'], 'identifiant du membre', 1, 4294967295);
    $montant = valider_montant($donnees['montant'] ?? null, 'montant', 1);
    $motif = champ($donnees, 'motif', 'motif');
    if (mb_strlen($motif) > 255) {
        throw new ValidationError('Le motif ne doit pas dépasser 255 caractères.');
    }

    $date = array_key_exists('date', $donnees) && $donnees['date'] !== null && $donnees['date'] !== ''
        ? valider_date(champ($donnees, 'date', 'date'), 'date')
        : (new DateTimeImmutable())->format('Y-m-d');

    $membre = sql_one(
        "SELECT id, nom FROM users WHERE id = :id AND role = 'membre'",
        ['id' => $userId]
    );
    if ($membre === null) {
        api_error('Membre introuvable.', 404);
    }

    $stats = stats_pour_user($userId);
    if ($montant > (int) $stats['soldeActuel']) {
        api_error(sprintf(
            'Solde insuffisant : %s FCFA disponibles, %s FCFA demandés.',
            number_format((int) $stats['soldeActuel'], 0, ',', ' '),
            number_format($montant, 0, ',', ' ')
        ), 422);
    }

    sql_exec(
        'INSERT INTO retraits (user_id, montant, motif, date, enregistre_par)
         VALUES (:user_id, :montant, :motif, :date, :auteur)',
        [
            'user_id' => $userId,
            'montant' => $montant,
            'motif'   => $motif,
            'date'    => $date,
            'auteur'  => (int) $utilisateur['id'],
        ]
    );

    $id = (int) db()->lastInsertId();

    journaliser(
        (int) $utilisateur['id'],
        'create_retrait',
        sprintf('Retrait #%d : membre #%d, %d FCFA (%s)', $id, $userId, $montant, $motif)
    );

    reinitialiser_stats();

    $ligne = sql_one(
        'SELECT r.id, r.user_id, u.nom, r.montant, r.motif, r.date, r.created_at
           FROM retraits r INNER JOIN users u ON u.id = r.user_id
          WHERE r.id = :id',
        ['id' => $id]
    );

    $apres = stats_pour_user($userId);

    json_response([
        'retrait' => [
            'id'        => (int) $ligne['id'],
            'userId'    => (int) $ligne['user_id'],
            'nom'       => (string) $ligne['nom'],
            'montant'   => (int) $ligne['montant'],
            'motif'     => (string) $ligne['motif'],
            'date'      => (string) $ligne['date'],
            'createdAt' => (string) $ligne['created_at'],
        ],
        'soldeActuel' => (int) $apres['soldeActuel'],
    ], 201);
});
