<#
.SYNOPSIS
    Test d'intégration complet de l'API Tontine M.E.NO.JE.

.DESCRIPTION
    Enchaîne les 27 routes dans l'ordre métier et vérifie chaque code HTTP.
    Le script ÉCRIT en base : il doit tourner sur une base de test fraîche
    (jamais sur la base de production).

.PARAMETER BaseUrl
    Racine de l'API, sans slash final. Défaut : http://127.0.0.1:8099/api

.PARAMETER AdminPhone
    Téléphone de l'administrateur installé par install.php.

.PARAMETER AdminPassword
    Mot de passe de cet administrateur.

.EXAMPLE
    php backend/install.php --schema
    php backend/install.php "Pasteur Emmanuel" "+2290197000001" "Admin2026x"
    powershell -File backend/tests/test-api.ps1
#>
param(
    [string] $BaseUrl = 'http://127.0.0.1:8099/api',
    [string] $AdminPhone = '+2290197000001',
    [string] $AdminPassword = 'Admin2026x'
)

$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')
$script:echecs = 0
$script:verifications = 0

function Check {
    param($label, $res, $attendu)
    $script:verifications++
    if ($res.status -eq $attendu) {
        Write-Host ("[OK]    {0} -> {1}" -f $label, $res.status)
    } else {
        $script:echecs++
        Write-Host ("[ECHEC] {0} -> {1} (attendu {2}) : {3}" -f $label, $res.status, $attendu, $res.body)
    }
}

function Api {
    param($method, $path, $body = $null, $token = $null)
    $params = @{ Uri = "$base$path"; Method = $method; UseBasicParsing = $true; TimeoutSec = 25 }
    if ($token) { $params.Headers = @{ Authorization = "Bearer $token" } }
    if ($null -ne $body) {
        $params.Body = ($body | ConvertTo-Json -Depth 10 -Compress)
        $params.ContentType = 'application/json; charset=utf-8'
    }
    try {
        $r = Invoke-WebRequest @params
        return [pscustomobject]@{ status = [int]$r.StatusCode; body = $r.Content }
    } catch {
        $resp = $_.Exception.Response
        if ($null -eq $resp) { return [pscustomobject]@{ status = 0; body = $_.Exception.Message } }
        $lecteur = New-Object System.IO.StreamReader($resp.GetResponseStream())
        return [pscustomobject]@{ status = [int]$resp.StatusCode; body = $lecteur.ReadToEnd() }
    }
}

function ApiJson {
    param($label, $method, $path, $body = $null, $token = $null, $attendu = 200)
    $r = Api $method $path $body $token
    Check $label $r $attendu
    if ($r.status -ne $attendu) { return $null }
    return ($r.body | ConvertFrom-Json)
}

Write-Host "Cible : $base" -ForegroundColor Cyan
Write-Host ''

# ---------------------------------------------------------------- ping / auth
ApiJson 'GET /ping' GET '/ping' | Out-Null

$admin = (ApiJson 'login admin' POST '/login' @{ telephone = $AdminPhone; password = $AdminPassword }).token
if (-not $admin) {
    Write-Host ''
    Write-Host 'Impossible de continuer : connexion administrateur refusée.' -ForegroundColor Red
    Write-Host 'Vérifier AdminPhone / AdminPassword, et que la base est celle de test.' -ForegroundColor Red
    exit 1
}

ApiJson 'login mauvais mot de passe' POST '/login' @{ telephone = $AdminPhone; password = 'faux' } $null 401 | Out-Null
ApiJson 'login telephone +225 refuse' POST '/login' @{ telephone = '+2250700000001'; password = 'x' } $null 422 | Out-Null
ApiJson 'GET /me admin' GET '/me' $null $admin | Out-Null

# ---------------------------------------------------------------- membres
ApiJson 'GET /members' GET '/members' $null $admin | Out-Null
$m1 = ApiJson 'POST /members 1' POST '/members' @{ nom = 'Jean-Baptiste Kouame'; telephone = '+229 01 11 22 33' } $admin 201
$m2 = ApiJson 'POST /members 2' POST '/members' @{ nom = 'Marie-Grace Adanlete'; telephone = '0197 44 55 66' } $admin 201
$m3 = ApiJson 'POST /members 3' POST '/members' @{ nom = 'Samuel Dossou'; telephone = '+2290197778899'; motDePasse = 'Provisoire2026' } $admin 201
Write-Host ("        membres crees : {0} / {1} / {2}" -f $m1.member.id, $m2.member.id, $m3.member.id)
Write-Host ("        mdp provisoires : {0} / {1}" -f $m1.motDePasseProvisoire, $m2.motDePasseProvisoire)
ApiJson 'POST /members doublon telephone' POST '/members' @{ nom = 'Doublon'; telephone = '+22901112233' } $admin 409 | Out-Null
ApiJson 'PATCH admin desactivation refusee' PATCH '/members/1/active' @{ actif = $false } $admin 409 | Out-Null
ApiJson 'PUT /members/2' PUT '/members/2' @{ nom = 'Jean-Baptiste Kouame'; telephone = '+22901112233' } $admin | Out-Null

# ---------------------------------------------------------------- sessions
ApiJson 'GET /sessions vide' GET '/sessions' $null $admin | Out-Null
ApiJson 'POST /sessions jour non dimanche' POST '/sessions' @{ date = '2026-11-09' } $admin 422 | Out-Null
$s1 = ApiJson 'POST /sessions dimanche' POST '/sessions' @{ date = '2026-11-08' } $admin 201
$sid = $s1.session.id
ApiJson 'POST /sessions 2e ouverte refusee' POST '/sessions' @{ date = '2026-11-15' } $admin 409 | Out-Null

ApiJson 'PUT versement 7000 (creation)' PUT "/sessions/$sid/versements" @{ userId = 2; montant = 7000 } $admin | Out-Null
$upsert = ApiJson 'PUT versement 5000 (mise a jour)' PUT "/sessions/$sid/versements" @{ userId = 2; montant = 5000 } $admin
if ($upsert.total -ne 5000) { $script:echecs++; Write-Host ("[ECHEC] total apres upsert = {0} (attendu 5000)" -f $upsert.total) } else { Write-Host '[OK]    total apres upsert = 5000' }
ApiJson 'PUT versement membre 3' PUT "/sessions/$sid/versements" @{ userId = 3; montant = 2000 } $admin | Out-Null
ApiJson 'PUT versement membre inexistant' PUT "/sessions/$sid/versements" @{ userId = 999; montant = 1000 } $admin 404 | Out-Null
ApiJson 'PUT versement montant negatif' PUT "/sessions/$sid/versements" @{ userId = 2; montant = -5 } $admin 422 | Out-Null

$detail = ApiJson 'GET /sessions/:id' GET "/sessions/$sid" $null $admin
if ($detail.total -ne 7000) { $script:echecs++; Write-Host ("[ECHEC] total session = {0} (attendu 7000)" -f $detail.total) } else { Write-Host '[OK]    total session = 7000' }

$fermeture = ApiJson 'POST close' POST "/sessions/$sid/close" @{} $admin
if ($fermeture.versementsCrees -ne 1) { $script:echecs++; Write-Host ("[ECHEC] versements a 0 crees = {0} (attendu 1)" -f $fermeture.versementsCrees) } else { Write-Host '[OK]    1 versement a 0 cree' }
ApiJson 'PUT versement session fermee' PUT "/sessions/$sid/versements" @{ userId = 2; montant = 9000 } $admin 409 | Out-Null
$detail2 = ApiJson 'GET /sessions/:id apres fermeture' GET "/sessions/$sid" $null $admin
if ($detail2.versements.Count -ne 3) { $script:echecs++; Write-Host ("[ECHEC] versements = {0} (attendu 3)" -f $detail2.versements.Count) } else { Write-Host '[OK]    3 versements apres fermeture' }
ApiJson 'POST close deja fermee' POST "/sessions/$sid/close" @{} $admin 409 | Out-Null

# ---------------------------------------------------------------- classement / membre
$cl = ApiJson 'GET /classement admin' GET '/classement' $null $admin
$ligne2 = $cl.classement | Where-Object { $_.userId -eq 2 }
Write-Host ("        classement membre 2 : points={0} serie={1} dimanches={2}" -f $ligne2.points, $ligne2.serieEnCours, $ligne2.nombreDimanches)
# 10 (1 dimanche) + 15 (serie de 1) + 15 (PREMIER_PAS) + 180 (REGULARITE_OR) = 220
if ($ligne2.points -ne 220) { $script:echecs++; Write-Host ("[ECHEC] points = {0} (attendu 220)" -f $ligne2.points) } else { Write-Host '[OK]    points = 220' }

$login2 = ApiJson 'login membre provisoire' POST '/login' @{ telephone = '+22901112233'; password = $m1.motDePasseProvisoire }
$t2 = $login2.token
if ($login2.user.mustChangePassword -ne $true) { $script:echecs++; Write-Host '[ECHEC] mustChangePassword attendu true' } else { Write-Host '[OK]    mustChangePassword = true' }

$releve = ApiJson 'GET /me/releve' GET '/me/releve' $null $t2
Write-Host ("        releve : verse={0} retraits={1} solde={2} retenue={3} net={4}" -f $releve.totaux.totalVerse, $releve.totaux.totalRetire, $releve.totaux.soldeActuel, $releve.totaux.partEglise, $releve.totaux.montantNetPrevisionnel)
if ($releve.totaux.totalVerse -ne 5000 -or $releve.totaux.partEglise -ne 150 -or $releve.totaux.montantNetPrevisionnel -ne 4850) {
    $script:echecs++; Write-Host '[ECHEC] calculs de releve incorrects'
} else { Write-Host '[OK]    calculs de releve corrects' }

ApiJson 'membre interdit GET /members' GET '/members' $null $t2 403 | Out-Null
ApiJson 'membre interdit POST /sessions' POST '/sessions' @{ date = '2026-11-22' } $t2 403 | Out-Null
ApiJson 'membre interdit export' GET '/export/backup' $null $t2 403 | Out-Null

# ---------------------------------------------------------------- retraits
$retraitCree = ApiJson 'POST /retraits 3000' POST '/retraits' @{ userId = 2; montant = 3000; motif = 'Urgence familiale' } $admin 201
ApiJson 'POST /retraits solde insuffisant' POST '/retraits' @{ userId = 2; montant = 9000; motif = 'Trop' } $admin 422 | Out-Null
$listeRetraits = ApiJson 'GET /retraits' GET '/retraits' $null $admin
if ($listeRetraits.total -ne 3000) { $script:echecs++; Write-Host '[ECHEC] total retraits attendu 3000' } else { Write-Host '[OK]    total retraits = 3000' }

$releve2 = ApiJson 'GET /me/releve apres retrait' GET '/me/releve' $null $t2
if ($releve2.totaux.soldeActuel -ne 2000) { $script:echecs++; Write-Host ("[ECHEC] solde apres retrait = {0} (attendu 2000)" -f $releve2.totaux.soldeActuel) } else { Write-Host '[OK]    solde apres retrait = 2000' }

ApiJson 'DELETE /retraits inexistant' DELETE '/retraits/99999' $null $admin 404 | Out-Null
ApiJson 'DELETE /retraits' DELETE ("/retraits/{0}" -f $retraitCree.retrait.id) $null $admin | Out-Null
$listeApres = ApiJson 'GET /retraits apres suppression' GET '/retraits' $null $admin
if ($listeApres.total -ne 0) { $script:echecs++; Write-Host ("[ECHEC] total retraits apres suppression = {0} (attendu 0)" -f $listeApres.total) } else { Write-Host '[OK]    total retraits apres suppression = 0' }
$releve3 = ApiJson 'GET /me/releve apres suppression' GET '/me/releve' $null $t2
if ($releve3.totaux.soldeActuel -ne 5000) { $script:echecs++; Write-Host ("[ECHEC] solde apres suppression = {0} (attendu 5000)" -f $releve3.totaux.soldeActuel) } else { Write-Host '[OK]    solde apres suppression = 5000' }

# ---------------------------------------------------------------- mot de passe
ApiJson 'change-password ancien faux' POST '/change-password' @{ ancien = 'faux'; nouveau = 'Nouveau2026' } $t2 422 | Out-Null
ApiJson 'change-password trop court' POST '/change-password' @{ ancien = $m1.motDePasseProvisoire; nouveau = 'abc' } $t2 422 | Out-Null
$t2second = (ApiJson 'login membre (2e session)' POST '/login' @{ telephone = '+22901112233'; password = $m1.motDePasseProvisoire }).token
ApiJson 'change-password OK' POST '/change-password' @{ ancien = $m1.motDePasseProvisoire; nouveau = 'Nouveau2026' } $t2 | Out-Null
ApiJson 'login ancien mot de passe refuse' POST '/login' @{ telephone = '+22901112233'; password = $m1.motDePasseProvisoire } $null 401 | Out-Null
$relogin = ApiJson 'login nouveau mot de passe' POST '/login' @{ telephone = '+22901112233'; password = 'Nouveau2026' }
$t2b = $relogin.token
ApiJson 'autre session revoquee' GET '/me' $null $t2second 401 | Out-Null
ApiJson 'session courante conservee' GET '/me' $null $t2 | Out-Null

# ---------------------------------------------------------------- reglages / annonces
ApiJson 'GET /reglages membre' GET '/reglages' $null $t2b | Out-Null
ApiJson 'PUT /reglages membre interdit' PUT '/reglages' @{ tauxRetenue = 5 } $t2b 403 | Out-Null
$reg = ApiJson 'PUT /reglages admin' PUT '/reglages' @{ tauxRetenue = 4; nomEglise = 'M.E.NO.JE' } $admin
if ($reg.reglages.tauxRetenue -ne 4) { $script:echecs++; Write-Host '[ECHEC] taux attendu 4' } else { Write-Host '[OK]    taux de retenue = 4' }
ApiJson 'PUT /reglages taux invalide' PUT '/reglages' @{ tauxRetenue = 150 } $admin 422 | Out-Null

$ann = ApiJson 'POST /annonces' POST '/annonces' @{ titre = 'Assemblee generale'; contenu = 'Dimanche prochain apres le culte.' } $admin 201
ApiJson 'GET /annonces membre' GET '/annonces' $null $t2b | Out-Null
ApiJson 'DELETE /annonces membre interdit' DELETE "/annonces/$($ann.annonce.id)" $null $t2b 403 | Out-Null
ApiJson 'DELETE /annonces admin' DELETE "/annonces/$($ann.annonce.id)" $null $admin | Out-Null

# ---------------------------------------------------------------- export
$backup = ApiJson 'GET /export/backup' GET '/export/backup' $null $admin
if ($backup.app -ne 'tontine-menoje' -or $backup.data.users.Count -lt 4) { $script:echecs++; Write-Host '[ECHEC] contenu sauvegarde' } else { Write-Host ("[OK]    sauvegarde : {0} users, {1} versements" -f $backup.data.users.Count, $backup.data.versements.Count) }
$csv = Api GET '/export/csv' $null $admin
Check 'GET /export/csv' $csv 200
if ($csv.body -notmatch 'Date;Type;Membre;T') { $script:echecs++; Write-Host '[ECHEC] entete CSV' } else { Write-Host '[OK]    entete CSV present' }

# ---------------------------------------------------------------- reouverture
ApiJson 'POST reopen' POST "/sessions/$sid/reopen" @{} $admin | Out-Null
ApiJson 'PUT versement apres reouverture' PUT "/sessions/$sid/versements" @{ userId = 4; montant = 1500 } $admin | Out-Null
ApiJson 'POST close apres reouverture' POST "/sessions/$sid/close" @{} $admin | Out-Null

# ---------------------------------------------------------------- blocage
$tel = '+2290197778899'
1..5 | ForEach-Object { Api POST '/login' @{ telephone = $tel; password = 'mauvais' } | Out-Null }
ApiJson 'blocage apres 5 echecs' POST '/login' @{ telephone = $tel; password = 'Provisoire2026' } $null 429 | Out-Null

# ---------------------------------------------------------------- logout
ApiJson 'logout' POST '/logout' @{} $t2b | Out-Null
ApiJson 'jeton revoque' GET '/me' $null $t2b 401 | Out-Null

Write-Host ''
if ($script:echecs -eq 0) {
    Write-Host ("SUCCES : {0} verifications, 0 echec." -f $script:verifications) -ForegroundColor Green
    exit 0
}

Write-Host ("RESULTAT : {0} echec(s) sur {1} verifications." -f $script:echecs, $script:verifications) -ForegroundColor Red
exit 1
