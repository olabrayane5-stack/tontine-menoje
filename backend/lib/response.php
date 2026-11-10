<?php
/**
 * Réponses JSON normalisées.
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

/**
 * Envoie une réponse JSON et termine le script.
 */
function json_response($donnees, int $statut = 200): void
{
    http_response_code($statut);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($donnees, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Erreur normalisée : { "error": "message en français" }.
 * Le champ `details` est optionnel (validation par champ).
 */
function api_error(string $message, int $statut = 400, array $details = []): void
{
    $charge = ['error' => $message];
    if ($details !== []) {
        $charge['details'] = $details;
    }
    json_response($charge, $statut);
}

/**
 * Lit et décode le corps JSON. Un corps vide renvoie un tableau vide.
 */
function read_json_body(): array
{
    $brut = file_get_contents('php://input');
    if ($brut === false || trim($brut) === '') {
        return [];
    }

    $donnees = json_decode($brut, true);
    if (!is_array($donnees)) {
        api_error('Corps de requête JSON invalide.', 422);
    }

    return $donnees;
}
