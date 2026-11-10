<?php
/**
 * Amorçage du backend : configuration, en-têtes, CORS, gestion des erreurs.
 * Ce fichier est inclus par index.php uniquement.
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

require_once __DIR__ . '/response.php';

define('TONTINE_ROOT', dirname(__DIR__));

/**
 * Cherche le fichier de configuration, du plus sûr au moins sûr :
 * hors htdocs d'abord, puis dans htdocs, puis dans api/.
 */
function tontine_config_path(): ?string
{
    $candidats = [];

    $env = getenv('TONTINE_CONFIG');
    if (is_string($env) && $env !== '') {
        $candidats[] = $env;
    }

    // <compte>/tontine-config.php : au-dessus de htdocs (recommandé).
    $candidats[] = dirname(TONTINE_ROOT, 2) . '/tontine-config.php';
    // <htdocs>/tontine-config.php
    $candidats[] = dirname(TONTINE_ROOT) . '/tontine-config.php';
    // api/config.php (dernier recours)
    $candidats[] = TONTINE_ROOT . '/config.php';

    foreach ($candidats as $chemin) {
        if (is_file($chemin) && is_readable($chemin)) {
            return $chemin;
        }
    }

    return null;
}

/**
 * Accès à la configuration : config() ou config('app.debug').
 */
function config(?string $cle = null)
{
    static $cfg = null;

    if ($cfg === null) {
        $chemin = tontine_config_path();
        if ($chemin === null) {
            error_log('[tontine] Aucun fichier de configuration trouvé.');
            json_response([
                'error' => 'Configuration du serveur manquante. Contactez l’administrateur.',
            ], 500);
        }

        $charge = require $chemin;
        if (!is_array($charge)) {
            error_log('[tontine] Configuration invalide : ' . $chemin);
            json_response(['error' => 'Configuration du serveur invalide.'], 500);
        }

        $cfg = array_replace_recursive([
            'db'  => [
                'host' => 'localhost', 'port' => 3306, 'charset' => 'utf8mb4',
            ],
            'app' => [
                'allowed_origins'      => [],
                'token_ttl_hours'      => 720,
                'login_max_attempts'   => 5,
                'login_window_minutes' => 15,
                'login_lock_minutes'   => 15,
                'debug'                => false,
                'timezone'             => 'Africa/Porto-Novo',
                'nom_application'      => 'Tontine M.E.NO.JE',
            ],
        ], $charge);
    }

    if ($cle === null) {
        return $cfg;
    }

    $valeur = $cfg;
    foreach (explode('.', $cle) as $segment) {
        if (!is_array($valeur) || !array_key_exists($segment, $valeur)) {
            return null;
        }
        $valeur = $valeur[$segment];
    }

    return $valeur;
}

// --------------------------------------------------------------------------
// Fuseau horaire et erreurs
// --------------------------------------------------------------------------
date_default_timezone_set((string) (config('app.timezone') ?: 'Africa/Porto-Novo'));

if (config('app.debug')) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
}

set_exception_handler(static function (Throwable $e): void {
    error_log('[tontine] ' . get_class($e) . ': ' . $e->getMessage()
        . ' @ ' . $e->getFile() . ':' . $e->getLine());

    $charge = ['error' => 'Erreur serveur. Réessayez plus tard.'];
    if (config('app.debug')) {
        $charge['debug'] = $e->getMessage();
    }
    json_response($charge, 500);
});

register_shutdown_function(static function (): void {
    $erreur = error_get_last();
    if ($erreur === null || !in_array($erreur['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    error_log('[tontine] Erreur fatale : ' . $erreur['message'] . ' @ ' . $erreur['file'] . ':' . $erreur['line']);
    if (!headers_sent()) {
        json_response(['error' => 'Erreur serveur. Réessayez plus tard.'], 500);
    }
});

// --------------------------------------------------------------------------
// En-têtes HTTP et CORS
// --------------------------------------------------------------------------
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');

$origine = $_SERVER['HTTP_ORIGIN'] ?? '';
$originesAutorisees = (array) config('app.allowed_origins');

if ($origine !== '' && in_array($origine, $originesAutorisees, true)) {
    header('Access-Control-Allow-Origin: ' . $origine);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Max-Age: 86400');
    header('Access-Control-Expose-Headers: Content-Disposition');
}

$methode = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($methode === 'OPTIONS') {
    http_response_code(204);
    exit;
}
