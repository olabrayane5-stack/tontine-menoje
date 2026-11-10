<?php
/**
 * Classement solidaire : séries, points et badges.
 * Visible par tous les utilisateurs connectés.
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

$router->add('GET', '/classement', static function (): void {
    $utilisateur = utilisateur_courant();
    $reglages = reglages_publics();
    $afficherMontants = (bool) $reglages['afficherMontantsClassement'];

    // L'admin voit toujours les montants, même si l'affichage public est masqué.
    $montantsVisibles = $afficherMontants || $utilisateur['role'] === 'admin';

    $stats = stats_tous();
    $membres = sql_all(
        "SELECT id, nom FROM users WHERE role = 'membre' AND actif = 1 ORDER BY nom ASC"
    );

    $classement = [];
    foreach ($membres as $membre) {
        $id = (int) $membre['id'];
        $s = $stats[$id] ?? stats_pour_user($id);
        $classement[] = [
            'userId'          => $id,
            'nom'             => (string) $membre['nom'],
            'points'          => (int) $s['points'],
            'serieEnCours'    => (int) $s['serieEnCours'],
            'nombreDimanches' => (int) $s['nombreDimanches'],
            'totalVerse'      => $montantsVisibles ? (int) $s['totalVerse'] : null,
            'badges'          => array_map(
                static fn (array $badge): string => (string) $badge['code'],
                $s['badges']
            ),
        ];
    }

    usort($classement, static function (array $a, array $b): int {
        if ($a['points'] !== $b['points']) {
            return $b['points'] <=> $a['points'];
        }
        if (($a['totalVerse'] ?? 0) !== ($b['totalVerse'] ?? 0)) {
            return ($b['totalVerse'] ?? 0) <=> ($a['totalVerse'] ?? 0);
        }

        return strcmp($a['nom'], $b['nom']);
    });

    $rang = 0;
    foreach ($classement as $index => $ligne) {
        $rang++;
        $classement[$index] = ['rang' => $rang] + $ligne;
    }

    json_response([
        'afficherMontants' => $montantsVisibles,
        'badges'           => array_values(TONTINE_BADGES),
        'classement'       => $classement,
    ]);
});
