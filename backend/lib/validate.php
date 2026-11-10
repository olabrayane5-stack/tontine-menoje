<?php
/**
 * Validation des entrées.
 *
 * Toute erreur de saisie lève une ValidationError, convertie en réponse
 * HTTP 422 par index.php. Les messages sont en français et destinés à
 * l'utilisateur final.
 */
declare(strict_types=1);

defined('TONTINE_APP') || exit;

final class ValidationError extends RuntimeException
{
    /** @var array<string, string> Détail par champ, optionnel. */
    public array $details;

    public function __construct(string $message, array $details = [])
    {
        parent::__construct($message);
        $this->details = $details;
    }
}

/**
 * Récupère un champ texte obligatoire.
 */
function champ(array $donnees, string $cle, string $libelle, bool $trim = true): string
{
    if (!array_key_exists($cle, $donnees)) {
        throw new ValidationError(sprintf('Le champ « %s » est obligatoire.', $libelle), [$cle => 'obligatoire']);
    }

    $valeur = $donnees[$cle];
    if (!is_string($valeur) && !is_int($valeur) && !is_float($valeur)) {
        throw new ValidationError(sprintf('Le champ « %s » doit être un texte.', $libelle), [$cle => 'type']);
    }

    $valeur = (string) $valeur;
    if ($trim) {
        $valeur = trim($valeur);
    }

    if ($valeur === '') {
        throw new ValidationError(sprintf('Le champ « %s » est obligatoire.', $libelle), [$cle => 'obligatoire']);
    }

    return $valeur;
}

/**
 * Récupère un champ texte facultatif (null s'il est absent ou vide).
 */
function champ_optionnel(array $donnees, string $cle, bool $trim = true): ?string
{
    if (!array_key_exists($cle, $donnees) || $donnees[$cle] === null) {
        return null;
    }

    if (!is_string($donnees[$cle]) && !is_int($donnees[$cle]) && !is_float($donnees[$cle])) {
        return null;
    }

    $valeur = (string) $donnees[$cle];
    if ($trim) {
        $valeur = trim($valeur);
    }

    return $valeur === '' ? null : $valeur;
}

/**
 * Nom de personne : 2 à 120 caractères, espaces multiples compactés.
 */
function valider_nom(string $brut, string $libelle = 'nom'): string
{
    $nom = trim(preg_replace('/\s+/u', ' ', $brut) ?? $brut);

    if (mb_strlen($nom) < 2) {
        throw new ValidationError(sprintf('Le %s doit contenir au moins 2 caractères.', $libelle));
    }
    if (mb_strlen($nom) > 120) {
        throw new ValidationError(sprintf('Le %s ne doit pas dépasser 120 caractères.', $libelle));
    }

    return $nom;
}

/**
 * Téléphone béninois : normalisé en « +229 » suivi de 8 à 10 chiffres.
 * Accepte « +229 01 23 45 67 89 », « 0123456789 », « 00229... ».
 * Refuse explicitement les indicatifs d'autres pays (+225 notamment).
 */
function valider_telephone(string $brut, string $libelle = 'numéro de téléphone'): string
{
    $nettoye = preg_replace('/[\s.\-()\/]+/u', '', trim($brut)) ?? '';

    if ($nettoye === '') {
        throw new ValidationError(sprintf('Le %s est obligatoire.', $libelle));
    }

    if (str_starts_with($nettoye, '00')) {
        $nettoye = '+' . substr($nettoye, 2);
    }

    if (str_starts_with($nettoye, '+229')) {
        $local = substr($nettoye, 4);
    } elseif (str_starts_with($nettoye, '229') && strlen($nettoye) > 8) {
        $local = substr($nettoye, 3);
    } elseif (!str_starts_with($nettoye, '+')) {
        $local = $nettoye;
    } else {
        throw new ValidationError(sprintf(
            'Le %s doit être un numéro béninois (+229), pas un indicatif étranger.',
            $libelle
        ));
    }

    if (!preg_match('/^\d{8,10}$/', $local)) {
        throw new ValidationError(sprintf(
            'Le %s est invalide : attendu +229 suivi de 8 à 10 chiffres.',
            $libelle
        ));
    }

    return '+229' . $local;
}

/**
 * Date au format AAAA-MM-JJ (réelle, pas 2026-02-31).
 */
function valider_date(string $brut, string $libelle = 'date'): string
{
    $valeur = trim($brut);
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $valeur);

    if (!$date instanceof DateTimeImmutable || $date->format('Y-m-d') !== $valeur) {
        throw new ValidationError(sprintf('La %s doit être au format AAAA-MM-JJ.', $libelle));
    }

    return $valeur;
}

/**
 * Montant en FCFA : entier, jamais de float.
 * Tolère les séparateurs de milliers français (« 10 000 », « 10.000 »).
 */
function valider_montant($valeur, string $libelle = 'montant', int $min = 0, int $max = 100000000): int
{
    if (is_int($valeur)) {
        $montant = $valeur;
    } elseif (is_float($valeur)) {
        if (floor($valeur) !== $valeur) {
            throw new ValidationError(sprintf('Le %s doit être un nombre entier de FCFA.', $libelle));
        }
        $montant = (int) $valeur;
    } elseif (is_string($valeur)) {
        $nettoye = preg_replace('/[\s.\x{00A0}\']+/u', '', trim($valeur)) ?? '';
        if ($nettoye === '' || !preg_match('/^\d{1,12}$/', $nettoye)) {
            throw new ValidationError(sprintf('Le %s doit être un nombre entier de FCFA.', $libelle));
        }
        $montant = (int) $nettoye;
    } else {
        throw new ValidationError(sprintf('Le %s doit être un nombre entier de FCFA.', $libelle));
    }

    if ($montant < $min || $montant > $max) {
        throw new ValidationError(sprintf(
            'Le %s doit être compris entre %s et %s FCFA.',
            $libelle,
            number_format($min, 0, ',', ' '),
            number_format($max, 0, ',', ' ')
        ));
    }

    return $montant;
}

/**
 * Booléen tolérant : true/false, 1/0, "true"/"false", "oui"/"non".
 */
function valider_booleen($valeur, string $libelle = 'valeur'): bool
{
    if (is_bool($valeur)) {
        return $valeur;
    }
    if (is_int($valeur)) {
        return $valeur !== 0;
    }
    if (is_string($valeur)) {
        $normalise = strtolower(trim($valeur));
        if (in_array($normalise, ['1', 'true', 'oui', 'yes', 'on'], true)) {
            return true;
        }
        if (in_array($normalise, ['0', 'false', 'non', 'no', 'off'], true)) {
            return false;
        }
    }

    throw new ValidationError(sprintf('Le champ « %s » doit être vrai ou faux.', $libelle));
}

/**
 * Valeur appartenant à une liste fermée.
 */
function valider_choix(string $valeur, array $choix, string $libelle = 'valeur'): string
{
    if (!in_array($valeur, $choix, true)) {
        throw new ValidationError(sprintf(
            'Le champ « %s » doit valoir : %s.',
            $libelle,
            implode(', ', $choix)
        ));
    }

    return $valeur;
}

/**
 * Politique de mot de passe : 8 à 72 caractères, au moins une lettre et un chiffre.
 * (72 = limite technique de bcrypt.)
 */
function valider_mot_de_passe(string $brut, string $libelle = 'mot de passe'): string
{
    $motDePasse = trim($brut);

    if (strlen($motDePasse) < 8) {
        throw new ValidationError(sprintf('Le %s doit contenir au moins 8 caractères.', $libelle));
    }
    if (strlen($motDePasse) > 72) {
        throw new ValidationError(sprintf('Le %s ne doit pas dépasser 72 caractères.', $libelle));
    }
    if (!preg_match('/[A-Za-z]/', $motDePasse) || !preg_match('/\d/', $motDePasse)) {
        throw new ValidationError(sprintf(
            'Le %s doit contenir au moins une lettre et un chiffre.',
            $libelle
        ));
    }

    return $motDePasse;
}

/**
 * Mot de passe provisoire lisible (sans caractères ambigus 0/O/1/l/I).
 */
function generer_mot_de_passe(int $longueur = 10): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

    do {
        $motDePasse = '';
        for ($i = 0; $i < $longueur; $i++) {
            $motDePasse .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }
    } while (!preg_match('/[A-Za-z]/', $motDePasse) || !preg_match('/\d/', $motDePasse));

    return $motDePasse;
}
