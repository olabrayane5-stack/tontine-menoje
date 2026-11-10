<?php
/**
 * Réglages de l'application : lecture pour tous, écriture admin.
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

// --------------------------------------------------------------------------
// GET /api/reglages
// --------------------------------------------------------------------------
$router->add('GET', '/reglages', static function (): void {
    utilisateur_courant();

    json_response(['reglages' => reglages_publics()]);
});

// --------------------------------------------------------------------------
// PUT /api/reglages  { tauxRetenue?, nomEglise?, devise?, afficherMontantsClassement? }
// --------------------------------------------------------------------------
$router->add('PUT', '/reglages', static function (): void {
    $utilisateur = utilisateur_courant();
    exiger_admin($utilisateur);

    $donnees = read_json_body();
    $modifications = [];

    if (array_key_exists('tauxRetenue', $donnees)) {
        $brut = $donnees['tauxRetenue'];
        if (is_string($brut)) {
            $brut = str_replace(',', '.', trim($brut));
        }
        if (!is_numeric($brut)) {
            throw new ValidationError('Le taux de retenue doit être un nombre.');
        }
        $taux = round((float) $brut, 2);
        if ($taux < 0 || $taux > 100) {
            throw new ValidationError('Le taux de retenue doit être compris entre 0 et 100.');
        }
        $modifications['taux_retenue'] = rtrim(rtrim(number_format($taux, 2, '.', ''), '0'), '.');
    }

    if (array_key_exists('nomEglise', $donnees)) {
        $nom = valider_nom(champ($donnees, 'nomEglise', 'nom de l’église'), 'nom de l’église');
        $modifications['nom_eglise'] = $nom;
    }

    if (array_key_exists('devise', $donnees)) {
        $devise = champ($donnees, 'devise', 'devise');
        if (mb_strlen($devise) > 10) {
            throw new ValidationError('La devise ne doit pas dépasser 10 caractères.');
        }
        $modifications['devise'] = $devise;
    }

    if (array_key_exists('afficherMontantsClassement', $donnees)) {
        $afficher = valider_booleen($donnees['afficherMontantsClassement'], 'afficherMontantsClassement');
        $modifications['afficher_montants_classement'] = $afficher ? '1' : '0';
    }

    if ($modifications === []) {
        api_error('Aucun réglage à mettre à jour.', 422);
    }

    foreach ($modifications as $cle => $valeur) {
        ecrire_reglage($cle, $valeur);
    }

    reinitialiser_reglages();

    journaliser(
        (int) $utilisateur['id'],
        'update_reglages',
        implode(', ', array_keys($modifications))
    );

    json_response(['reglages' => reglages_publics()]);
});
