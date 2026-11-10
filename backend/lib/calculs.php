<?php
/**
 * Calculs métier — réplique exacte de src/utils/tontineUtils.ts côté serveur.
 *
 * Différences assumées (documentées dans README_BACKEND.md) :
 *  - la participation (nombre de dimanches, série, badges) ne compte que les
 *    versements dont le montant est > 0, sinon les versements à 0 créés
 *    automatiquement à la fermeture casseraient le classement ;
 *  - les dimanches de référence du classement sont les sessions FERMÉES.
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

/** Catalogue des badges : mêmes codes, noms et points que le front. */
const TONTINE_BADGES = [
    'PREMIER_PAS' => [
        'code'        => 'PREMIER_PAS',
        'nom'         => 'Premier Pas',
        'description' => 'A démarré son épargne tontine pour l’année',
        'icone'       => 'Footprints',
        'points'      => 15,
    ],
    'SERIE_4' => [
        'code'        => 'SERIE_4',
        'nom'         => 'Épargnant Assidu',
        'description' => '4 dimanches consécutifs sans rupture',
        'icone'       => 'Flame',
        'points'      => 50,
    ],
    'SERIE_8' => [
        'code'        => 'SERIE_8',
        'nom'         => 'Pilier d’Épargne',
        'description' => '8 dimanches consécutifs de fidélité',
        'icone'       => 'Award',
        'points'      => 120,
    ],
    'SERIE_12' => [
        'code'        => 'SERIE_12',
        'nom'         => 'Légende de la Tontine',
        'description' => '12 dimanches d’affilée, fêtes garanties sans stress',
        'icone'       => 'Crown',
        'points'      => 250,
    ],
    'REGULARITE_OR' => [
        'code'        => 'REGULARITE_OR',
        'nom'         => 'Cœur Prévoyant',
        'description' => 'Cotisation versée sur plus de 80% des dimanches écoulés',
        'icone'       => 'HeartHandshake',
        'points'      => 180,
    ],
];

// --------------------------------------------------------------------------
// Réglages
// --------------------------------------------------------------------------

/**
 * Tous les réglages, mis en cache pour la requête en cours.
 *
 * @return array<string, string>
 */
function reglages(): array
{
    global $tontine_reglages_cache;

    if (is_array($tontine_reglages_cache)) {
        return $tontine_reglages_cache;
    }

    $tontine_reglages_cache = [];
    foreach (sql_all('SELECT cle, valeur FROM reglages') as $ligne) {
        $tontine_reglages_cache[(string) $ligne['cle']] = (string) $ligne['valeur'];
    }

    return $tontine_reglages_cache;
}

/** Vide le cache des réglages (après une écriture dans la requête). */
function reinitialiser_reglages(): void
{
    global $tontine_reglages_cache;
    $tontine_reglages_cache = null;
}

function reglage(string $cle, ?string $defaut = null): ?string
{
    $tous = reglages();

    return array_key_exists($cle, $tous) ? $tous[$cle] : $defaut;
}

function ecrire_reglage(string $cle, string $valeur): void
{
    sql_exec(
        'INSERT INTO reglages (cle, valeur) VALUES (:cle, :valeur)
         ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)',
        ['cle' => $cle, 'valeur' => $valeur]
    );
}

/** Taux de retenue de l'église, en pourcentage (3 par défaut). */
function taux_retenue(): float
{
    $brut = reglage('taux_retenue', '3');
    $taux = is_numeric($brut) ? (float) $brut : 3.0;

    if ($taux < 0) {
        return 0.0;
    }
    if ($taux > 100) {
        return 100.0;
    }

    return round($taux, 2);
}

/** Réglages exposés au front (camelCase). */
function reglages_publics(): array
{
    return [
        'tauxRetenue'               => taux_retenue(),
        'nomEglise'                 => (string) (reglage('nom_eglise', 'M.E.NO.JE') ?? 'M.E.NO.JE'),
        'devise'                    => (string) (reglage('devise', 'FCFA') ?? 'FCFA'),
        'afficherMontantsClassement' => (reglage('afficher_montants_classement', '1') ?? '1') === '1',
    ];
}

// --------------------------------------------------------------------------
// Dimanches de référence
// --------------------------------------------------------------------------

/**
 * Dates des sessions, triées du plus ancien au plus récent.
 *
 * @return string[] Dates AAAA-MM-JJ.
 */
function dates_sessions(string $statut = 'fermee'): array
{
    $lignes = sql_all(
        'SELECT date FROM sessions_dimanche WHERE statut = :statut ORDER BY date ASC',
        ['statut' => $statut]
    );

    return array_map(static fn (array $ligne): string => (string) $ligne['date'], $lignes);
}

/**
 * Toutes les dates de session, ouvertes comme fermées.
 *
 * @return string[]
 */
function dates_sessions_toutes(): array
{
    $lignes = sql_all('SELECT date FROM sessions_dimanche ORDER BY date ASC');

    return array_map(static fn (array $ligne): string => (string) $ligne['date'], $lignes);
}

// --------------------------------------------------------------------------
// Statistiques
// --------------------------------------------------------------------------

/**
 * Construit les statistiques d'un membre.
 *
 * @param array<string, bool> $datesPayees Ensemble des dates où montant > 0.
 * @param string[]            $dimanchesFermes Dates des sessions fermées, croissantes.
 * @return array<string, mixed>
 */
function construire_stats(
    int $userId,
    int $totalVerse,
    array $datesPayees,
    int $totalRetire,
    array $dimanchesFermes,
    float $taux
): array {
    $soldeActuel = max(0, $totalVerse - $totalRetire);
    $nombreDimanches = count($datesPayees);

    // Frais d'organisation prélevés par l'église sur l'épargne totale.
    $partEglise = (int) round($totalVerse * ($taux / 100));
    $montantNetPrevisionnel = max(0, $totalVerse - $partEglise - $totalRetire);

    // Série de dimanches consécutifs (du plus récent au plus ancien).
    $serieEnCours = 0;
    foreach (array_reverse($dimanchesFermes) as $dimanche) {
        if (isset($datesPayees[$dimanche])) {
            $serieEnCours++;
            continue;
        }
        break;
    }

    $points = $nombreDimanches * 10 + $serieEnCours * 15;
    $badges = [];

    if ($nombreDimanches >= 1) {
        $badges[] = TONTINE_BADGES['PREMIER_PAS'];
    }
    if ($serieEnCours >= 4) {
        $badges[] = TONTINE_BADGES['SERIE_4'];
    }
    if ($serieEnCours >= 8) {
        $badges[] = TONTINE_BADGES['SERIE_8'];
    }
    if ($serieEnCours >= 12) {
        $badges[] = TONTINE_BADGES['SERIE_12'];
    }
    if (count($dimanchesFermes) > 0 && $nombreDimanches / count($dimanchesFermes) >= 0.8) {
        $badges[] = TONTINE_BADGES['REGULARITE_OR'];
    }

    foreach ($badges as $badge) {
        $points += (int) $badge['points'];
    }

    return [
        'userId'                 => $userId,
        'totalVerse'             => $totalVerse,
        'totalRetire'            => $totalRetire,
        'soldeActuel'            => $soldeActuel,
        'nombreDimanches'        => $nombreDimanches,
        'serieEnCours'           => $serieEnCours,
        'points'                 => $points,
        'badges'                 => $badges,
        'partEglise'             => $partEglise,
        'montantNetPrevisionnel' => $montantNetPrevisionnel,
        'tauxRetenue'            => $taux,
    ];
}

/**
 * Statistiques de tous les utilisateurs (y compris ceux sans versement).
 *
 * @return array<int, array<string, mixed>>
 */
function stats_tous(): array
{
    global $tontine_stats_cache;

    if (is_array($tontine_stats_cache)) {
        return $tontine_stats_cache;
    }

    $taux = taux_retenue();
    $dimanches = dates_sessions('fermee');

    $totaux = [];
    $payes = [];
    foreach (sql_all(
        'SELECT v.user_id, v.montant, s.date
           FROM versements v
           INNER JOIN sessions_dimanche s ON s.id = v.session_id'
    ) as $ligne) {
        $uid = (int) $ligne['user_id'];
        $montant = (int) $ligne['montant'];
        $totaux[$uid] = ($totaux[$uid] ?? 0) + $montant;
        if ($montant > 0) {
            $payes[$uid][(string) $ligne['date']] = true;
        }
    }

    $retraits = [];
    foreach (sql_all('SELECT user_id, SUM(montant) AS total FROM retraits GROUP BY user_id') as $ligne) {
        $retraits[(int) $ligne['user_id']] = (int) $ligne['total'];
    }

    $cache = [];
    foreach (sql_all('SELECT id FROM users') as $ligne) {
        $uid = (int) $ligne['id'];
        $cache[$uid] = construire_stats(
            $uid,
            $totaux[$uid] ?? 0,
            $payes[$uid] ?? [],
            $retraits[$uid] ?? 0,
            $dimanches,
            $taux
        );
    }

    $tontine_stats_cache = $cache;

    return $cache;
}

/** Vide le cache des statistiques (après une écriture dans la requête). */
function reinitialiser_stats(): void
{
    global $tontine_stats_cache;
    $tontine_stats_cache = null;
}

/**
 * Statistiques d'un membre.
 *
 * @return array<string, mixed>
 */
function stats_pour_user(int $userId): array
{
    $tous = stats_tous();

    if (isset($tous[$userId])) {
        return $tous[$userId];
    }

    return construire_stats($userId, 0, [], 0, dates_sessions('fermee'), taux_retenue());
}

/** Résumé léger pour le classement et les listes. */
function resume_stats(array $stats): array
{
    return [
        'points'          => (int) $stats['points'],
        'serieEnCours'    => (int) $stats['serieEnCours'],
        'nombreDimanches' => (int) $stats['nombreDimanches'],
        'totalVerse'      => (int) $stats['totalVerse'],
        'badges'          => array_map(
            static fn (array $badge): string => (string) $badge['code'],
            $stats['badges']
        ),
    ];
}
