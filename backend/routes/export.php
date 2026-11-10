<?php
/**
 * Exports administrateur : sauvegarde JSON complète et CSV des opérations.
 *
 * Le JSON reprend volontairement le format attendu par le front
 * (src/utils/backup.ts) : { app, version, exported_at, data } avec des clés
 * en snake_case dans `data`. C'est la seule exception à la règle camelCase,
 * imposée par la compatibilité avec la restauration côté React.
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

/** Échappement CSV (séparateur « ; »). */
function export_csv_echapper($valeur): string
{
    $texte = (string) ($valeur ?? '');

    return preg_match('/[";\n\r]/', $texte) === 1
        ? '"' . str_replace('"', '""', $texte) . '"'
        : $texte;
}

/** En-tête de téléchargement. */
function export_telecharger(string $nomFichier, string $typeMime): void
{
    header('Content-Type: ' . $typeMime);
    header('Content-Disposition: attachment; filename="' . $nomFichier . '"');
    header('Content-Transfer-Encoding: binary');
}

// --------------------------------------------------------------------------
// GET /api/export/backup
// --------------------------------------------------------------------------
$router->add('GET', '/export/backup', static function (): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $reglages = reglages_publics();
    $adminId = (int) (sql_value("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1") ?? 0);

    $users = [];
    foreach (sql_all('SELECT id, nom, telephone, role, actif, must_change_password, created_at FROM users ORDER BY id ASC') as $ligne) {
        $users[] = [
            'id'                   => (int) $ligne['id'],
            'nom_complet'          => (string) $ligne['nom'],
            'telephone'            => (string) $ligne['telephone'],
            'role'                 => (string) $ligne['role'],
            'statut'               => (int) $ligne['actif'] === 1 ? 'actif' : 'inactif',
            'must_change_password' => (int) $ligne['must_change_password'] === 1,
            'whatsapp_disponible'  => true,
            'created_at'           => (string) $ligne['created_at'],
        ];
    }

    $versements = [];
    foreach (sql_all(
        'SELECT v.id, v.session_id, v.user_id, s.date, v.montant, v.enregistre_par, v.created_at
           FROM versements v
           INNER JOIN sessions_dimanche s ON s.id = v.session_id
          ORDER BY s.date ASC, v.id ASC'
    ) as $ligne) {
        $versements[] = [
            'id'              => (int) $ligne['id'],
            'session_id'      => (int) $ligne['session_id'],
            'user_id'         => (int) $ligne['user_id'],
            'date_dimanche'   => (string) $ligne['date'],
            'montant'         => (int) $ligne['montant'],
            'mode_reglement'  => 'especes',
            'enregistre_par'  => (int) ($ligne['enregistre_par'] ?? 0),
            'created_at'      => (string) $ligne['created_at'],
        ];
    }

    $retraits = [];
    foreach (sql_all(
        'SELECT id, user_id, montant, motif, date, enregistre_par, created_at
           FROM retraits ORDER BY date ASC, id ASC'
    ) as $ligne) {
        $retraits[] = [
            'id'             => (int) $ligne['id'],
            'session_id'     => 0,
            'user_id'        => (int) $ligne['user_id'],
            'date_retrait'   => (string) $ligne['date'],
            'montant'        => (int) $ligne['montant'],
            'motif'          => (string) ($ligne['motif'] ?? ''),
            'enregistre_par' => (int) ($ligne['enregistre_par'] ?? 0),
            'created_at'     => (string) $ligne['created_at'],
        ];
    }

    $annonces = [];
    foreach (sql_all('SELECT id, titre, contenu, created_at FROM annonces ORDER BY created_at ASC, id ASC') as $ligne) {
        $annonces[] = [
            'id'                => (int) $ligne['id'],
            'titre'             => (string) $ligne['titre'],
            'contenu'           => (string) $ligne['contenu'],
            'priorite'          => 'normale',
            'publie_par'        => $adminId,
            'date_publication'  => (string) $ligne['created_at'],
        ];
    }

    $sauvegarde = [
        'app'         => 'tontine-menoje',
        'version'     => 1,
        'exported_at' => (new DateTimeImmutable())->format(DATE_ATOM),
        'data'        => [
            'users'       => $users,
            'versements'  => $versements,
            'retraits'    => $retraits,
            'sundaysList' => dates_sessions_toutes(),
            'annonces'    => $annonces,
            'parametres'  => [
                'nom_eglise'                 => $reglages['nomEglise'],
                'devise'                     => $reglages['devise'],
                'afficher_montants_classement' => $reglages['afficherMontantsClassement'],
                'quota_ia_quotidien'         => 5,
                'pourcentage_retenue'        => $reglages['tauxRetenue'],
            ],
        ],
    ];

    journaliser((int) $utilisateur['id'], 'export_backup', 'Sauvegarde JSON téléchargée');

    export_telecharger(
        'tontine-menoje-backup-' . (new DateTimeImmutable())->format('Y-m-d') . '.json',
        'application/json;charset=utf-8'
    );

    echo json_encode($sauvegarde, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
});

// --------------------------------------------------------------------------
// GET /api/export/csv
// --------------------------------------------------------------------------
$router->add('GET', '/export/csv', static function (): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $noms = [];
    foreach (sql_all('SELECT id, nom, telephone FROM users') as $ligne) {
        $noms[(int) $ligne['id']] = [
            'nom'       => (string) $ligne['nom'],
            'telephone' => (string) $ligne['telephone'],
        ];
    }

    $lignes = [];

    foreach (sql_all(
        'SELECT v.user_id, v.montant, v.enregistre_par, s.date
           FROM versements v
           INNER JOIN sessions_dimanche s ON s.id = v.session_id
          ORDER BY s.date ASC, v.id ASC'
    ) as $ligne) {
        $membre = $noms[(int) $ligne['user_id']] ?? ['nom' => 'Membre #' . $ligne['user_id'], 'telephone' => ''];
        $auteur = $noms[(int) ($ligne['enregistre_par'] ?? 0)]['nom'] ?? '';
        $lignes[] = [
            (string) $ligne['date'],
            'Versement',
            $membre['nom'],
            $membre['telephone'],
            (string) (int) $ligne['montant'],
            'Espèces',
            $auteur,
        ];
    }

    foreach (sql_all(
        'SELECT r.user_id, r.montant, r.motif, r.date, r.enregistre_par
           FROM retraits r ORDER BY r.date ASC, r.id ASC'
    ) as $ligne) {
        $membre = $noms[(int) $ligne['user_id']] ?? ['nom' => 'Membre #' . $ligne['user_id'], 'telephone' => ''];
        $auteur = $noms[(int) ($ligne['enregistre_par'] ?? 0)]['nom'] ?? '';
        $lignes[] = [
            (string) $ligne['date'],
            'Retrait',
            $membre['nom'],
            $membre['telephone'],
            (string) (int) $ligne['montant'],
            (string) ($ligne['motif'] ?? ''),
            $auteur,
        ];
    }

    usort($lignes, static fn (array $a, array $b): int => strcmp($a[0], $b[0]));

    $entete = ['Date', 'Type', 'Membre', 'Téléphone', 'Montant', 'Mode / motif', 'Enregistré par'];
    $sortie = "\xEF\xBB\xBF" . implode(';', array_map('export_csv_echapper', $entete));

    foreach ($lignes as $ligne) {
        $sortie .= "\r\n" . implode(';', array_map('export_csv_echapper', $ligne));
    }

    journaliser((int) $utilisateur['id'], 'export_csv', 'Export CSV téléchargé');

    export_telecharger(
        'tontine-menoje-operations-' . (new DateTimeImmutable())->format('Y-m-d') . '.csv',
        'text/csv;charset=utf-8'
    );

    echo $sortie;
    exit;
});
