import React, { useState } from 'react';
import { Database, Code2, Server, FolderTree, Copy, Check, ExternalLink, X } from 'lucide-react';

interface TechGuideModalProps {
  onClose: () => void;
}

export const TechGuideModal: React.FC<TechGuideModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'sql' | 'arbo' | 'php' | 'infinityfree'>('sql');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyCode = (key: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const sqlSchema = `-- ========================================================
-- BASE DE DONNÉES TONTINE ÉGLISE M.E.NO.JE 2026
-- Compatible 100% MySQL phpMyAdmin / InfinityFree
-- ========================================================

CREATE TABLE IF NOT EXISTS \`sessions_tontine\` (
    \`id\` INT AUTO_INCREMENT PRIMARY KEY,
    \`libelle\` VARCHAR(100) NOT NULL,
    \`annee\` INT NOT NULL UNIQUE,
    \`date_debut\` DATE NOT NULL,
    \`date_fin\` DATE NOT NULL,
    \`taux_retenue\` DECIMAL(5, 2) NOT NULL DEFAULT 3.00 COMMENT '3% retenue par l\\'église',
    \`statut\` ENUM('en_cours', 'cloturee') NOT NULL DEFAULT 'en_cours',
    \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` INT AUTO_INCREMENT PRIMARY KEY,
    \`nom_complet\` VARCHAR(150) NOT NULL,
    \`telephone\` VARCHAR(30) NOT NULL UNIQUE,
    \`password_hash\` VARCHAR(255) NOT NULL,
    \`role\` ENUM('admin', 'membre') NOT NULL DEFAULT 'membre',
    \`statut\` ENUM('actif', 'inactif') NOT NULL DEFAULT 'actif',
    \`must_change_password\` TINYINT(1) NOT NULL DEFAULT 1,
    \`whatsapp_disponible\` TINYINT(1) NOT NULL DEFAULT 1,
    \`notes_admin\` TEXT NULL,
    \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX \`idx_telephone\` (\`telephone\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`versements\` (
    \`id\` INT AUTO_INCREMENT PRIMARY KEY,
    \`session_id\` INT NOT NULL,
    \`user_id\` INT NOT NULL,
    \`date_dimanche\` DATE NOT NULL,
    \`montant\` DECIMAL(12, 2) NOT NULL,
    \`mode_reglement\` ENUM('especes', 'mobile_money', 'virement', 'autre') NOT NULL DEFAULT 'especes',
    \`commentaire\` VARCHAR(255) NULL,
    \`enregistre_par\` INT NOT NULL,
    \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (\`session_id\`) REFERENCES \`sessions_tontine\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT,
    FOREIGN KEY (\`enregistre_par\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT,
    INDEX \`idx_session_date\` (\`session_id\`, \`date_dimanche\`),
    INDEX \`idx_user_session\` (\`user_id\`, \`session_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NOUVELLE TABLE : Retraits partiels en cours d'année
CREATE TABLE IF NOT EXISTS \`retraits\` (
    \`id\` INT AUTO_INCREMENT PRIMARY KEY,
    \`session_id\` INT NOT NULL,
    \`user_id\` INT NOT NULL,
    \`date_retrait\` DATE NOT NULL,
    \`montant\` DECIMAL(12, 2) NOT NULL,
    \`motif\` VARCHAR(255) NULL,
    \`enregistre_par\` INT NOT NULL,
    \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (\`session_id\`) REFERENCES \`sessions_tontine\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT,
    FOREIGN KEY (\`enregistre_par\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT,
    INDEX \`idx_user_retraits\` (\`user_id\`, \`session_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`annonces\` (
    \`id\` INT AUTO_INCREMENT PRIMARY KEY,
    \`titre\` VARCHAR(200) NOT NULL,
    \`contenu\` TEXT NOT NULL,
    \`priorite\` ENUM('normale', 'importante', 'urgente') NOT NULL DEFAULT 'normale',
    \`publie_par\` INT NOT NULL,
    \`date_publication\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (\`publie_par\`) REFERENCES \`users\`(\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`parametres\` (
    \`cle\` VARCHAR(50) PRIMARY KEY,
    \`valeur\` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

  const phpVersementsApi = `<?php
// backend-php/api/versements.php & retraits.php
require_once '../config/database.php';
\$db = (new Database())->getConnection();
\$method = \$_SERVER['REQUEST_METHOD'];
\$input = json_decode(file_get_contents('php://input'), true);

if (\$method === 'GET') {
    \$userId = isset(\$_GET['user_id']) ? intval(\$_GET['user_id']) : null;
    
    // Récupère à la fois les versements et les retraits du membre
    if (\$userId) {
        \$vStmt = \$db->prepare("SELECT * FROM versements WHERE user_id = :uid ORDER BY date_dimanche DESC");
        \$vStmt->execute([':uid' => \$userId]);
        \$versements = \$vStmt->fetchAll();

        \$rStmt = \$db->prepare("SELECT * FROM retraits WHERE user_id = :uid ORDER BY date_retrait DESC");
        \$rStmt->execute([':uid' => \$userId]);
        \$retraits = \$rStmt->fetchAll();

        echo json_encode(["versements" => \$versements, "retraits" => \$retraits]);
        exit();
    }
}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="my-4 w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900 text-white shadow-2xl animate-slide-up">
        <div className="relative flex items-center justify-between overflow-hidden border-b border-slate-800 px-6 py-5">
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold tracking-tight sm:text-lg">Guide développeur & schéma SQL</h3>
              <p className="text-[11px] text-slate-400">Architecture complète avec versements et retraits partiels</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="relative p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-amber-500/10 blur-2xl" />
        </div>

        <div className="hide-scrollbar flex items-center gap-1.5 px-4 py-3 border-b border-slate-800 overflow-x-auto text-[11px] font-bold">
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer flex shrink-0 items-center gap-2 ${
              activeTab === 'sql' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            1. Script SQL
          </button>
          <button
            onClick={() => setActiveTab('arbo')}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer flex shrink-0 items-center gap-2 ${
              activeTab === 'arbo' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            2. Arborescence
          </button>
          <button
            onClick={() => setActiveTab('php')}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer flex shrink-0 items-center gap-2 ${
              activeTab === 'php' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Server className="w-4 h-4" />
            3. Code PHP (PDO)
          </button>
          <button
            onClick={() => setActiveTab('infinityfree')}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer flex shrink-0 items-center gap-2 ${
              activeTab === 'infinityfree' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            4. InfinityFree
          </button>
        </div>

        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-300">
                  Schéma incluant la table <strong>retraits</strong> :
                </p>
                <button
                  onClick={() => copyCode('sql', sqlSchema)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {copiedKey === 'sql' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'sql' ? 'Copié !' : 'Copier le SQL'}
                </button>
              </div>
              <pre className="bg-slate-950 p-4 rounded-2xl text-[11px] font-mono text-emerald-400 border border-slate-800 overflow-x-auto leading-relaxed">
                {sqlSchema}
              </pre>
            </div>
          )}

          {activeTab === 'arbo' && (
            <div className="space-y-4 text-xs">
              <pre className="bg-slate-950 p-4 rounded-2xl text-xs font-mono text-amber-300 border border-slate-800 overflow-x-auto leading-relaxed">
{`htdocs/                  <-- Racine web sur InfinityFree
├── index.html           <-- Fichier issu du "npm run build" de React
├── assets/              <-- CSS et JS compilés
├── manifest.webmanifest <-- PWA installable sur smartphone
│
└── api/                 <-- Votre API REST PHP
    ├── config/
    │   └── database.php  (Connexion PDO avec requêtes préparées)
    ├── controllers/
    │   ├── AuthController.php       (Connexion téléphone + mot de passe)
    │   ├── VersementsController.php (Saisie rapide des dimanches)
    │   ├── RetraitsController.php   (Gestion des retraits en cours d'année)
    │   ├── MembresController.php    (Gestion des 50 comptes)
    │   ├── AnnoncesController.php   (Fil d'actualité)
    │   └── IAController.php         (Proxy Gemini & Quota journalier)
    ├── .htaccess        (Gestion CORS & URL rewriting)
    └── index.php        (Routeur principal)`}
              </pre>
            </div>
          )}

          {activeTab === 'php' && (
            <div className="space-y-4">
              <pre className="bg-slate-950 p-3 rounded-xl text-[11px] font-mono text-amber-200 border border-slate-800 overflow-x-auto">
                {phpVersementsApi}
              </pre>
            </div>
          )}

          {activeTab === 'infinityfree' && (
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <p>
                1. Créez la base MySQL dans le cPanel InfinityFree &gt; <em>MySQL Databases</em>.<br />
                2. Importez le script SQL dans phpMyAdmin.<br />
                3. Compilez React avec <code>npm run build</code> et déposez <code>dist/*</code> dans <code>htdocs/</code> via FileZilla.<br />
                4. Déposez l'API PHP dans <code>htdocs/api/</code>.<br />
                5. Sur smartphone, ouvrez le site et choisissez « Ajouter à l'écran d'accueil » (PWA).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
