import type { Annonce, Badge, ClassementEntry, ParametresApp, Retrait, SessionSummary, User, UserStats, Versement } from '../types';
import { parseBackup } from '../utils/backup';
import type {
  AnnonceDto,
  BackupResponse,
  BadgeDto,
  ClassementEntryDto,
  ReglagesDto,
  SessionDto,
  StatsDto,
  UserDto,
  VersementDto,
} from './types';

/** L'API ne stocke pas encore la préférence WhatsApp : on la considère active. */
export const toUser = (dto: UserDto): User => ({
  id: dto.id,
  nom_complet: dto.nom,
  telephone: dto.telephone,
  role: dto.role,
  statut: dto.actif ? 'actif' : 'inactif',
  must_change_password: dto.mustChangePassword,
  whatsapp_disponible: true,
  created_at: dto.createdAt,
});

export const toBadge = (dto: BadgeDto, index = 0): Badge => ({
  id: index + 1,
  code: dto.code,
  nom: dto.nom,
  description: dto.description,
  icone: dto.icone,
  points: dto.points,
});

export const toStats = (dto: StatsDto): UserStats => ({
  userId: dto.userId,
  totalVerse: dto.totalVerse,
  totalRetire: dto.totalRetire,
  soldeActuel: dto.soldeActuel,
  nombreDimanches: dto.nombreDimanches,
  serieEnCours: dto.serieEnCours,
  points: dto.points,
  badges: dto.badges.map(toBadge),
  partEglise: dto.partEglise,
  montantNetPrevisionnel: dto.montantNetPrevisionnel,
});

export const toParametres = (dto: ReglagesDto): ParametresApp => ({
  nom_eglise: dto.nomEglise,
  devise: dto.devise,
  afficher_montants_classement: dto.afficherMontantsClassement,
  quota_ia_quotidien: 5,
  pourcentage_retenue: dto.tauxRetenue,
});

/** Champs du front → corps attendu par `PUT /api/reglages`. */
export const toReglagesPatch = (patch: Partial<ParametresApp>) => {
  const body: {
    tauxRetenue?: number;
    nomEglise?: string;
    devise?: string;
    afficherMontantsClassement?: boolean;
  } = {};
  if (patch.pourcentage_retenue !== undefined) body.tauxRetenue = patch.pourcentage_retenue;
  if (patch.nom_eglise !== undefined) body.nomEglise = patch.nom_eglise;
  if (patch.devise !== undefined) body.devise = patch.devise;
  if (patch.afficher_montants_classement !== undefined) {
    body.afficherMontantsClassement = patch.afficher_montants_classement;
  }
  return body;
};

export const toAnnonce = (dto: AnnonceDto): Annonce => ({
  id: dto.id,
  titre: dto.titre,
  contenu: dto.contenu,
  priorite: 'normale',
  publie_par: 0,
  date_publication: dto.createdAt,
});

/** Versement du relevé membre (l'API ne renvoie pas `userId` : on le fournit). */
export const toVersement = (dto: VersementDto, userId: number): Versement => ({
  id: dto.id,
  session_id: dto.sessionId,
  user_id: userId,
  date_dimanche: dto.date,
  montant: dto.montant,
  mode_reglement: 'especes',
  enregistre_par: 0,
  created_at: dto.createdAt,
});

export const toRetrait = (dto: { id: number; montant: number; motif?: string | null; date: string; createdAt: string }, userId: number): Retrait => ({
  id: dto.id,
  session_id: 0,
  user_id: userId,
  date_retrait: dto.date,
  montant: dto.montant,
  motif: dto.motif ?? undefined,
  enregistre_par: 0,
  created_at: dto.createdAt,
});

export const toSessionSummary = (dto: SessionDto): SessionSummary => ({
  id: dto.id,
  date: dto.date,
  statut: dto.statut,
  ouverte: dto.ouverte,
  nbVersements: dto.nbVersements ?? null,
  nbPresents: dto.nbPresents ?? null,
  total: dto.total ?? null,
});

export const toClassementEntry = (dto: ClassementEntryDto): ClassementEntry => ({
  rang: dto.rang,
  userId: dto.userId,
  nom: dto.nom,
  points: dto.points,
  serieEnCours: dto.serieEnCours,
  nombreDimanches: dto.nombreDimanches,
  totalVerse: dto.totalVerse,
  badges: dto.badges,
});

/**
 * La sauvegarde de l'API est déjà au format du front : on la valide avec le
 * même parseur que l'import manuel pour éviter toute donnée corrompue.
 */
export const toBackupData = (payload: BackupResponse) => parseBackup(JSON.stringify(payload));
