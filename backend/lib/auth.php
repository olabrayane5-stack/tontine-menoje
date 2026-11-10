<?php
/**
 * Authentification par jeton Bearer.
 *
 * Le jeton clair n'est jamais stocké : seul son empreinte SHA-256 est en base
 * (table auth_tokens), avec une date d'expiration. Aucun cookie n'est utilisé,
 * le front Vercel vit sur un autre domaine.
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

/**
 * Extrait le jeton de l'en-tête Authorization: Bearer xxx.
 */
function token_depuis_requete(): ?string
{
    $entete = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');

    // Certaines configurations Apache/CGI ne remplissent pas HTTP_AUTHORIZATION.
    if ($entete === '' && function_exists('getallheaders')) {
        foreach ((array) getallheaders() as $nom => $valeur) {
            if (strtolower((string) $nom) === 'authorization') {
                $entete = (string) $valeur;
                break;
            }
        }
    }

    if ($entete === '' && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $entete = (string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }

    if (preg_match('/^\s*Bearer\s+(\S{16,})\s*$/i', $entete, $trouve) === 1) {
        return $trouve[1];
    }

    return null;
}

/** Empreinte stockée en base. */
function hash_token(string $token): string
{
    return hash('sha256', $token);
}

/**
 * Crée un jeton pour un utilisateur et le renvoie en clair (une seule fois).
 *
 * @return array{token: string, expiresAt: string}
 */
function creer_token(int $userId): array
{
    $token = bin2hex(random_bytes(32));
    $heures = max(1, (int) config('app.token_ttl_hours'));
    $expire = (new DateTimeImmutable())->modify('+' . $heures . ' hours');

    // Ménage opportuniste des jetons expirés.
    sql_exec('DELETE FROM auth_tokens WHERE expires_at < NOW()');

    sql_exec(
        'INSERT INTO auth_tokens (user_id, token_hash, expires_at) VALUES (:uid, :hash, :expire)',
        ['uid' => $userId, 'hash' => hash_token($token), 'expire' => $expire->format('Y-m-d H:i:s')]
    );

    return [
        'token'     => $token,
        'expiresAt' => $expire->format(DATE_ATOM),
    ];
}

/**
 * Utilisateur authentifié, ou 401.
 *
 * @return array<string, mixed> Ligne users + id normalisé en entier.
 */
function utilisateur_courant(): array
{
    $token = token_depuis_requete();
    if ($token === null) {
        api_error('Authentification requise.', 401);
    }

    $ligne = sql_one(
        'SELECT u.id, u.nom, u.telephone, u.password_hash, u.role, u.actif,
                u.must_change_password, u.created_at, t.expires_at
           FROM auth_tokens t
           INNER JOIN users u ON u.id = t.user_id
          WHERE t.token_hash = :hash AND t.expires_at > NOW()
          LIMIT 1',
        ['hash' => hash_token($token)]
    );

    if ($ligne === null) {
        api_error('Session expirée ou invalide. Reconnectez-vous.', 401);
    }

    if ((int) $ligne['actif'] !== 1) {
        api_error('Ce compte est désactivé. Contactez l’administrateur.', 403);
    }

    $ligne['id'] = (int) $ligne['id'];
    $ligne['actif'] = (int) $ligne['actif'];
    $ligne['must_change_password'] = (int) $ligne['must_change_password'];

    return $ligne;
}

/**
 * Exige le rôle administrateur, sinon 403.
 */
function exiger_admin(array $utilisateur): void
{
    if (($utilisateur['role'] ?? '') !== 'admin') {
        api_error('Accès réservé à l’administrateur.', 403);
    }
}

/**
 * Interdit les actions d'écriture tant que le mot de passe provisoire
 * n'a pas été changé (règle métier n° 10).
 */
function exiger_mot_de_passe_change(array $utilisateur): void
{
    if ((int) ($utilisateur['must_change_password'] ?? 0) === 1) {
        api_error('Vous devez d’abord changer votre mot de passe provisoire.', 403);
    }
}

/**
 * Révoque un jeton précis.
 */
function revoquer_token(?string $token): void
{
    if ($token === null) {
        return;
    }
    sql_exec('DELETE FROM auth_tokens WHERE token_hash = :hash', ['hash' => hash_token($token)]);
}

/**
 * Révoque toutes les sessions d'un utilisateur (mot de passe réinitialisé,
 * compte désactivé, etc.). Optionnellement, épargne le jeton courant.
 */
function revoquer_tokens_utilisateur(int $userId, ?string $sauf = null): void
{
    if ($sauf === null) {
        sql_exec('DELETE FROM auth_tokens WHERE user_id = :uid', ['uid' => $userId]);
        return;
    }

    sql_exec(
        'DELETE FROM auth_tokens WHERE user_id = :uid AND token_hash <> :hash',
        ['uid' => $userId, 'hash' => hash_token($sauf)]
    );
}

/**
 * Représentation publique d'un utilisateur (jamais de hash de mot de passe).
 *
 * @return array<string, mixed>
 */
function utilisateur_public(array $ligne): array
{
    return [
        'id'                 => (int) $ligne['id'],
        'nom'                => (string) $ligne['nom'],
        'telephone'          => (string) $ligne['telephone'],
        'role'               => (string) $ligne['role'],
        'actif'              => (int) $ligne['actif'] === 1,
        'mustChangePassword' => (int) $ligne['must_change_password'] === 1,
        'createdAt'          => (string) $ligne['created_at'],
    ];
}

// --------------------------------------------------------------------------
// Journal d'audit
// --------------------------------------------------------------------------

function journaliser(?int $userId, string $action, string $detail = ''): void
{
    sql_exec(
        'INSERT INTO audit_log (user_id, action, detail) VALUES (:uid, :action, :detail)',
        [
            'uid'    => $userId,
            'action' => mb_substr($action, 0, 64),
            'detail' => $detail === '' ? null : $detail,
        ]
    );
}

// --------------------------------------------------------------------------
// Limitation des tentatives de connexion (anti-force brute)
// --------------------------------------------------------------------------

function ip_client(): string
{
    return mb_substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
}

/**
 * Bloque temporairement après N échecs sur une fenêtre glissante.
 */
function verifier_blocage(string $telephone, string $ip): void
{
    $max = max(1, (int) config('app.login_max_attempts'));
    $fenetre = max(1, (int) config('app.login_window_minutes'));
    $blocage = max(1, (int) config('app.login_lock_minutes'));

    $depuis = (new DateTimeImmutable())->modify('-' . $fenetre . ' minutes')->format('Y-m-d H:i:s');

    $ligne = sql_one(
        'SELECT COUNT(*) AS nb, MAX(created_at) AS dernier
           FROM login_attempts
          WHERE success = 0
            AND created_at >= :depuis
            AND (telephone = :telephone OR ip = :ip)',
        ['depuis' => $depuis, 'telephone' => $telephone, 'ip' => $ip]
    );

    if ($ligne === null || (int) $ligne['nb'] < $max || empty($ligne['dernier'])) {
        return;
    }

    $fin = strtotime((string) $ligne['dernier']) + $blocage * 60;
    $reste = $fin - time();

    if ($reste > 0) {
        $minutes = (int) ceil($reste / 60);
        api_error(
            sprintf(
                'Trop de tentatives échouées. Réessayez dans %d minute%s.',
                $minutes,
                $minutes > 1 ? 's' : ''
            ),
            429
        );
    }
}

function enregistrer_tentative(string $telephone, string $ip, bool $succes): void
{
    sql_exec(
        'INSERT INTO login_attempts (telephone, ip, success) VALUES (:telephone, :ip, :succes)',
        ['telephone' => $telephone, 'ip' => $ip, 'succes' => $succes ? 1 : 0]
    );

    // Purge des vieilles lignes (garde 7 jours d'historique).
    sql_exec('DELETE FROM login_attempts WHERE created_at < (NOW() - INTERVAL 7 DAY)');
}
