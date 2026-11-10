<?php
/**
 * Données personnelles du membre connecté (et de l'admin sur son propre compte).
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

// --------------------------------------------------------------------------
// GET /api/me
// --------------------------------------------------------------------------
$router->add('GET', '/me', static function (): void {
    $utilisateur = utilisateur_courant();
    $id = (int) $utilisateur['id'];

    json_response([
        'user'     => utilisateur_public($utilisateur),
        'stats'    => stats_pour_user($id),
        'reglages' => reglages_publics(),
    ]);
});

// --------------------------------------------------------------------------
// GET /api/me/releve
// --------------------------------------------------------------------------
$router->add('GET', '/me/releve', static function (): void {
    $utilisateur = utilisateur_courant();
    $id = (int) $utilisateur['id'];

    $stats = stats_pour_user($id);

    $versements = sql_all(
        'SELECT v.id, v.session_id, s.date, v.montant, v.created_at, v.updated_at
           FROM versements v
           INNER JOIN sessions_dimanche s ON s.id = v.session_id
          WHERE v.user_id = :id
          ORDER BY s.date DESC',
        ['id' => $id]
    );

    $retraits = sql_all(
        'SELECT id, montant, motif, date, created_at
           FROM retraits
          WHERE user_id = :id
          ORDER BY date DESC, id DESC',
        ['id' => $id]
    );

    json_response([
        'membre'     => utilisateur_public($utilisateur),
        'tauxRetenue' => (float) $stats['tauxRetenue'],
        'totaux'     => [
            'totalVerse'             => (int) $stats['totalVerse'],
            'totalRetire'            => (int) $stats['totalRetire'],
            'soldeActuel'            => (int) $stats['soldeActuel'],
            'partEglise'             => (int) $stats['partEglise'],
            'montantNetPrevisionnel' => (int) $stats['montantNetPrevisionnel'],
        ],
        'stats'      => $stats,
        'versements' => array_map(static fn (array $ligne): array => [
            'id'        => (int) $ligne['id'],
            'sessionId' => (int) $ligne['session_id'],
            'date'      => (string) $ligne['date'],
            'montant'   => (int) $ligne['montant'],
            'createdAt' => (string) $ligne['created_at'],
            'updatedAt' => (string) $ligne['updated_at'],
        ], $versements),
        'retraits'   => array_map(static fn (array $ligne): array => [
            'id'        => (int) $ligne['id'],
            'montant'   => (int) $ligne['montant'],
            'motif'     => (string) ($ligne['motif'] ?? ''),
            'date'      => (string) $ligne['date'],
            'createdAt' => (string) $ligne['created_at'],
        ], $retraits),
    ]);
});
