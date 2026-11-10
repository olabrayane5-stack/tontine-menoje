<?php
/**
 * Sessions du dimanche (administrateur).
 *
 * Règles : une seule session ouverte à la fois, un seul versement par membre
 * et par session, fermeture = verrouillage + versements à 0 pour les absents.
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

/** Normalise une ligne sessions_dimanche pour l'API. */
function session_public(array $ligne): array
{
    return [
        'id'            => (int) $ligne['id'],
        'date'          => (string) $ligne['date'],
        'statut'        => (string) $ligne['statut'],
        'ouverte'       => $ligne['statut'] === 'ouverte',
        'openedAt'      => $ligne['opened_at'] ?? null,
        'closedAt'      => $ligne['closed_at'] ?? null,
        'nbVersements'  => isset($ligne['nb_versements']) ? (int) $ligne['nb_versements'] : null,
        'nbPresents'    => isset($ligne['nb_presents']) ? (int) $ligne['nb_presents'] : null,
        'total'         => isset($ligne['total']) ? (int) $ligne['total'] : null,
    ];
}

/** Charge une session ou renvoie 404. */
function session_ou_404(int $id): array
{
    $session = sql_one('SELECT * FROM sessions_dimanche WHERE id = :id', ['id' => $id]);

    if ($session === null) {
        api_error('Session introuvable.', 404);
    }

    return $session;
}

// --------------------------------------------------------------------------
// GET /api/sessions
// --------------------------------------------------------------------------
$router->add('GET', '/sessions', static function (): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $lignes = sql_all(
        "SELECT s.id, s.date, s.statut, s.opened_at, s.closed_at,
                COUNT(v.id) AS nb_versements,
                COALESCE(SUM(v.montant), 0) AS total,
                COALESCE(SUM(v.montant > 0), 0) AS nb_presents
           FROM sessions_dimanche s
           LEFT JOIN versements v ON v.session_id = s.id
          GROUP BY s.id, s.date, s.statut, s.opened_at, s.closed_at
          ORDER BY s.date DESC"
    );

    json_response(['sessions' => array_map('session_public', $lignes)]);
});

// --------------------------------------------------------------------------
// POST /api/sessions  { date }
// --------------------------------------------------------------------------
$router->add('POST', '/sessions', static function (): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $donnees = read_json_body();
    $date = valider_date(champ($donnees, 'date', 'date'), 'date');

    $jour = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    if (!$jour instanceof DateTimeImmutable || $jour->format('N') !== '7') {
        api_error('La date d’une session doit être un dimanche.', 422);
    }

    verrou_global('tontine_session_ouverte');

    $ouverte = sql_one(
        "SELECT id, date FROM sessions_dimanche WHERE statut = 'ouverte' ORDER BY date DESC LIMIT 1"
    );
    if ($ouverte !== null) {
        api_error(sprintf(
            'Une session est déjà ouverte (dimanche du %s). Fermez-la avant d’en ouvrir une autre.',
            $ouverte['date']
        ), 409);
    }

    $existante = sql_one('SELECT id FROM sessions_dimanche WHERE date = :date', ['date' => $date]);
    if ($existante !== null) {
        api_error('Une session existe déjà pour ce dimanche.', 409);
    }

    sql_exec("INSERT INTO sessions_dimanche (date, statut) VALUES (:date, 'ouverte')", ['date' => $date]);
    $id = (int) db()->lastInsertId();

    journaliser((int) $utilisateur['id'], 'open_session', sprintf('Ouverture de la session du %s', $date));
    deverrou_global('tontine_session_ouverte');

    $session = session_ou_404($id);
    json_response(['session' => session_public($session)], 201);
});

// --------------------------------------------------------------------------
// GET /api/sessions/:id
// --------------------------------------------------------------------------
$router->add('GET', '/sessions/:id', static function (array $params): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $id = (int) $params['id'];
    $session = session_ou_404($id);

    $versements = sql_all(
        'SELECT v.id, v.user_id, u.nom, u.telephone, v.montant, v.enregistre_par,
                v.created_at, v.updated_at
           FROM versements v
           INNER JOIN users u ON u.id = v.user_id
          WHERE v.session_id = :id
          ORDER BY u.nom ASC',
        ['id' => $id]
    );

    $membres = sql_all(
        "SELECT id, nom, telephone FROM users
          WHERE role = 'membre' AND actif = 1
          ORDER BY nom ASC"
    );

    $total = 0;
    $presents = 0;
    $lignes = [];
    foreach ($versements as $versement) {
        $montant = (int) $versement['montant'];
        $total += $montant;
        if ($montant > 0) {
            $presents++;
        }
        $lignes[] = [
            'id'             => (int) $versement['id'],
            'userId'         => (int) $versement['user_id'],
            'nom'            => (string) $versement['nom'],
            'telephone'      => (string) $versement['telephone'],
            'montant'        => $montant,
            'enregistrePar'  => $versement['enregistre_par'] === null ? null : (int) $versement['enregistre_par'],
            'createdAt'      => (string) $versement['created_at'],
            'updatedAt'      => (string) $versement['updated_at'],
        ];
    }

    json_response([
        'session'    => session_public($session),
        'versements' => $lignes,
        'membres'    => array_map(static fn (array $m): array => [
            'id'        => (int) $m['id'],
            'nom'       => (string) $m['nom'],
            'telephone' => (string) $m['telephone'],
        ], $membres),
        'total'      => $total,
        'presents'   => $presents,
    ]);
});

// --------------------------------------------------------------------------
// PUT /api/sessions/:id/versements  { userId, montant }
// --------------------------------------------------------------------------
$router->add('PUT', '/sessions/:id/versements', static function (array $params): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $id = (int) $params['id'];
    $donnees = read_json_body();

    if (!array_key_exists('userId', $donnees)) {
        api_error('Le champ « userId » est obligatoire.', 422);
    }
    $userId = valider_montant($donnees['userId'], 'identifiant du membre', 1, 4294967295);
    $montant = valider_montant($donnees['montant'] ?? null, 'montant', 0);

    $pdo = db();
    $pdo->beginTransaction();

    try {
        $session = sql_one('SELECT * FROM sessions_dimanche WHERE id = :id FOR UPDATE', ['id' => $id]);
        if ($session === null) {
            $pdo->rollBack();
            api_error('Session introuvable.', 404);
        }
        if ($session['statut'] !== 'ouverte') {
            $pdo->rollBack();
            api_error('Session fermée : rouvrez-la avant de modifier les versements.', 409);
        }

        $membre = sql_one(
            "SELECT id, nom FROM users WHERE id = :id AND role = 'membre'",
            ['id' => $userId]
        );
        if ($membre === null) {
            $pdo->rollBack();
            api_error('Membre introuvable.', 404);
        }

        sql_exec(
            'INSERT INTO versements (session_id, user_id, montant, enregistre_par)
             VALUES (:session_id, :user_id, :montant, :auteur)
             ON DUPLICATE KEY UPDATE montant = VALUES(montant), enregistre_par = VALUES(enregistre_par)',
            [
                'session_id' => $id,
                'user_id'    => $userId,
                'montant'    => $montant,
                'auteur'     => (int) $utilisateur['id'],
            ]
        );

        $totaux = sql_one(
            'SELECT COUNT(*) AS nb, COALESCE(SUM(montant), 0) AS total,
                    COALESCE(SUM(montant > 0), 0) AS presents
               FROM versements WHERE session_id = :id',
            ['id' => $id]
        );

        $pdo->commit();
    } catch (Throwable $erreur) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $erreur;
    }

    $versement = sql_one(
        'SELECT id, session_id, user_id, montant, enregistre_par, created_at, updated_at
           FROM versements WHERE session_id = :session_id AND user_id = :user_id',
        ['session_id' => $id, 'user_id' => $userId]
    );

    journaliser(
        (int) $utilisateur['id'],
        'upsert_versement',
        sprintf('Session #%d, membre #%d : %d FCFA', $id, $userId, $montant)
    );

    json_response([
        'ok'         => true,
        'versement'  => $versement === null ? null : [
            'id'        => (int) $versement['id'],
            'sessionId' => (int) $versement['session_id'],
            'userId'    => (int) $versement['user_id'],
            'nom'       => (string) $membre['nom'],
            'montant'   => (int) $versement['montant'],
            'updatedAt' => (string) $versement['updated_at'],
        ],
        'total'      => (int) ($totaux['total'] ?? 0),
        'presents'   => (int) ($totaux['presents'] ?? 0),
        'nbNotes'    => (int) ($totaux['nb'] ?? 0),
    ]);
});

// --------------------------------------------------------------------------
// POST /api/sessions/:id/close
// --------------------------------------------------------------------------
$router->add('POST', '/sessions/:id/close', static function (array $params): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $id = (int) $params['id'];
    $pdo = db();
    $pdo->beginTransaction();

    try {
        $session = sql_one('SELECT * FROM sessions_dimanche WHERE id = :id FOR UPDATE', ['id' => $id]);
        if ($session === null) {
            $pdo->rollBack();
            api_error('Session introuvable.', 404);
        }
        if ($session['statut'] !== 'ouverte') {
            $pdo->rollBack();
            api_error('Cette session est déjà fermée.', 409);
        }

        // Règle métier n° 3 : tout membre actif sans versement reçoit 0.
        $crees = sql_exec(
            "INSERT INTO versements (session_id, user_id, montant, enregistre_par)
             SELECT :session_id, u.id, 0, :auteur
               FROM users u
              WHERE u.role = 'membre'
                AND u.actif = 1
                AND NOT EXISTS (
                    SELECT 1 FROM versements v
                     WHERE v.session_id = :session_id_bis AND v.user_id = u.id
                )",
            [
                'session_id'     => $id,
                'session_id_bis' => $id,
                'auteur'         => (int) $utilisateur['id'],
            ]
        );

        sql_exec(
            "UPDATE sessions_dimanche SET statut = 'fermee', closed_at = NOW() WHERE id = :id",
            ['id' => $id]
        );

        $totaux = sql_one(
            'SELECT COUNT(*) AS nb, COALESCE(SUM(montant), 0) AS total,
                    COALESCE(SUM(montant > 0), 0) AS presents
               FROM versements WHERE session_id = :id',
            ['id' => $id]
        );

        $pdo->commit();
    } catch (Throwable $erreur) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $erreur;
    }

    journaliser(
        (int) $utilisateur['id'],
        'close_session',
        sprintf(
            'Fermeture de la session #%d (%s), %d versement(s) à 0 créé(s)',
            $id,
            (string) $session['date'],
            $crees
        )
    );

    $miseAJour = session_ou_404($id);

    json_response([
        'ok'               => true,
        'session'          => session_public($miseAJour),
        'versementsCrees'  => $crees,
        'total'            => (int) ($totaux['total'] ?? 0),
        'presents'         => (int) ($totaux['presents'] ?? 0),
        'nbVersements'     => (int) ($totaux['nb'] ?? 0),
    ]);
});

// --------------------------------------------------------------------------
// POST /api/sessions/:id/reopen
// --------------------------------------------------------------------------
$router->add('POST', '/sessions/:id/reopen', static function (array $params): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $id = (int) $params['id'];
    verrou_global('tontine_session_ouverte');

    $pdo = db();
    $pdo->beginTransaction();

    try {
        $session = sql_one('SELECT * FROM sessions_dimanche WHERE id = :id FOR UPDATE', ['id' => $id]);
        if ($session === null) {
            $pdo->rollBack();
            api_error('Session introuvable.', 404);
        }
        if ($session['statut'] === 'ouverte') {
            $pdo->rollBack();
            api_error('Cette session est déjà ouverte.', 409);
        }

        $autre = sql_one(
            "SELECT id, date FROM sessions_dimanche WHERE statut = 'ouverte' AND id <> :id LIMIT 1",
            ['id' => $id]
        );
        if ($autre !== null) {
            $pdo->rollBack();
            api_error(sprintf(
                'La session du %s est déjà ouverte. Fermez-la avant de rouvrir celle-ci.',
                $autre['date']
            ), 409);
        }

        sql_exec(
            "UPDATE sessions_dimanche SET statut = 'ouverte', closed_at = NULL WHERE id = :id",
            ['id' => $id]
        );

        $pdo->commit();
    } catch (Throwable $erreur) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $erreur;
    }

    deverrou_global('tontine_session_ouverte');

    journaliser(
        (int) $utilisateur['id'],
        'reopen_session',
        sprintf(
            'Réouverture de la session #%d (%s), fermée le %s',
            $id,
            (string) $session['date'],
            (string) ($session['closed_at'] ?? '—')
        )
    );

    $miseAJour = session_ou_404($id);
    json_response(['ok' => true, 'session' => session_public($miseAJour)]);
});
