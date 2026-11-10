<?php
/**
 * Installation : crée le compte administrateur initial.
 *
 * À SUPPRIMER du serveur après usage.
 *
 * Ligne de commande (recommandé) :
 *   php install.php "Pasteur Emmanuel" "+2290197000001" "MotDePasse2026"
 *   php install.php --schema          # importe schema.sql
 *
 * Navigateur : POST du formulaire, protégé par `app.install_key` défini dans
 * la configuration. Refuse dès qu'un administrateur existe déjà.
 */
declare(strict_types=1);

define('TONTINE_APP', true);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/validate.php';
require __DIR__ . '/lib/auth.php';

$cli = PHP_SAPI === 'cli';

/**
 * Importe schema.sql (DDL) en découpant sur les points-virgules.
 */
function importer_schema(PDO $pdo): int
{
    $contenu = file_get_contents(__DIR__ . '/schema.sql');
    if ($contenu === false) {
        throw new RuntimeException('Fichier schema.sql introuvable.');
    }

    $lignes = preg_split('/\R/', $contenu) ?: [];
    $propre = '';
    foreach ($lignes as $ligne) {
        if (preg_match('/^\s*--/', $ligne) === 1) {
            continue;
        }
        $propre .= $ligne . "\n";
    }

    $requetes = array_values(array_filter(
        array_map('trim', explode(';', $propre)),
        static fn (string $requete): bool => $requete !== ''
    ));

    foreach ($requetes as $requete) {
        $pdo->exec($requete);
    }

    return count($requetes);
}

function admin_existant(): bool
{
    return (int) sql_value("SELECT COUNT(*) FROM users WHERE role = 'admin'") > 0;
}

/**
 * Crée l'administrateur. Retourne son identifiant.
 */
function creer_admin(string $nom, string $telephone, string $motDePasse): int
{
    if (admin_existant()) {
        throw new RuntimeException('Un administrateur existe déjà. Supprimez install.php.');
    }

    $telephone = valider_telephone($telephone, 'téléphone de l’administrateur');
    $nom = valider_nom($nom, 'nom de l’administrateur');
    $motDePasse = valider_mot_de_passe($motDePasse, 'mot de passe');

    $conflit = sql_value('SELECT id FROM users WHERE telephone = :telephone', ['telephone' => $telephone]);
    if ($conflit !== null) {
        throw new RuntimeException('Ce numéro de téléphone est déjà utilisé.');
    }

    sql_exec(
        'INSERT INTO users (nom, telephone, password_hash, role, actif, must_change_password)
         VALUES (:nom, :telephone, :hash, \'admin\', 1, 1)',
        [
            'nom'       => $nom,
            'telephone' => $telephone,
            'hash'      => password_hash($motDePasse, PASSWORD_BCRYPT),
        ]
    );

    $id = (int) db()->lastInsertId();

    // Réglages par défaut si schema.sql n'a pas été importé avec les INSERT.
    foreach ([
        'taux_retenue'                 => '3',
        'nom_eglise'                   => 'M.E.NO.JE',
        'devise'                       => 'FCFA',
        'afficher_montants_classement' => '1',
    ] as $cle => $valeur) {
        sql_exec(
            'INSERT IGNORE INTO reglages (cle, valeur) VALUES (:cle, :valeur)',
            ['cle' => $cle, 'valeur' => $valeur]
        );
    }

    journaliser($id, 'install', 'Création du compte administrateur initial');

    return $id;
}

// --------------------------------------------------------------------------
// Mode ligne de commande
// --------------------------------------------------------------------------
if ($cli) {
    $schemaSeul = in_array('--schema', $argv, true) && count($argv) === 2;

    if (in_array('--schema', $argv, true)) {
        try {
            $nombre = importer_schema(db());
            fwrite(STDOUT, sprintf("Schema importe : %d requetes executees.\n", $nombre));
        } catch (Throwable $erreur) {
            fwrite(STDERR, "Echec de l'import du schema : " . $erreur->getMessage() . "\n");
            exit(1);
        }
    }

    if ($schemaSeul) {
        exit(0);
    }

    $nom = $argv[1] ?? '';
    $telephone = $argv[2] ?? '';
    $motDePasse = $argv[3] ?? '';

    if ($nom === '' || $telephone === '' || $motDePasse === '') {
        fwrite(STDERR, "Usage : php install.php \"Nom Admin\" \"+2290197000001\" \"MotDePasse2026\"\n");
        fwrite(STDERR, "        php install.php --schema\n");
        exit(1);
    }

    try {
        $id = creer_admin($nom, $telephone, $motDePasse);
        fwrite(STDOUT, sprintf("Administrateur cree (id %d).\n", $id));
        fwrite(STDOUT, "IMPORTANT : supprimez install.php du serveur maintenant.\n");
        exit(0);
    } catch (Throwable $erreur) {
        fwrite(STDERR, 'Echec : ' . $erreur->getMessage() . "\n");
        exit(1);
    }
}

// --------------------------------------------------------------------------
// Mode navigateur
// --------------------------------------------------------------------------
header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

function page_install(string $titre, string $contenu, int $code = 200): void
{
    http_response_code($code);
    $titreHtml = htmlspecialchars($titre, ENT_QUOTES, 'UTF-8');

    $page = <<<HTML
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{$titreHtml} — Tontine M.E.NO.JE</title>
<style>
  body{margin:0;padding:2rem 1rem;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f6f7fb;color:#14213d}
  main{max-width:32rem;margin:0 auto;background:#fff;border:1px solid #e2e6ef;border-radius:16px;padding:1.75rem;box-shadow:0 10px 30px rgba(20,33,61,.08)}
  h1{font-size:1.3rem;margin:0 0 1rem}
  label{display:block;font-weight:600;margin:1rem 0 .35rem;font-size:.9rem}
  input{width:100%;box-sizing:border-box;padding:.7rem .8rem;border:1px solid #cbd3e1;border-radius:10px;font-size:1rem}
  button{margin-top:1.4rem;width:100%;padding:.85rem;border:0;border-radius:10px;background:#14213d;color:#fff;font-size:1rem;font-weight:600;cursor:pointer}
  .msg{padding:.85rem 1rem;border-radius:10px;margin:0 0 1rem;font-size:.92rem}
  .ok{background:#e7f7ef;color:#166b4a;border:1px solid #b7e6cf}
  .ko{background:#fdeaea;color:#9b2c2c;border:1px solid #f5c2c2}
  .warn{background:#fff6e0;color:#7a5300;border:1px solid #f0dca6}
  code{background:#eef1f7;padding:.1rem .35rem;border-radius:5px}
  p{line-height:1.5}
</style>
</head>
<body>
<main>
<h1>{$titreHtml}</h1>
{$contenu}
</main>
</body>
</html>
HTML;

    echo $page;
    exit;
}

$cleAttendue = (string) (config('app.install_key') ?? '');

if ($cleAttendue === '') {
    $contenu = <<<HTML
<div class="msg ko">Aucune clé d’installation n’est configurée.</div>
<p>Ajoutez <code>'install_key' =&gt; 'une-phrase-secrète'</code> dans la section <code>app</code> de votre configuration, puis rechargez cette page. Sinon, utilisez la ligne de commande :</p>
<p><code>php install.php "Nom Admin" "+2290197000001" "MotDePasse2026"</code></p>
HTML;
    page_install('Installation bloquée', $contenu, 403);
}

if (admin_existant()) {
    $contenu = <<<HTML
<div class="msg warn">Un administrateur existe déjà.</div>
<p>Pour des raisons de sécurité, cette page ne peut plus créer de compte.</p>
<p><strong>Supprimez <code>install.php</code> du serveur maintenant.</strong></p>
HTML;
    page_install('Installation déjà effectuée', $contenu, 409);
}

$erreur = '';
$succes = '';
$nom = '';
$telephone = '';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $nom = trim((string) ($_POST['nom'] ?? ''));
    $telephone = trim((string) ($_POST['telephone'] ?? ''));
    $motDePasse = (string) ($_POST['motDePasse'] ?? '');
    $confirmation = (string) ($_POST['confirmation'] ?? '');
    $cle = (string) ($_POST['install_key'] ?? '');

    try {
        if (!hash_equals($cleAttendue, $cle)) {
            throw new RuntimeException('Clé d’installation incorrecte.');
        }
        if ($motDePasse !== $confirmation) {
            throw new RuntimeException('Les deux mots de passe ne correspondent pas.');
        }

        $id = creer_admin($nom, $telephone, $motDePasse);
        $succes = sprintf('Administrateur créé (identifiant %d).', $id);
    } catch (Throwable $erreurInstallation) {
        $erreur = $erreurInstallation->getMessage();
    }
}

if ($succes !== '') {
    $telephoneHtml = htmlspecialchars($telephone, ENT_QUOTES, 'UTF-8');
    $contenu = <<<HTML
<div class="msg ok">{$succes}</div>
<p>Connectez-vous avec le numéro <strong>{$telephoneHtml}</strong> et le mot de passe choisi. Le changement de mot de passe sera demandé à la première connexion.</p>
<div class="msg warn"><strong>Supprimez <code>install.php</code> du serveur immédiatement.</strong></div>
<p><a href="ping">Tester <code>/api/ping</code></a></p>
HTML;
    page_install('Installation terminée', $contenu);
}

$erreurHtml = $erreur === ''
    ? ''
    : '<div class="msg ko">' . htmlspecialchars($erreur, ENT_QUOTES, 'UTF-8') . '</div>';

$nomHtml = htmlspecialchars($nom, ENT_QUOTES, 'UTF-8');
$telephoneHtml = htmlspecialchars($telephone, ENT_QUOTES, 'UTF-8');

$contenu = <<<HTML
{$erreurHtml}
<p>Créez l’unique compte administrateur. Aucune inscription publique n’existe : l’admin créera ensuite les membres depuis l’application.</p>
<form method="post" action="">
  <label for="install_key">Clé d’installation</label>
  <input id="install_key" name="install_key" type="password" required autocomplete="off">
  <label for="nom">Nom complet</label>
  <input id="nom" name="nom" type="text" required value="{$nomHtml}" autocomplete="name">
  <label for="telephone">Téléphone (Bénin, +229)</label>
  <input id="telephone" name="telephone" type="tel" required value="{$telephoneHtml}" placeholder="+229 01 97 00 00 01" autocomplete="tel">
  <label for="motDePasse">Mot de passe (8 caractères minimum, lettres et chiffres)</label>
  <input id="motDePasse" name="motDePasse" type="password" required minlength="8" autocomplete="new-password">
  <label for="confirmation">Confirmer le mot de passe</label>
  <input id="confirmation" name="confirmation" type="password" required minlength="8" autocomplete="new-password">
  <button type="submit">Créer l’administrateur</button>
</form>
HTML;

page_install('Installer la tontine', $contenu);
