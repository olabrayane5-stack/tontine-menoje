export type Role = 'admin' | 'membre';
export type StatutMembre = 'actif' | 'inactif';
export type ModePaiement = 'especes' | 'mobile_money' | 'virement' | 'autre';
export type PrioriteAnnonce = 'normale' | 'importante' | 'urgente';

export interface User {
  id: number;
  nom_complet: string;
  telephone: string;
  password?: string; // Pour l'authentification
  password_hash?: string;
  role: Role;
  statut: StatutMembre;
  must_change_password: boolean;
  whatsapp_disponible: boolean; // false si personne sans smartphone
  notes_admin?: string;
  created_at: string;
}

export interface Versement {
  id: number;
  session_id: number;
  user_id: number;
  date_dimanche: string; // format YYYY-MM-DD
  montant: number;
  mode_reglement: ModePaiement;
  commentaire?: string;
  enregistre_par: number;
  created_at: string;
}

export interface Retrait {
  id: number;
  session_id: number;
  user_id: number;
  date_retrait: string; // format YYYY-MM-DD
  montant: number;
  motif?: string;
  enregistre_par: number;
  created_at: string;
}

export interface SessionTontine {
  id: number;
  libelle: string;
  annee: number;
  date_debut: string;
  date_fin: string;
  taux_retenue: number; // 3.00%
  statut: 'en_cours' | 'cloturee';
}

export interface Annonce {
  id: number;
  titre: string;
  contenu: string;
  priorite: PrioriteAnnonce;
  publie_par: number;
  date_publication: string;
  expire_le?: string;
}

export interface Badge {
  id: number;
  code: string;
  nom: string;
  description: string;
  icone: string;
  points: number;
}

export interface UserStats {
  userId: number;
  totalVerse: number;
  totalRetire: number;
  soldeActuel: number; // totalVerse - totalRetire
  nombreDimanches: number;
  serieEnCours: number; // Duolingo streak
  points: number;
  badges: Badge[];
  partEglise: number; // Retenue de l'église sur le total versé
  montantNetPrevisionnel: number; // solde restant net à récupérer en fin d'année
}

export interface ParametresApp {
  nom_eglise: string;
  devise: string;
  afficher_montants_classement: boolean;
  quota_ia_quotidien: number;
  pourcentage_retenue: number;
}

export interface AuditLog {
  id: number;
  user_id: number;
  user_name: string;
  action: string;
  entite: string;
  entite_id?: number;
  details: string;
  created_at: string;
}

/** Données complètes de l'application, utilisées pour la sauvegarde/restauration. */
export interface AppData {
  users: User[];
  versements: Versement[];
  retraits: Retrait[];
  sundaysList: string[];
  annonces: Annonce[];
  parametres: ParametresApp;
}

export interface ParsedVersementsResult {
  matched: Array<{
    userId: number;
    userName: string;
    montant: number;
    confiance: number;
  }>;
  ambiguous: Array<{
    rawName: string;
    montant: number;
    suggestions: Array<{ id: number; nom: string }>;
  }>;
  notFound: Array<{
    rawName: string;
    montant: number;
  }>;
}
