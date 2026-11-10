<?php
/**
 * Connexion PDO unique (utf8mb4) + helpers à requêtes préparées.
 * Aucune requête SQL n'est construite par concaténation de valeurs.
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $cfg = (array) config('db');

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        (string) ($cfg['host'] ?? 'localhost'),
        (int) ($cfg['port'] ?? 3306),
        (string) ($cfg['name'] ?? ''),
        (string) ($cfg['charset'] ?? 'utf8mb4')
    );

    $pdo = new PDO($dsn, (string) ($cfg['user'] ?? ''), (string) ($cfg['pass'] ?? ''), [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    return $pdo;
}

/** Exécute une requête préparée et renvoie le statement. */
function sql_query(string $sql, array $parametres = []): PDOStatement
{
    $stmt = db()->prepare($sql);
    foreach ($parametres as $cle => $valeur) {
        $nom = is_int($cle) ? $cle + 1 : (str_starts_with((string) $cle, ':') ? (string) $cle : ':' . $cle);
        $type = match (true) {
            is_int($valeur)  => PDO::PARAM_INT,
            is_bool($valeur) => PDO::PARAM_BOOL,
            $valeur === null => PDO::PARAM_NULL,
            default          => PDO::PARAM_STR,
        };
        $stmt->bindValue($nom, $valeur, $type);
    }
    $stmt->execute();

    return $stmt;
}

/** Toutes les lignes. */
function sql_all(string $sql, array $parametres = []): array
{
    return sql_query($sql, $parametres)->fetchAll();
}

/** Première ligne ou null. */
function sql_one(string $sql, array $parametres = []): ?array
{
    $ligne = sql_query($sql, $parametres)->fetch();

    return $ligne === false ? null : $ligne;
}

/** Première colonne de la première ligne. */
function sql_value(string $sql, array $parametres = [])
{
    $valeur = sql_query($sql, $parametres)->fetchColumn();

    return $valeur === false ? null : $valeur;
}

/** Nombre de lignes affectées. */
function sql_exec(string $sql, array $parametres = []): int
{
    return sql_query($sql, $parametres)->rowCount();
}

/**
 * Verrou nommé MySQL : sérialise les opérations sensibles (ouverture d'une
 * session, par exemple) entre plusieurs requêtes concurrentes.
 */
function verrou_global(string $nom, int $secondes = 5): void
{
    $ok = sql_value('SELECT GET_LOCK(:nom, :secondes)', ['nom' => $nom, 'secondes' => $secondes]);

    if ((int) $ok !== 1) {
        api_error('Une autre opération est en cours. Réessayez dans un instant.', 409);
    }
}

function deverrou_global(string $nom): void
{
    sql_exec('SELECT RELEASE_LOCK(:nom)', ['nom' => $nom]);
}
