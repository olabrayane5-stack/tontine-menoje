/**
 * Types des réponses de l'API PHP (backend/API.md).
 * L'API renvoie du camelCase ; le front utilise du snake_case : la conversion
 * se fait dans `mappers.ts`.
 */

export type RoleDto = 'admin' | 'membre';
export type StatutSessionDto = 'ouverte' | 'fermee';

export interface BadgeDto {
  code: string;
  nom: string;
  description: string;
  icone: string;
  points: number;
}

export interface StatsDto {
  userId: number;
  totalVerse: number;
  totalRetire: number;
  soldeActuel: number;
  nombreDimanches: number;
  serieEnCours: number;
  points: number;
  badges: BadgeDto[];
  partEglise: number;
  montantNetPrevisionnel: number;
  tauxRetenue?: number;
}

export interface UserDto {
  id: number;
  nom: string;
  telephone: string;
  role: RoleDto;
  actif: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  stats?: StatsDto;
}

export interface ReglagesDto {
  tauxRetenue: number;
  nomEglise: string;
  devise: string;
  afficherMontantsClassement: boolean;
}

export interface SessionDto {
  id: number;
  date: string;
  statut: StatutSessionDto;
  ouverte: boolean;
  openedAt?: string | null;
  closedAt?: string | null;
  nbVersements?: number | null;
  nbPresents?: number | null;
  total?: number | null;
}

export interface AnnonceDto {
  id: number;
  titre: string;
  contenu: string;
  createdAt: string;
}

export interface VersementDto {
  id: number;
  sessionId: number;
  date: string;
  montant: number;
  createdAt: string;
  updatedAt?: string;
}

export interface RetraitDto {
  id: number;
  montant: number;
  motif?: string | null;
  date: string;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: UserDto;
}

export interface MeResponse {
  user: UserDto;
  stats: StatsDto;
  reglages: ReglagesDto;
}

export interface ReleveResponse {
  membre: UserDto;
  tauxRetenue: number;
  totaux: {
    totalVerse: number;
    totalRetire: number;
    soldeActuel: number;
    partEglise: number;
    montantNetPrevisionnel: number;
  };
  stats: StatsDto;
  versements: VersementDto[];
  retraits: RetraitDto[];
}

export interface ClassementEntryDto {
  rang: number;
  userId: number;
  nom: string;
  points: number;
  serieEnCours: number;
  nombreDimanches: number;
  totalVerse: number | null;
  badges: string[];
}

export interface ClassementResponse {
  afficherMontants: boolean;
  badges: BadgeDto[];
  classement: ClassementEntryDto[];
}

export interface MembersResponse {
  members: UserDto[];
}

export interface CreateMemberResponse {
  member: UserDto;
  motDePasseProvisoire: string;
}

export interface ResetPasswordResponse {
  ok: boolean;
  motDePasseProvisoire: string;
}

export interface SessionsResponse {
  sessions: SessionDto[];
}

export interface CreateSessionResponse {
  session: SessionDto;
}

export interface SessionDetailResponse {
  session: SessionDto;
  versements: Array<{
    id: number;
    userId: number;
    nom: string;
    telephone: string;
    montant: number;
    enregistrePar: number;
    createdAt: string;
    updatedAt?: string;
  }>;
  membres: Array<{ id: number; nom: string; telephone: string }>;
  total: number;
  presents: number;
}

export interface SaveVersementResponse {
  ok: boolean;
  total: number;
  presents: number;
  nbNotes: number;
}

export interface CloseSessionResponse {
  ok: boolean;
  session: SessionDto;
  versementsCrees: number;
  total: number;
  presents: number;
  nbVersements: number;
}

export interface RetraitsResponse {
  retraits: Array<{
    id: number;
    userId: number;
    nom: string;
    telephone: string;
    montant: number;
    motif?: string | null;
    date: string;
    enregistrePar: number;
    createdAt: string;
  }>;
  total: number;
}

export interface CreateRetraitResponse {
  retrait: {
    id: number;
    userId: number;
    nom: string;
    montant: number;
    motif?: string | null;
    date: string;
    createdAt: string;
  };
  soldeActuel: number;
}

export interface AnnoncesResponse {
  annonces: AnnonceDto[];
}

export interface ReglagesResponse {
  reglages: ReglagesDto;
}

export interface PingResponse {
  ok: boolean;
  app: string;
  version: string;
  time: string;
  database: boolean;
}

/** Format de sauvegarde, volontairement en snake_case (compatible `parseBackup`). */
export interface BackupResponse {
  app: 'tontine-menoje';
  version: number;
  exported_at: string;
  data: unknown;
}
