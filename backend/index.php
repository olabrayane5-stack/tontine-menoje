<?php
/**
 * Point d'entrée unique de l'API Tontine M.E.NO.JE.
 *
 * Toutes les requêtes /api/* sont réécrites ici par .htaccess.
 * Réponses JSON en camelCase ; erreurs { "error": "message en français" }.
 */
declare(strict_types=1);

define('TONTINE_APP', true);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/validate.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/calculs.php';
require __DIR__ . '/lib/router.php';

/** @var Router $router */
$router = new Router();

foreach (glob(__DIR__ . '/routes/*.php') ?: [] as $fichierRoute) {
    require $fichierRoute;
}

// --------------------------------------------------------------------------
// Calcul du chemin demandé, indépendamment du sous-dossier d'installation.
// --------------------------------------------------------------------------
$uri = (string) (parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?? '/');
$uri = rawurldecode($uri);

$dossierRacine = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? '')) ?: '';
$dossierApp = realpath(__DIR__) ?: '';
$dossierRacine = str_replace('\\', '/', $dossierRacine);
$dossierApp = str_replace('\\', '/', $dossierApp);

$base = '';
if ($dossierRacine !== '' && $dossierApp !== '' && stripos($dossierApp, $dossierRacine) === 0) {
    $base = rtrim(substr($dossierApp, strlen($dossierRacine)), '/');
} else {
    $dossierScript = str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/index.php')));
    if ($dossierScript !== '/' && $dossierScript !== '.') {
        $base = rtrim($dossierScript, '/');
    }
}

if ($base !== '' && str_starts_with($uri, $base)) {
    $uri = substr($uri, strlen($base));
}

// Le préfixe public de l'API est /api, que le dossier soit htdocs/api
// (InfinityFree) ou la racine du domaine (serveur local, test).
if (str_starts_with($uri, '/api')) {
    $uri = substr($uri, 4);
}

$uri = '/' . trim($uri, '/');
$methode = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

try {
    $router->dispatch($methode, $uri);
} catch (ValidationError $erreur) {
    api_error($erreur->getMessage(), 422, $erreur->details);
} catch (PDOException $erreur) {
    error_log('[tontine] SQLSTATE ' . $erreur->getCode() . ' : ' . $erreur->getMessage());
    if ($erreur->getCode() === '23000') {
        api_error('Conflit : cette donnée existe déjà.', 409);
    }
    api_error('Erreur de base de données. Réessayez plus tard.', 500);
}
