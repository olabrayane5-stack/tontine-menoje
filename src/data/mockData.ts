import { User, Versement, Retrait, SessionTontine, Annonce, Badge, ParametresApp } from '../types';

export const DEFAULT_SESSION: SessionTontine = {
  id: 1,
  libelle: 'Tontine Épargne & Fêtes de Fin d’Année 2026',
  annee: 2026,
  date_debut: '2026-01-04',
  date_fin: '2026-11-29',
  taux_retenue: 3.00,
  statut: 'en_cours',
};

export const DEFAULT_PARAMETRES: ParametresApp = {
  nom_eglise: 'M.E.NO.JE',
  devise: 'FCFA',
  afficher_montants_classement: true,
  quota_ia_quotidien: 5,
  pourcentage_retenue: 3,
};

export const BADGES_LIST: Badge[] = [
  {
    id: 1,
    code: 'PREMIER_PAS',
    nom: 'Premier Pas',
    description: 'A démarré son épargne tontine pour l’année',
    icone: 'Footprints',
    points: 15,
  },
  {
    id: 2,
    code: 'SERIE_4',
    nom: 'Épargnant Assidu',
    description: '4 dimanches consécutifs sans rupture',
    icone: 'Flame',
    points: 50,
  },
  {
    id: 3,
    code: 'SERIE_8',
    nom: 'Pilier d’Épargne',
    description: '8 dimanches consécutifs de régularité',
    icone: 'ShieldCheck',
    points: 120,
  },
  {
    id: 4,
    code: 'SERIE_12',
    nom: 'Champion de la Prévoyance',
    description: '12 dimanches d’affilée, fêtes garanties sans stress',
    icone: 'Crown',
    points: 250,
  },
  {
    id: 5,
    code: 'REGULARITE_OR',
    nom: 'Cœur Prévoyant',
    description: 'Cotisation versée sur plus de 80% des dimanches écoulés',
    icone: 'HeartHandshake',
    points: 180,
  },
];

// Liste de 50 membres avec identifiants de connexion
export const INITIAL_USERS: User[] = [
  { id: 1, nom_complet: 'Pasteur Emmanuel (Admin)', telephone: '+225 07 00 00 01', password: 'admin', role: 'admin', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-01' },
  { id: 2, nom_complet: 'Jean-Baptiste Kouamé', telephone: '+225 07 11 22 33', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-02' },
  { id: 3, nom_complet: 'Marie-Grace Adanlete', telephone: '+225 05 22 33 44', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-02' },
  { id: 4, nom_complet: 'Samuel Koffi', telephone: '+225 01 33 44 55', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-02' },
  { id: 5, nom_complet: 'Chantal Mensah', telephone: '+225 07 44 55 66', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: false, notes_admin: 'Maman Chantal - Préfère le relevé papier en main propre', created_at: '2026-01-03' },
  { id: 6, nom_complet: 'Paul Yao', telephone: '+225 05 55 66 77', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-03' },
  { id: 7, nom_complet: 'Awa Diop', telephone: '+225 01 66 77 88', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-03' },
  { id: 8, nom_complet: 'David N’Guessan', telephone: '+225 07 77 88 99', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-03' },
  { id: 9, nom_complet: 'Ruth Konan', telephone: '+225 05 88 99 00', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-04' },
  { id: 10, nom_complet: 'Patrice Bamba', telephone: '+225 01 99 00 11', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-04' },
  { id: 11, nom_complet: 'Esther Touré', telephone: '+225 07 10 20 30', password: 'temp', role: 'membre', statut: 'actif', must_change_password: true, whatsapp_disponible: true, notes_admin: 'Nouveau compte - Doit encore changer son mot de passe initial', created_at: '2026-01-04' },
  { id: 12, nom_complet: 'Daniel Zadi', telephone: '+225 05 20 30 40', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-05' },
  { id: 13, nom_complet: 'Rebecca Kaboré', telephone: '+225 01 30 40 50', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-05' },
  { id: 14, nom_complet: 'Papa Michel Akoto', telephone: '+225 07 40 50 60', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: false, notes_admin: 'Pas de smartphone, remettre relevé papier ou appel direct', created_at: '2026-01-05' },
  { id: 15, nom_complet: 'Sarah Gondo', telephone: '+225 05 50 60 70', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-05' },
  { id: 16, nom_complet: 'Josué Traoré', telephone: '+225 01 60 70 80', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-06' },
  { id: 17, nom_complet: 'Déborah Ouedraogo', telephone: '+225 07 70 80 90', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-06' },
  { id: 18, nom_complet: 'Jonathan Soro', telephone: '+225 05 80 90 01', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-06' },
  { id: 19, nom_complet: 'Abigaïl Dosso', telephone: '+225 01 90 01 12', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-07' },
  { id: 20, nom_complet: 'Siméon Gnahoré', telephone: '+225 07 01 12 23', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-07' },
  { id: 21, nom_complet: 'Priscilla Tano', telephone: '+225 05 12 23 34', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-07' },
  { id: 22, nom_complet: 'Elie Coulibaly', telephone: '+225 01 23 34 45', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-08' },
  { id: 23, nom_complet: 'Noémie Kassi', telephone: '+225 07 34 45 56', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-08' },
  { id: 24, nom_complet: 'Salomon Fofana', telephone: '+225 05 45 56 67', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-08' },
  { id: 25, nom_complet: 'Lydie Dago', telephone: '+225 01 56 67 78', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-09' },
  { id: 26, nom_complet: 'Barthélémy Séka', telephone: '+225 07 67 78 89', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-09' },
  { id: 27, nom_complet: 'Miriam N’Dri', telephone: '+225 05 78 89 90', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-09' },
  { id: 28, nom_complet: 'André Yapo', telephone: '+225 01 89 90 02', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-10' },
  { id: 29, nom_complet: 'Eunice Kouadio', telephone: '+225 07 90 02 13', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-10' },
  { id: 30, nom_complet: 'Jacques Allangba', telephone: '+225 05 02 13 24', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-10' },
  { id: 31, nom_complet: 'Dorcas Bouazo', telephone: '+225 01 13 24 35', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-11' },
  { id: 32, nom_complet: 'Mathieu Brou', telephone: '+225 07 24 35 46', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-11' },
  { id: 33, nom_complet: 'Rachel Haccandy', telephone: '+225 05 35 46 57', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-11' },
  { id: 34, nom_complet: 'Timothée Djé', telephone: '+225 01 46 57 68', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-12' },
  { id: 35, nom_complet: 'Ketsia Niamké', telephone: '+225 07 57 68 79', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-12' },
  { id: 36, nom_complet: 'Nathan Ahua', telephone: '+225 05 68 79 80', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-12' },
  { id: 37, nom_complet: 'Maman Suzanne Loh', telephone: '+225 01 79 80 91', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: false, notes_admin: 'Téléphone basique, pas d’internet', created_at: '2026-01-13' },
  { id: 38, nom_complet: 'Moïse Bitty', telephone: '+225 07 80 91 03', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-13' },
  { id: 39, nom_complet: 'Chloé Bohui', telephone: '+225 05 91 03 14', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-13' },
  { id: 40, nom_complet: 'Caleb Zézé', telephone: '+225 01 03 14 25', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-14' },
  { id: 41, nom_complet: 'Elisabeth Botty', telephone: '+225 07 14 25 36', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-14' },
  { id: 42, nom_complet: 'Barnabé Kra', telephone: '+225 05 25 36 47', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-14' },
  { id: 43, nom_complet: 'Judith Assemien', telephone: '+225 01 36 47 58', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-15' },
  { id: 44, nom_complet: 'Félix Gbeuly', telephone: '+225 07 47 58 69', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-15' },
  { id: 45, nom_complet: 'Viviane Tiecoura', telephone: '+225 05 58 69 70', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-15' },
  { id: 46, nom_complet: 'Benjamin Vanié', telephone: '+225 01 69 70 81', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-16' },
  { id: 47, nom_complet: 'Agnès Doumbia', telephone: '+225 07 70 81 92', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-16' },
  { id: 48, nom_complet: 'Gédéon Komenan', telephone: '+225 05 81 92 04', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-16' },
  { id: 49, nom_complet: 'Léontine Tiémélé', telephone: '+225 01 92 04 15', password: '123', role: 'membre', statut: 'actif', must_change_password: false, whatsapp_disponible: true, created_at: '2026-01-17' },
  { id: 50, nom_complet: 'Sylvain Danho', telephone: '+225 07 04 15 26', password: '123', role: 'membre', statut: 'inactif', must_change_password: false, whatsapp_disponible: true, notes_admin: 'Suspendu temporairement pour mission', created_at: '2026-01-17' },
];

export const SUNDAYS_LIST = [
  '2026-01-04',
  '2026-01-11',
  '2026-01-18',
  '2026-01-25',
  '2026-02-01',
  '2026-02-08',
  '2026-02-15',
  '2026-02-22',
  '2026-03-01',
  '2026-03-08',
];

export const generateInitialVersements = (): Versement[] => {
  const versements: Versement[] = [];
  let idCounter = 1;
  const montants = [2000, 3000, 5000, 5000, 10000, 10000, 15000, 20000, 25000, 50000];

  SUNDAYS_LIST.forEach((dimanche) => {
    INITIAL_USERS.slice(1).forEach((user) => {
      const userSeed = (user.id * 17) % 100;
      const isRegular = userSeed > 25;
      const chance = (user.id * 7 + SUNDAYS_LIST.indexOf(dimanche) * 13) % 10;

      if (isRegular || chance > 4) {
        const montant = montants[(user.id + SUNDAYS_LIST.indexOf(dimanche)) % montants.length];
        versements.push({
          id: idCounter++,
          session_id: 1,
          user_id: user.id,
          date_dimanche: dimanche,
          montant: montant,
          mode_reglement: user.id % 4 === 0 ? 'mobile_money' : 'especes',
          enregistre_par: 1,
          created_at: `${dimanche} 13:30:00`,
        });
      }
    });
  });

  return versements;
};

// Retraits partiels déjà effectués en cours d'année (ex: dépenses d'urgence, fournitures, frais médicaux)
export const INITIAL_RETRAITS: Retrait[] = [
  {
    id: 1,
    session_id: 1,
    user_id: 2, // Jean-Baptiste Kouamé
    date_retrait: '2026-02-18',
    montant: 15000,
    motif: 'Urgence familiale (santé enfant)',
    enregistre_par: 1,
    created_at: '2026-02-18 10:15:00',
  },
  {
    id: 2,
    session_id: 1,
    user_id: 4, // Samuel Koffi
    date_retrait: '2026-02-25',
    montant: 20000,
    motif: 'Réparation moto de travail',
    enregistre_par: 1,
    created_at: '2026-02-25 16:40:00',
  },
  {
    id: 3,
    session_id: 1,
    user_id: 6, // Paul Yao
    date_retrait: '2026-03-02',
    montant: 10000,
    motif: 'Frais de scolarité partiels',
    enregistre_par: 1,
    created_at: '2026-03-02 11:20:00',
  },
];

export const INITIAL_ANNONCES: Annonce[] = [
  {
    id: 1,
    titre: 'Lancement de la Tontine 2026 M.E.NO.JE - Fêtes Sans Soucis !',
    contenu: 'Bienvenue dans notre tontine d’épargne organisée par le Pasteur. L’objectif est simple : cotiser régulièrement chaque dimanche pour que personne ne soit angoissé en fin d’année pour les fêtes de Noël et du Nouvel An ! À la clôture, chacun récupère son total moins la retenue de l’église (3 % par défaut, réglable par l’administrateur).',
    priorite: 'importante',
    publie_par: 1,
    date_publication: '2026-01-04 14:00',
  },
  {
    id: 2,
    titre: 'Possibilité de retraits partiels en cours d’année',
    contenu: 'En cas d’urgence ou de besoin ponctuel, vous pouvez solliciter un retrait partiel sur votre solde auprès de l’administrateur sans attendre décembre.',
    priorite: 'normale',
    publie_par: 1,
    date_publication: '2026-01-18 11:00',
  },
  {
    id: 3,
    titre: 'Membres sans smartphone & Non-paroissiens bienvenus',
    contenu: 'Même si vous ne venez pas le dimanche au lieu de culte, vos cotisations peuvent être déposées ou envoyées par Mobile Money. Un relevé papier ou SMS est préparé pour chaque membre sans smartphone.',
    priorite: 'normale',
    publie_par: 1,
    date_publication: '2026-02-08 12:30',
  },
];
