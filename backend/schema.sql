-- ---------------------------------------------------------------------------
-- Tontine M.E.NO.JE — schéma MySQL (InfinityFree : MariaDB 10.x)
-- Encodage utf8mb4, moteur InnoDB, montants en entiers (FCFA).
-- Importer ce fichier dans phpMyAdmin (onglet « Importer ») avant install.php.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Utilisateurs : un seul admin, les autres sont des membres.
-- Aucune inscription publique : l'admin crée les comptes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nom                   VARCHAR(120) NOT NULL,
  telephone             VARCHAR(20)  NOT NULL,
  password_hash         VARCHAR(255) NOT NULL,
  role                  ENUM('admin','membre') NOT NULL DEFAULT 'membre',
  actif                 TINYINT(1)   NOT NULL DEFAULT 1,
  must_change_password  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_telephone (telephone),
  KEY idx_users_role_actif (role, actif)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Sessions du dimanche : une seule peut être ouverte à la fois
-- (garanti côté PHP par une transaction, plus une contrainte applicative).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions_dimanche (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  date       DATE         NOT NULL,
  statut     ENUM('ouverte','fermee') NOT NULL DEFAULT 'ouverte',
  opened_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at  DATETIME     NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_date (date),
  KEY idx_sessions_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Versements : un seul par membre et par session (UNIQUE).
-- montant = 0 => membre absent à la session (créé automatiquement à la
-- fermeture, règle métier n° 3).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS versements (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id     INT UNSIGNED NOT NULL,
  user_id        INT UNSIGNED NOT NULL,
  montant        INT UNSIGNED NOT NULL DEFAULT 0,
  enregistre_par INT UNSIGNED NULL DEFAULT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_versements_session_user (session_id, user_id),
  KEY idx_versements_user (user_id),
  CONSTRAINT fk_versements_session FOREIGN KEY (session_id) REFERENCES sessions_dimanche (id) ON DELETE CASCADE,
  CONSTRAINT fk_versements_user    FOREIGN KEY (user_id)    REFERENCES users (id)             ON DELETE CASCADE,
  CONSTRAINT fk_versements_auteur  FOREIGN KEY (enregistre_par) REFERENCES users (id)         ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Retraits partiels (admin uniquement).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS retraits (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,
  montant        INT UNSIGNED NOT NULL,
  motif          VARCHAR(255) NOT NULL,
  date           DATE         NOT NULL,
  enregistre_par INT UNSIGNED NULL DEFAULT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_retraits_user (user_id),
  KEY idx_retraits_date (date),
  CONSTRAINT fk_retraits_user   FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_retraits_auteur FOREIGN KEY (enregistre_par) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Annonces publiées par l'admin.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS annonces (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  titre      VARCHAR(150) NOT NULL,
  contenu    TEXT         NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_annonces_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Réglages clé/valeur (taux_retenue, nom_eglise, devise, ...).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reglages (
  cle    VARCHAR(64)  NOT NULL,
  valeur VARCHAR(255) NOT NULL,
  PRIMARY KEY (cle)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Jetons d'authentification : le jeton clair n'est JAMAIS stocké,
-- seulement son empreinte SHA-256.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_tokens (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64)     NOT NULL,
  expires_at DATETIME     NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_tokens_hash (token_hash),
  KEY idx_auth_tokens_user (user_id),
  KEY idx_auth_tokens_expires (expires_at),
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Journal d'audit (réouverture de session, réinitialisation de mot de passe…).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NULL DEFAULT NULL,
  action     VARCHAR(64)  NOT NULL,
  detail     TEXT         NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_created (created_at),
  KEY idx_audit_user (user_id),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Tentatives de connexion (limitation de la force brute).
-- Table ajoutée au schéma minimal : exigée par la règle de sécurité
-- « blocage temporaire après N échecs ».
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  telephone  VARCHAR(20)  NOT NULL,
  ip         VARCHAR(45)  NOT NULL DEFAULT '',
  success    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_login_telephone_date (telephone, created_at),
  KEY idx_login_ip_date (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Réglages par défaut (l'admin peut les modifier via PUT /api/reglages).
INSERT INTO reglages (cle, valeur) VALUES
  ('taux_retenue', '3'),
  ('nom_eglise', 'M.E.NO.JE'),
  ('devise', 'FCFA'),
  ('afficher_montants_classement', '1')
ON DUPLICATE KEY UPDATE valeur = valeur;
