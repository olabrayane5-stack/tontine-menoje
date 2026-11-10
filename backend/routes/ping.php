<?php
/**
 * GET /api/ping — sonde publique (aucune authentification).
 *
 * Sert à vérifier depuis le front Vercel que l'appel cross-origin n'est pas
 * bloqué par l'hébergement (challenge anti-robot InfinityFree, etc.).
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

$router->add('GET', '/ping', static function (): void {
    $baseOk = true;
    try {
        sql_value('SELECT 1');
    } catch (Throwable $erreur) {
        $baseOk = false;
        error_log('[tontine] ping base : ' . $erreur->getMessage());
    }

    json_response([
        'ok'       => true,
        'app'      => (string) config('app.nom_application'),
        'version'  => '1.0.0',
        'time'     => (new DateTimeImmutable())->format(DATE_ATOM),
        'database' => $baseOk,
    ]);
});
