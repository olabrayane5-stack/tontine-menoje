<?php
/**
 * Routeur minimaliste : méthodes HTTP + motifs « /sessions/:id ».
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

final class Router
{
    /** @var array<int, array{method: string, pattern: string, regex: string, handler: callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $method = strtoupper($method);
        $normalise = '/' . trim($pattern, '/');

        $regex = preg_replace_callback(
            '/:([a-zA-Z_][a-zA-Z0-9_]*)/',
            static fn (array $trouve): string => '(?P<' . $trouve[1] . '>\d+)',
            $normalise
        );

        $this->routes[] = [
            'method'  => $method,
            'pattern' => $normalise,
            'regex'   => '#^' . $regex . '$#',
            'handler' => $handler,
        ];
    }

    public function dispatch(string $method, string $path): void
    {
        $method = strtoupper($method);
        $path = '/' . trim($path, '/');

        // HEAD est traité comme GET (le serveur retire le corps).
        $methodeEffective = $method === 'HEAD' ? 'GET' : $method;

        $cheminConnu = false;

        foreach ($this->routes as $route) {
            if (preg_match($route['regex'], $path, $trouve) !== 1) {
                continue;
            }

            $cheminConnu = true;
            if ($route['method'] !== $methodeEffective) {
                continue;
            }

            $parametres = [];
            foreach ($trouve as $cle => $valeur) {
                if (is_string($cle)) {
                    $parametres[$cle] = (int) $valeur;
                }
            }

            ($route['handler'])($parametres);
            return;
        }

        if ($cheminConnu) {
            $autorisees = [];
            foreach ($this->routes as $route) {
                if (preg_match($route['regex'], $path) === 1) {
                    $autorisees[$route['method']] = true;
                }
            }
            header('Allow: ' . implode(', ', array_keys($autorisees)));
            api_error('Méthode HTTP non autorisée pour cette route.', 405);
        }

        api_error('Route introuvable.', 404);
    }
}
