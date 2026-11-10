import React, { useEffect, useRef, useState } from 'react';
import {
  User,
  Versement,
  Retrait,
  Annonce,
  ParametresApp,
  ParsedVersementsResult,
  AppData,
  SessionSummary,
} from '../types';
import {
  calculateUserStats,
  formatMoney,
  formatDateFr,
  parseAmountInput,
  normalizeText,
  parseVersementsBatchText,
  generateAdminAIAnalysis,
} from '../utils/tontineUtils';
import { ReceiptModal } from './ReceiptModal';
import { AnimatedAmount } from './AnimatedAmount';
import { WhatsAppModal } from './WhatsAppModal';
import { BackupCard } from './BackupCard';
import { SundayManager } from './SundayManager';
import { SessionsCard } from './api/SessionsCard';
import { Stagger, StaggerItem } from './motion/Stagger';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import {
  Users,
  Wallet,
  Calendar,
  PiggyBank,
  Plus,
  Trash2,
  Sparkles,
  Printer,
  Share2,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Settings,
  Bell,
  Send,
  Smartphone,
  UserCheck,
  UserX,
  KeyRound,
  Check,
  ArrowDownRight,
  ShieldCheck,
  X,
  Info,
  ClipboardList,
  HandCoins,
  ChevronRight,
} from 'lucide-react';

/** Initiales d'un nom complet, pour les avatars de la collecte (« Abigaïl Dosso » → « AD »). */
const memberInitials = (name: string): string =>
  name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

interface AdminDashboardProps {
  currentUser: User;
  users: User[];
  versements: Versement[];
  retraits: Retrait[];
  sundaysList: string[];
  annonces: Annonce[];
  parametres: ParametresApp;
  onAddVersement: (v: Omit<Versement, 'id' | 'created_at'>) => Promise<boolean | void> | boolean | void;
  onAddBatchVersements: (
    items: Array<Omit<Versement, 'id' | 'created_at'>>
  ) => Promise<boolean | void> | boolean | void;
  onDeleteVersement: (id: number) => Promise<boolean | void> | boolean | void;
  onAddRetrait: (r: Omit<Retrait, 'id' | 'created_at'>) => Promise<boolean | void> | boolean | void;
  onDeleteRetrait: (id: number) => Promise<boolean | void> | boolean | void;
  onAddUser: (
    u: Omit<User, 'id' | 'created_at'>
  ) => Promise<{ motDePasseProvisoire?: string } | void> | void;
  onToggleUserStatus: (userId: number) => void;
  onResetUserPassword: (userId: number) => Promise<string> | string;
  onAddAnnonce: (a: Omit<Annonce, 'id' | 'date_publication'>) => void;
  onDeleteAnnonce: (id: number) => void;
  onUpdateParametres: (p: Partial<ParametresApp>) => void;
  onRestoreData: (data: AppData) => void;
  onAddSunday: (date: string) => { ok: boolean; message: string };
  onDeleteSunday: (date: string) => { ok: boolean; message: string };
  /** Mode API : sessions gérées côté serveur, exports serveur, etc. */
  apiMode?: boolean;
  sessions?: SessionSummary[];
  onOpenSession?: (date: string) => Promise<{ ok: boolean; message: string }>;
  onCloseSession?: (date: string) => Promise<{ ok: boolean; message: string }>;
  onReopenSession?: (date: string) => Promise<{ ok: boolean; message: string }>;
  onExportBackup?: () => Promise<void>;
  onExportCsv?: () => Promise<void>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  users,
  versements,
  retraits,
  sundaysList,
  annonces,
  parametres,
  onAddVersement,
  onAddBatchVersements,
  onDeleteVersement,
  onAddRetrait,
  onDeleteRetrait,
  onAddUser,
  onToggleUserStatus,
  onResetUserPassword,
  onAddAnnonce,
  onDeleteAnnonce,
  onUpdateParametres,
  onRestoreData,
  onAddSunday,
  onDeleteSunday,
  apiMode = false,
  sessions = [],
  onOpenSession,
  onCloseSession,
  onReopenSession,
  onExportBackup,
  onExportCsv,
}) => {
  const [activeSection, setActiveSection] = useState<'saisie' | 'retraits' | 'membres' | 'cloture' | 'annonces' | 'ia_analyse' | 'reglages'>('saisie');
  const toast = useToast();

  // Saisie Dimanche
  const [selectedSunday, setSelectedSunday] = useState(sundaysList[sundaysList.length - 1] || '2026-03-08');
  const [saisieMode, setSaisieMode] = useState<'liste' | 'texte'>('liste');
  const [saisieSearch, setSaisieSearch] = useState('');
  const [saisieFilter, setSaisieFilter] = useState<'tous' | 'a_noter' | 'notes'>('tous');
  const [collecteMemberId, setCollecteMemberId] = useState<number | null>(null);
  const [collecteAmount, setCollecteAmount] = useState('');
  const [collecteError, setCollecteError] = useState(false);
  const [saisieSaved, setSaisieSaved] = useState(false);
  const [rawIaBatchText, setRawIaBatchText] = useState('Jean 10000, Marie-Grace 15000, Paul Yao 5000, Samuel Koffi 20000, Chantal Mensah 10000');
  const [parsedPreview, setParsedPreview] = useState<ParsedVersementsResult | null>(null);
  const [batchSaveSuccess, setBatchSaveSuccess] = useState(false);

  // Nouveau Retrait Partiel Form
  const [retraitUserId, setRetraitUserId] = useState<number>(users.find((u) => u.role === 'membre')?.id || 2);
  const [retraitAmount, setRetraitAmount] = useState<string>('10000');
  const [retraitMotif, setRetraitMotif] = useState<string>('Dépense familiale urgente');
  const [retraitDate, setRetraitDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [retraitError, setRetraitError] = useState<string>('');

  // Modales
  const [selectedMemberForReceipt, setSelectedMemberForReceipt] = useState<User | null>(null);
  const [selectedMemberForWhatsApp, setSelectedMemberForWhatsApp] = useState<User | null>(null);
  const [tempPasswordModal, setTempPasswordModal] = useState<{ memberName: string; pass: string } | null>(null);

  // Recherche & Filtres Membres
  const [memberSearch, setMemberSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<'tous' | 'sans_smartphone' | 'inactifs'>('tous');

  // Nouveau membre form
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberWhatsapp, setNewMemberWhatsapp] = useState(true);
  const [newMemberNotes, setNewMemberNotes] = useState('');

  // Nouvelle annonce form
  const [showAddAnnonceModal, setShowAddAnnonceModal] = useState(false);
  const [annonceTitre, setAnnonceTitre] = useState('');
  const [annonceContenu, setAnnonceContenu] = useState('');
  const [annoncePriorite, setAnnoncePriorite] = useState<'normale' | 'importante' | 'urgente'>('normale');

  // Analyse IA Admin
  const [adminAiPrompt, setAdminAiPrompt] = useState('Qui n’a rien donné depuis 4 dimanches ?');
  const [adminAiResponse, setAdminAiResponse] = useState<string | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  // Totaux globaux consolidés
  const totalCotise = versements.reduce((sum, v) => sum + Number(v.montant), 0);
  const totalRetraits = retraits.reduce((sum, r) => sum + Number(r.montant), 0);
  const liquiditeEnCaisse = totalCotise - totalRetraits;
  const partEgliseTotale = Math.round(totalCotise * (parametres.pourcentage_retenue / 100));
  const netRestantPourFetes = totalCotise - partEgliseTotale - totalRetraits;
  const activeMembersCount = users.filter((u) => u.role === 'membre' && u.statut === 'actif').length;

  // Versements du dimanche sélectionné
  const sundayVersements = versements.filter((v) => v.date_dimanche === selectedSunday);
  const sundayTotal = sundayVersements.reduce((sum, v) => sum + Number(v.montant), 0);

  // En mode API, un dimanche fermé est verrouillé côté serveur.
  const selectedSession = sessions.find((session) => session.date === selectedSunday);
  const selectedSessionClosed = selectedSession?.statut === 'fermee';

  // Index membre -> versement du dimanche (un seul par membre grâce à l'upsert)
  const recordedByUser = new Map<number, Versement>();
  sundayVersements.forEach((versement) => {
    if (!recordedByUser.has(versement.user_id)) {
      recordedByUser.set(versement.user_id, versement);
    }
  });

  // Membres affichés dans la collecte : actifs + membres inactifs déjà notés ce dimanche
  const saisieMembers = users
    .filter((u) => u.role === 'membre')
    .filter((u) => u.statut === 'actif' || recordedByUser.has(u.id))
    .sort((a, b) => a.nom_complet.localeCompare(b.nom_complet, 'fr'));

  const notesCount = saisieMembers.filter((m) => recordedByUser.has(m.id)).length;
  const remainingCount = saisieMembers.length - notesCount;
  const progressPercent = saisieMembers.length > 0 ? Math.round((notesCount / saisieMembers.length) * 100) : 0;

  // Dernier montant donné par chaque membre avant le dimanche affiché (repère de saisie).
  const lastVersementByUser = new Map<number, Versement>();
  versements.forEach((versement) => {
    if (versement.date_dimanche >= selectedSunday) return;
    const previous = lastVersementByUser.get(versement.user_id);
    if (!previous || versement.date_dimanche > previous.date_dimanche) {
      lastVersementByUser.set(versement.user_id, versement);
    }
  });

  const saisieSearchTerm = normalizeText(saisieSearch);
  const filteredSaisieMembers = saisieMembers.filter((member) => {
    const saved = recordedByUser.get(member.id);
    if (saisieFilter === 'a_noter' && saved) return false;
    if (saisieFilter === 'notes' && !saved) return false;
    if (!saisieSearchTerm) return true;
    const phone = member.telephone.replace(/\s+/g, '');
    return (
      normalizeText(member.nom_complet).includes(saisieSearchTerm) ||
      phone.includes(saisieSearchTerm.replace(/\s+/g, ''))
    );
  });

  // Membre en cours de saisie dans le pavé de collecte
  const collecteMember = collecteMemberId === null ? null : saisieMembers.find((m) => m.id === collecteMemberId) ?? null;
  const collecteSaved = collecteMember ? recordedByUser.get(collecteMember.id) : undefined;
  const collecteLast = collecteMember ? lastVersementByUser.get(collecteMember.id) : undefined;
  const collecteCumul = collecteMember
    ? versements
        .filter((versement) => versement.user_id === collecteMember.id)
        .reduce((sum, versement) => sum + Number(versement.montant), 0)
    : 0;

  // Un changement de dimanche repart de zéro : aucun montant ne doit fuiter.
  useEffect(() => {
    setCollecteMemberId(null);
    setCollecteAmount('');
    setCollecteError(false);
    setParsedPreview(null);
  }, [selectedSunday]);

  // Le calendrier peut arriver après le premier rendu (mode API) : on recale
  // la sélection sur le dimanche le plus récent disponible.
  useEffect(() => {
    if (sundaysList.length === 0) return;
    if (!sundaysList.includes(selectedSunday)) {
      setSelectedSunday(sundaysList[sundaysList.length - 1]);
    }
  }, [sundaysList, selectedSunday]);

  // En mode API, la collecte suit la session ouverte : dès qu'un dimanche est
  // ouvert (ou rouvert), il devient la cible de la saisie.
  const previousOpenSessionDate = useRef<string | null>(null);
  useEffect(() => {
    if (!apiMode) return;
    const openDate = sessions.find((session) => session.ouverte)?.date ?? null;
    if (openDate && openDate !== previousOpenSessionDate.current) {
      setSelectedSunday(openDate);
    }
    previousOpenSessionDate.current = openDate;
  }, [apiMode, sessions]);

  // Empêche la page de défiler derrière le pavé de collecte.
  useEffect(() => {
    if (collecteMemberId === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [collecteMemberId]);

  const flashSaisieSaved = () => {
    setSaisieSaved(true);
    window.setTimeout(() => setSaisieSaved(false), 3000);
  };

  // Retour haptique léger sur téléphone (ignoré si non supporté).
  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  };

  const openCollecte = (memberId: number) => {
    const saved = recordedByUser.get(memberId);
    setCollecteMemberId(memberId);
    setCollecteAmount(saved ? String(saved.montant) : '');
    setCollecteError(false);
  };

  const closeCollecte = () => {
    setCollecteMemberId(null);
    setCollecteAmount('');
    setCollecteError(false);
  };

  // Prochain membre sans montant, en partant du membre courant puis en bouclant.
  const findNextPendingMemberId = (fromId: number): number | null => {
    const start = saisieMembers.findIndex((member) => member.id === fromId);
    if (start < 0) return null;
    for (let offset = 1; offset < saisieMembers.length; offset += 1) {
      const candidate = saisieMembers[(start + offset) % saisieMembers.length];
      if (candidate.id !== fromId && !recordedByUser.has(candidate.id)) return candidate.id;
    }
    return null;
  };

  // Enregistre le montant du membre affiché. `advance` enchaîne sur le suivant.
  const saveCollecte = async (advance: boolean) => {
    if (!collecteMember) return;

    if (apiMode && selectedSessionClosed) {
      toast.error('Session fermée : rouvrez-la avant de modifier les versements.');
      return;
    }

    const parsed = parseAmountInput(collecteAmount);
    if (parsed === null) {
      setCollecteError(true);
      vibrate([20, 40, 20]);
      return;
    }

    const saved = recordedByUser.get(collecteMember.id);
    if (!saved || saved.montant !== parsed) {
      const accepted = await onAddVersement({
        session_id: 1,
        user_id: collecteMember.id,
        date_dimanche: selectedSunday,
        montant: parsed,
        mode_reglement: saved?.mode_reglement ?? 'especes',
        enregistre_par: currentUser.id,
      });
      if (accepted === false) return;
      vibrate(12);
      flashSaisieSaved();
    }

    setCollecteError(false);

    if (advance) {
      const nextId = findNextPendingMemberId(collecteMember.id);
      if (nextId !== null) {
        openCollecte(nextId);
        return;
      }
    }
    closeCollecte();
  };

  // Analyse du texte de saisie rapide
  const handleParseIaBatch = () => {
    const res = parseVersementsBatchText(rawIaBatchText, users.filter((u) => u.role === 'membre' && u.statut === 'actif'));
    setParsedPreview(res);
    setBatchSaveSuccess(false);
  };

  const handleConfirmBatchSave = async () => {
    if (!parsedPreview || parsedPreview.matched.length === 0) return;

    if (apiMode && selectedSessionClosed) {
      toast.error('Session fermée : rouvrez-la avant de modifier les versements.');
      return;
    }

    const newEntries = parsedPreview.matched.map((item) => ({
      session_id: 1,
      user_id: item.userId,
      date_dimanche: selectedSunday,
      montant: item.montant,
      mode_reglement: 'especes' as const,
      enregistre_par: currentUser.id,
      commentaire: 'Saisie rapide par texte validée',
    }));

    const accepted = await onAddBatchVersements(newEntries);
    if (accepted === false) return;

    setBatchSaveSuccess(true);
    setParsedPreview(null);
    setRawIaBatchText('');
    setTimeout(() => setBatchSaveSuccess(false), 4000);
    toast.success(`${newEntries.length} versement(s) enregistré(s) pour ce dimanche.`);
  };

  // Enregistrement d'un retrait partiel
  const handleCreateRetrait = async (e: React.FormEvent) => {
    e.preventDefault();
    setRetraitError('');
    const amount = parseFloat(retraitAmount);
    if (isNaN(amount) || amount <= 0) {
      setRetraitError('Montant invalide.');
      return;
    }

    const memberStats = calculateUserStats(retraitUserId, versements, retraits, sundaysList, parametres.pourcentage_retenue);
    if (amount > memberStats.soldeActuel) {
      setRetraitError(`Ce membre ne dispose que de ${formatMoney(memberStats.soldeActuel, parametres.devise)} en caisse.`);
      return;
    }

    const accepted = await onAddRetrait({
      session_id: 1,
      user_id: retraitUserId,
      date_retrait: retraitDate,
      montant: amount,
      motif: retraitMotif.trim() || undefined,
      enregistre_par: currentUser.id,
    });
    if (accepted === false) return;

    setRetraitAmount('10000');
    setRetraitMotif('');
    toast.success('Retrait partiel enregistré.');
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberPhone.trim()) return;

    try {
      const result = await onAddUser({
        nom_complet: newMemberName.trim(),
        telephone: newMemberPhone.trim(),
        password: '123',
        role: 'membre',
        statut: 'actif',
        must_change_password: true,
        whatsapp_disponible: newMemberWhatsapp,
        notes_admin: newMemberNotes.trim() || undefined,
      });

      setShowAddMemberModal(false);
      setNewMemberName('');
      setNewMemberPhone('');
      setNewMemberNotes('');
      const provisional =
        result && 'motDePasseProvisoire' in result ? result.motDePasseProvisoire : undefined;
      toast.success(
        provisional
          ? `Nouveau membre inscrit. Mot de passe provisoire : ${provisional}`
          : 'Nouveau membre inscrit. Mot de passe provisoire : 123.'
      );
    } catch {
      // L'erreur serveur est déjà signalée par une notification.
    }
  };

  const handleResetPassword = async (u: User) => {
    try {
      const newPass = await onResetUserPassword(u.id);
      setTempPasswordModal({ memberName: u.nom_complet, pass: newPass });
    } catch {
      toast.error('Réinitialisation impossible. Vérifiez la connexion au serveur.');
    }
  };

  const handleRunAdminAiAnalysis = (promptText?: string) => {
    const q = promptText || adminAiPrompt;
    if (!q.trim()) return;
    setIsAiAnalyzing(true);
    setTimeout(() => {
      const resp = generateAdminAIAnalysis(q, users, versements, retraits, sundaysList, parametres.devise, parametres.pourcentage_retenue);
      setAdminAiResponse(resp);
      setIsAiAnalyzing(false);
    }, 400);
  };

  const filteredMembersList = users
    .filter((u) => u.role === 'membre')
    .filter((u) => {
      if (memberFilter === 'sans_smartphone') return !u.whatsapp_disponible;
      if (memberFilter === 'inactifs') return u.statut === 'inactif';
      return true;
    })
    .filter((u) => {
      if (!memberSearch.trim()) return true;
      const term = memberSearch.toLowerCase();
      return u.nom_complet.toLowerCase().includes(term) || u.telephone.includes(term);
    });

  const selectedRetraitMemberStats = calculateUserStats(retraitUserId, versements, retraits, sundaysList, parametres.pourcentage_retenue);

  const adminSections: Array<{
    key: 'saisie' | 'retraits' | 'membres' | 'cloture' | 'ia_analyse' | 'annonces' | 'reglages';
    label: string;
    hint: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { key: 'saisie', label: 'Saisie', hint: 'Dimanche', icon: Calendar },
    { key: 'retraits', label: 'Retraits', hint: 'Partiels', icon: ArrowDownRight, count: retraits.length },
    { key: 'membres', label: 'Membres', hint: 'Annuaire', icon: Users, count: activeMembersCount },
    { key: 'cloture', label: 'Clôture', hint: 'Bilan fêtes', icon: FileSpreadsheet },
    { key: 'ia_analyse', label: 'Analyses', hint: 'Assistant', icon: Sparkles },
    { key: 'annonces', label: 'Annonces', hint: 'Diffusion', icon: Bell, count: annonces.length },
    { key: 'reglages', label: 'Réglages', hint: 'Configuration', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {/* Héro administrateur */}
      <section className="app-hero animate-slide-up relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="app-hero-ring -right-24 -top-28 h-72 w-72" />
        <div className="app-hero-ring -bottom-40 right-32 h-80 w-80" />
        <div className="absolute -left-16 bottom-0 h-52 w-52 rounded-full bg-emerald-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="app-chip border border-amber-400/30 bg-amber-500/15 text-amber-300">
                <ShieldCheck className="h-3 w-3" />
                Pilotage administrateur
              </span>
              <span className="text-[11px] font-semibold text-slate-400">Exercice 2026</span>
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Bonjour, {currentUser.nom_complet.split(' ')[0]}
            </h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-300 sm:text-sm">
              Toute la tontine sous contrôle : collecte du dimanche, retraits, membres et préparation des fêtes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSection('saisie')}
              className="btn btn-accent btn-sheen"
            >
              <Plus className="h-4 w-4" />
              Saisir un dimanche
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('cloture')}
              className="btn border-white/15 bg-white/10 text-white backdrop-blur hover:bg-white/15"
            >
              <Printer className="h-4 w-4" />
              Bilan de clôture
            </button>
          </div>
        </div>

        {/* Statistiques intégrées */}
        <Stagger className="relative z-10 mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4" gap={0.07}>
          <StaggerItem className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-amber-300">
              <Wallet className="h-4 w-4" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Total cotisé</p>
            </div>
            <p className="mt-1.5 text-lg font-black tabular-nums text-white sm:text-xl">
              <AnimatedAmount value={totalCotise} devise={parametres.devise} />
            </p>
          </StaggerItem>

          <StaggerItem className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-rose-300">
              <ArrowDownRight className="h-4 w-4" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Retraits</p>
            </div>
            <p className="mt-1.5 text-lg font-black tabular-nums text-white sm:text-xl">
              <AnimatedAmount value={totalRetraits} devise={parametres.devise} />
            </p>
          </StaggerItem>

          <StaggerItem className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-emerald-300">
              <PiggyBank className="h-4 w-4" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">En caisse</p>
            </div>
            <p className="mt-1.5 text-lg font-black tabular-nums text-white sm:text-xl">
              <AnimatedAmount value={liquiditeEnCaisse} devise={parametres.devise} />
            </p>
          </StaggerItem>

          <StaggerItem className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sky-300">
              <Users className="h-4 w-4" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Membres actifs</p>
            </div>
            <p className="mt-1.5 text-lg font-black tabular-nums text-white sm:text-xl">
              {activeMembersCount} personne{activeMembersCount > 1 ? 's' : ''}
            </p>
          </StaggerItem>
        </Stagger>
      </section>

      {/* Navigation par sections */}
      <nav aria-label="Sections d'administration" className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {adminSections.map((section, index) => {
          const isActive = activeSection === section.key;
          return (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              aria-current={isActive ? 'page' : undefined}
              style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
              className={`group animate-rise flex items-center gap-2.5 rounded-2xl px-3 py-3 text-left transition cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                  : 'app-card text-slate-700 hover:-translate-y-0.5 hover:text-slate-900'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                  isActive
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-900/5 text-slate-500 group-hover:text-amber-600'
                }`}
              >
                <section.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold">{section.label}</span>
                <span className={`block truncate text-[10px] ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                  {section.hint}
                  {typeof section.count === 'number' && section.count > 0 ? ` · ${section.count}` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* Contenu de la section active (transition animée) */}
      <div key={activeSection} className="page-transition">
      {/* SECTION 1 : Saisie Dimanche */}
      {activeSection === 'saisie' && (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs uppercase font-bold text-amber-400">Dimanche de cotisation sélectionné</p>
                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={selectedSunday}
                    onChange={(e) => setSelectedSunday(e.target.value)}
                    className="bg-slate-800 text-white font-bold text-base px-3.5 py-1.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {sundaysList.map((sunday) => (
                      <option key={sunday} value={sunday}>
                        {formatDateFr(sunday)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-slate-400">Total collecté ce dimanche :</p>
                <p className="text-2xl font-black text-amber-400">{formatMoney(sundayTotal, parametres.devise)}</p>
                <p className="text-xs text-slate-300">{sundayVersements.length} versement(s)</p>
              </div>
            </div>
          </div>

          {apiMode && selectedSessionClosed && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-rose-300/70 bg-rose-50/80 px-4 py-3 text-[11px] leading-relaxed text-rose-900 sm:text-xs">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <p>
                <strong>Dimanche fermé.</strong> Les versements de ce dimanche sont verrouillés par
                le serveur. Rouvrez la session dans <strong>Réglages → Dimanches & sessions</strong>{' '}
                pour corriger un montant.
              </p>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300/70 bg-amber-50/80 px-4 py-3 text-[11px] leading-relaxed text-amber-900 sm:text-xs">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              <strong>Registre déclaratif.</strong> Notez ici les montants remis en main propre. Ce
              n'est pas de l'argent déplacé par l'application : c'est une preuve de suivi, visible
              par chaque membre dans son historique.
            </p>
          </div>

          {/* Choix du mode de saisie */}
          <nav
            aria-label="Mode de saisie"
            className="hide-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-1"
          >
            <button
              type="button"
              onClick={() => setSaisieMode('liste')}
              aria-pressed={saisieMode === 'liste'}
              className={`flex shrink-0 cursor-pointer items-center gap-2 min-h-11 rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
                saisieMode === 'liste'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
              }`}
            >
              <ClipboardList className={`h-4 w-4 ${saisieMode === 'liste' ? 'text-amber-500' : ''}`} />
              Par membre
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
                {saisieMembers.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSaisieMode('texte')}
              aria-pressed={saisieMode === 'texte'}
              className={`flex shrink-0 cursor-pointer items-center gap-2 min-h-11 rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
                saisieMode === 'texte'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
              }`}
            >
              <Sparkles className={`h-4 w-4 ${saisieMode === 'texte' ? 'text-amber-500' : ''}`} />
              Texte rapide
            </button>
          </nav>

          {saisieMode === 'liste' && (
            <div className="app-card overflow-hidden rounded-2xl">
              <div className="space-y-3 border-b border-slate-100 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 sm:text-base">Collecte par membre</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {notesCount} / {saisieMembers.length} membre(s) noté(s)
                      {remainingCount > 0 ? ` · ${remainingCount} restant(s)` : ' · tout est noté'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Total du dimanche
                    </p>
                    <p className="text-lg font-black tabular-nums text-slate-900">
                      {formatMoney(sundayTotal, parametres.devise)}
                    </p>
                  </div>
                </div>

                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                  aria-label="Progression de la collecte du dimanche"
                >
                  <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>

                {/* Action principale : ouvre directement le prochain membre à noter */}
                <button
                  type="button"
                  onClick={() => {
                    const firstPending = saisieMembers.find((member) => !recordedByUser.has(member.id));
                    const target = firstPending ?? saisieMembers[0];
                    if (target) openCollecte(target.id);
                  }}
                  disabled={saisieMembers.length === 0}
                  className="btn btn-accent btn-sheen w-full"
                >
                  <HandCoins className="h-4 w-4" />
                  {remainingCount > 0
                    ? `Saisir un montant · ${remainingCount} restant${remainingCount > 1 ? 's' : ''}`
                    : 'Modifier un montant'}
                </button>

                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={saisieSearch}
                    onChange={(e) => setSaisieSearch(e.target.value)}
                    placeholder="Rechercher un nom ou un téléphone…"
                    aria-label="Rechercher un membre"
                    className="field pl-10 pr-10 text-sm"
                  />
                  {saisieSearch && (
                    <button
                      type="button"
                      onClick={() => setSaisieSearch('')}
                      aria-label="Effacer la recherche"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: 'tous', label: 'Tous', count: saisieMembers.length },
                    { key: 'a_noter', label: 'À noter', count: remainingCount },
                    { key: 'notes', label: 'Notés', count: notesCount },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setSaisieFilter(f.key as 'tous' | 'a_noter' | 'notes')}
                      aria-pressed={saisieFilter === f.key}
                      className={`min-h-11 rounded-full border px-3 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                        saisieFilter === f.key
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800'
                      }`}
                    >
                      {f.label} <span className="opacity-60">{f.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredSaisieMembers.length === 0 && (
                  <div className="px-5 py-10 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                      <Search className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-800">Aucun membre trouvé</p>
                    <p className="mt-1 text-xs text-slate-500">Modifiez la recherche ou le filtre.</p>
                  </div>
                )}

                {filteredSaisieMembers.map((member) => {
                  const saved = recordedByUser.get(member.id);
                  const last = lastVersementByUser.get(member.id);

                  return (
                    <button
                      key={member.id}
                      type="button"
                      data-user-id={member.id}
                      onClick={() => openCollecte(member.id)}
                      aria-label={`${saved ? 'Modifier' : 'Saisir'} le montant de ${member.nom_complet} pour le ${formatDateFr(selectedSunday)}`}
                      className={`flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition hover:bg-slate-50 sm:px-5 ${
                        saved ? 'bg-emerald-50/80 hover:bg-emerald-50' : ''
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xs font-black ${
                          saved ? 'bg-emerald-500/15 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {saved ? <Check className="h-4 w-4" /> : memberInitials(member.nom_complet)}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                          <span className="truncate">{member.nom_complet}</span>
                          {member.statut === 'inactif' && (
                            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                              Inactif
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px]">
                          {saved ? (
                            <span className="font-bold text-emerald-700">
                              {formatMoney(saved.montant, parametres.devise)}
                            </span>
                          ) : last ? (
                            <span className="text-slate-400">
                              Dernier : {formatMoney(last.montant, parametres.devise)}
                            </span>
                          ) : (
                            <span className="italic text-slate-400">Aucun montant noté</span>
                          )}
                        </span>
                      </span>

                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-black ${
                          saved
                            ? 'border-emerald-200 bg-white text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {saved ? 'Modifier' : 'Saisir'}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                  {saisieSaved ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Montant enregistré.
                    </>
                  ) : remainingCount > 0 ? (
                    <>
                      <Info className="h-3.5 w-3.5 text-amber-500" />
                      {remainingCount} membre(s) à noter · touchez un nom pour saisir.
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Tout est noté pour ce dimanche.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          {saisieMode === 'texte' && (
            <div className="app-card p-4 sm:p-6 space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  Saisie rapide par texte
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tapez le texte brut (ex: <code>Jean 5000, Marie 2000, Paul 10000</code>). La liste
                  est préparée puis soumise à votre <strong>validation</strong> avant enregistrement.
                </p>
                <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  Un membre déjà noté ce dimanche sera <strong>mis à jour</strong>, jamais dupliqué.
                </p>
              </div>

              <div>
                <textarea
                  value={rawIaBatchText}
                  onChange={(e) => setRawIaBatchText(e.target.value)}
                  rows={3}
                  placeholder="Ex: Jean Kouamé 5000, Marie-Grace 10000, Koffi 15000"
                  className="field font-mono text-sm"
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={handleParseIaBatch}
                  className="btn btn-primary"
                >
                  <Sparkles className="w-4 h-4" />
                  Analyser et Générer l'Aperçu
                </button>

                {batchSaveSuccess && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4" /> Versements enregistrés avec succès !
                  </span>
                )}
              </div>

              {parsedPreview && (
                <div className="mt-6 pt-5 border-t border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        Aperçu de Validation ({parsedPreview.matched.length} prêts)
                      </h4>
                      <p className="text-xs text-slate-500">Vérifiez avant de confirmer l'enregistrement en caisse.</p>
                    </div>

                    <button
                      onClick={handleConfirmBatchSave}
                      disabled={parsedPreview.matched.length === 0}
                      className="btn btn-accent"
                    >
                      <Check className="w-4 h-4" />
                      Confirmer et Enregistrer ({parsedPreview.matched.length})
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {parsedPreview.matched.map((item, idx) => (
                      <div key={idx} className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{item.userName}</p>
                          <span className="text-[10px] text-emerald-700 font-semibold">Identifié avec certitude</span>
                        </div>
                        <p className="font-black text-sm text-emerald-900">{formatMoney(item.montant, parametres.devise)}</p>
                      </div>
                    ))}
                  </div>

                  {parsedPreview.ambiguous.length > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Ambiguïté : l'IA ne devine pas, choisissez le membre :
                      </div>
                      {parsedPreview.ambiguous.map((amb, i) => (
                        <div key={i} className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-amber-200">
                          <span className="font-mono text-xs font-bold text-slate-700">« {amb.rawName} » ({formatMoney(amb.montant, parametres.devise)})</span>
                          <select
                            onChange={(e) => {
                              const chosenId = parseInt(e.target.value, 10);
                              const chosenUser = users.find((u) => u.id === chosenId);
                              if (chosenUser) {
                                setParsedPreview((prev) => {
                                  if (!prev) return null;
                                  return {
                                    ...prev,
                                    matched: [
                                      ...prev.matched,
                                      { userId: chosenUser.id, userName: chosenUser.nom_complet, montant: amb.montant, confiance: 1.0 },
                                    ],
                                    ambiguous: prev.ambiguous.filter((_, idx2) => idx2 !== i),
                                  };
                                });
                              }
                            }}
                            className="text-xs p-1 rounded-lg border border-slate-300 bg-slate-50 font-medium"
                          >
                            <option value="">-- Choisir le bon membre --</option>
                            {amb.suggestions.map((s) => (
                              <option key={s.id} value={s.id}>{s.nom}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* La liste par membre ci-dessus sert aussi de récapitulatif du dimanche. */}

          {/* Le récapitulatif est intégré à la liste par membre ci-dessus. */}
        </div>
      )}

      {/* SECTION 2 : Retraits Partiels en cours d'année */}
      {activeSection === 'retraits' && (
        <div className="space-y-6">
          <div className="app-card p-6 sm:p-8 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-rose-600" />
                Accorder un Retrait Partiel sur Épargne
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Les membres n'ont pas besoin d'attendre la fin d'année : ils peuvent retirer une partie de leur argent en cas de besoin urgent.
              </p>
            </div>

            <form onSubmit={handleCreateRetrait} className="grid grid-cols-1 items-end gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="field-label">Membre demandeur</label>
                <select
                  value={retraitUserId}
                  onChange={(e) => setRetraitUserId(parseInt(e.target.value, 10))}
                  className="field text-sm"
                >
                  {users.filter((u) => u.role === 'membre' && u.statut === 'actif').map((m) => (
                    <option key={m.id} value={m.id}>{m.nom_complet}</option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] font-bold text-amber-700">
                  Solde en caisse : {formatMoney(selectedRetraitMemberStats.soldeActuel, parametres.devise)}
                </p>
              </div>

              <div>
                <label className="field-label">Montant à retirer ({parametres.devise})</label>
                <input
                  type="number"
                  step="500"
                  min="500"
                  max={selectedRetraitMemberStats.soldeActuel}
                  value={retraitAmount}
                  onChange={(e) => setRetraitAmount(e.target.value)}
                  className="field text-sm font-bold"
                  required
                />
              </div>

              <div>
                <label className="field-label">Motif (urgence, santé, fête…)</label>
                <input
                  type="text"
                  placeholder="Ex: Frais médicaux urgents"
                  value={retraitMotif}
                  onChange={(e) => setRetraitMotif(e.target.value)}
                  className="field text-sm"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={selectedRetraitMemberStats.soldeActuel <= 0}
                  className="btn btn-danger w-full"
                >
                  Valider le retrait partiel
                </button>
              </div>
            </form>

            {retraitError && (
              <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                {retraitError}
              </p>
            )}
          </div>

          {/* Tableau historique des retraits */}
          <div className="app-card p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">
              Historique des retraits accordés en 2026 ({retraits.length})
            </h3>

            <div className="divide-y divide-slate-100 sm:hidden">
              {retraits.map((r) => {
                const m = users.find((u) => u.id === r.user_id);
                return (
                  <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{m?.nom_complet || `Membre #${r.user_id}`}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {formatDateFr(r.date_retrait)} · {r.motif || 'Retrait anticipé'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <p className="text-sm font-black text-rose-700">− {formatMoney(r.montant, parametres.devise)}</p>
                      <button
                        onClick={() => {
                          onDeleteRetrait(r.id);
                          toast.success('Retrait annulé.');
                        }}
                        className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        title="Annuler ce retrait"
                        aria-label={`Annuler le retrait de ${m?.nom_complet ?? 'ce membre'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {retraits.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  Aucun retrait partiel n'a encore été effectué cette année.
                </p>
              )}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Membre</th>
                    <th className="px-3 py-2.5">Téléphone</th>
                    <th className="px-3 py-2.5">Motif</th>
                    <th className="px-3 py-2.5 text-right">Montant retiré</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {retraits.map((r) => {
                    const m = users.find((u) => u.id === r.user_id);
                    return (
                      <tr key={r.id} className="transition hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-semibold text-slate-900">{formatDateFr(r.date_retrait)}</td>
                        <td className="px-3 py-2.5 font-bold">{m?.nom_complet || `Membre #${r.user_id}`}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{m?.telephone}</td>
                        <td className="px-3 py-2.5 text-slate-600">{r.motif || 'Retrait anticipé'}</td>
                        <td className="px-3 py-2.5 text-right font-black text-rose-700">
                          − {formatMoney(r.montant, parametres.devise)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={() => {
                              onDeleteRetrait(r.id);
                              toast.success('Retrait annulé.');
                            }}
                            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            title="Annuler ce retrait"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {retraits.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Aucun retrait partiel n'a encore été effectué cette année.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3 : Gestion des Membres */}
      {activeSection === 'membres' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Membres inscrits ({users.filter((u) => u.role === 'membre').length})</h3>
              <p className="text-xs text-slate-500">Pas d'inscription libre : c'est vous qui créez et gérez les comptes.</p>
            </div>
            <button
              onClick={() => setShowAddMemberModal(true)}
              className="btn btn-accent"
            >
              <Plus className="w-4 h-4" />
              Nouveau membre
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par nom ou numéro…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="field pl-10 text-sm"
              />
            </div>
            <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setMemberFilter('tous')}
                className={`min-h-11 shrink-0 cursor-pointer rounded-xl px-3 py-2 text-xs font-bold transition ${
                  memberFilter === 'tous' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tous
              </button>
              <button
                onClick={() => setMemberFilter('sans_smartphone')}
                className={`flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  memberFilter === 'sans_smartphone' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Sans smartphone
              </button>
              <button
                onClick={() => setMemberFilter('inactifs')}
                className={`min-h-11 shrink-0 cursor-pointer rounded-xl px-3 py-2 text-xs font-bold transition ${
                  memberFilter === 'inactifs' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Inactifs
              </button>
            </div>
          </div>

          {/* Membres : cartes empilées sur mobile */}
          <div className="space-y-2.5 sm:hidden">
            {filteredMembersList.map((m) => {
              const stats = calculateUserStats(m.id, versements, retraits, sundaysList, parametres.pourcentage_retenue);
              return (
                <article key={m.id} className="app-card p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-xs font-black text-amber-800">
                      {m.nom_complet.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-slate-900">{m.nom_complet}</p>
                        <span className={`badge ${m.statut === 'actif' ? 'badge-positive' : 'badge-neutral'}`}>
                          {m.statut}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500">{m.telephone}</p>
                      {!m.whatsapp_disponible && (
                        <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          Papier / SMS
                        </span>
                      )}
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-2.5 text-center">
                    <div>
                      <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Cotisé</dt>
                      <dd className="mt-0.5 text-[11px] font-bold tabular-nums text-slate-900">
                        {formatMoney(stats.totalVerse, parametres.devise)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Retraits</dt>
                      <dd className="mt-0.5 text-[11px] font-semibold tabular-nums text-rose-700">
                        {stats.totalRetire > 0 ? `− ${formatMoney(stats.totalRetire, parametres.devise)}` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Solde</dt>
                      <dd className="mt-0.5 text-[11px] font-black tabular-nums text-emerald-700">
                        {formatMoney(stats.soldeActuel, parametres.devise)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setSelectedMemberForReceipt(m)}
                      className="btn btn-outline btn-sm min-h-11 min-w-0 flex-1"
                      aria-label={`Relevé de ${m.nom_complet}`}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Relevé
                    </button>
                    <button
                      onClick={() => setSelectedMemberForWhatsApp(m)}
                      className="btn btn-outline btn-sm min-h-11 min-w-0 flex-1"
                      aria-label={`Message pour ${m.nom_complet}`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Message
                    </button>
                    <button
                      onClick={() => handleResetPassword(m)}
                      className="btn btn-outline btn-sm min-h-11"
                      aria-label={`Réinitialiser le mot de passe de ${m.nom_complet}`}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        onToggleUserStatus(m.id);
                        toast.success(m.statut === 'actif' ? 'Compte désactivé.' : 'Compte réactivé.');
                      }}
                      className={`btn btn-sm min-h-11 ${m.statut === 'actif' ? 'btn-ghost text-rose-600' : 'btn-ghost text-emerald-600'}`}
                      aria-label={m.statut === 'actif' ? `Désactiver ${m.nom_complet}` : `Réactiver ${m.nom_complet}`}
                    >
                      {m.statut === 'actif' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </article>
              );
            })}
            {filteredMembersList.length === 0 && (
              <p className="app-card px-4 py-8 text-center text-sm text-slate-400">Aucun membre trouvé.</p>
            )}
          </div>

          {/* Members Table */}
          <div className="app-card hidden overflow-hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                    <th className="py-3 px-4">Membre</th>
                    <th className="py-3 px-4">Téléphone</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 text-right">Total Cotisé</th>
                    <th className="py-3 px-4 text-right">Retraits</th>
                    <th className="py-3 px-4 text-right">Solde Caisse</th>
                    <th className="py-3 px-4 text-center">Actions rapides</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredMembersList.map((m) => {
                    const stats = calculateUserStats(m.id, versements, retraits, sundaysList, parametres.pourcentage_retenue);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0">
                              {m.nom_complet.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{m.nom_complet}</p>
                              {!m.whatsapp_disponible && (
                                <span className="inline-block text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded">
                                  Papier / SMS
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">{m.telephone}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              m.statut === 'actif'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {m.statut}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatMoney(stats.totalVerse, parametres.devise)}
                        </td>
                        <td className="py-3 px-4 text-right text-rose-700 font-semibold">
                          {stats.totalRetire > 0 ? `- ${formatMoney(stats.totalRetire, parametres.devise)}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-700">
                          {formatMoney(stats.soldeActuel, parametres.devise)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedMemberForReceipt(m)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                              title="Générer relevé imprimable / PDF"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setSelectedMemberForWhatsApp(m)}
                              className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition cursor-pointer"
                              title="Message WhatsApp ou SMS prêt à envoyer"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleResetPassword(m)}
                              className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition cursor-pointer"
                              title="Réinitialiser le mot de passe provisoire"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                onToggleUserStatus(m.id);
                                toast.success(m.statut === 'actif' ? 'Compte désactivé.' : 'Compte réactivé.');
                              }}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                m.statut === 'actif'
                                  ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              }`}
                              title={m.statut === 'actif' ? 'Désactiver le compte' : 'Réactiver le compte'}
                            >
                              {m.statut === 'actif' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4 : Clôture & Bilan Fêtes */}
      {activeSection === 'cloture' && (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
            <div>
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-full uppercase tracking-wider">
                Rapport de Clôture Annuelle
              </span>
              <h2 className="text-2xl sm:text-3xl font-black mt-2">Bilan Fêtes de Fin d'Année</h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
                Calcul automatique du montant net à rendre à chaque membre : Total versé moins les retraits déjà pris, moins {parametres.pourcentage_retenue}% de frais d'organisation pour l'église.
              </p>
            </div>

            <button
              onClick={() => window.print()}
              className="btn btn-accent btn-sheen"
            >
              <Printer className="w-4 h-4" />
              Imprimer le Bilan de Clôture
            </button>
          </div>

          <div className="app-card p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">État financier de restitution pour les Fêtes</h3>

            <div className="space-y-2.5 sm:hidden">
              {users.filter((u) => u.role === 'membre' && u.statut === 'actif').map((m) => {
                const stats = calculateUserStats(m.id, versements, retraits, sundaysList, parametres.pourcentage_retenue);
                return (
                  <article key={m.id} className="rounded-2xl border border-slate-200 bg-white p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{m.nom_complet}</p>
                        <p className="font-mono text-[11px] text-slate-500">{m.telephone}</p>
                      </div>
                      <p className="shrink-0 text-sm font-black tabular-nums text-emerald-700">
                        {formatMoney(stats.montantNetPrevisionnel, parametres.devise)}
                      </p>
                    </div>
                    <dl className="mt-2.5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5 text-center">
                      <div>
                        <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Cotisé</dt>
                        <dd className="text-[11px] font-semibold tabular-nums text-slate-700">
                          {formatMoney(stats.totalVerse, parametres.devise)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Retraits</dt>
                        <dd className="text-[11px] font-semibold tabular-nums text-rose-700">
                          {stats.totalRetire > 0 ? `− ${formatMoney(stats.totalRetire, parametres.devise)}` : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Église</dt>
                        <dd className="text-[11px] font-semibold tabular-nums text-amber-700">
                          {formatMoney(stats.partEglise, parametres.devise)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                );
              })}

              <article className="rounded-2xl bg-slate-900 p-4 text-white">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Totaux généraux</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-slate-400">Cotisé</p>
                    <p className="font-bold tabular-nums">{formatMoney(totalCotise, parametres.devise)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Retraits</p>
                    <p className="font-bold tabular-nums text-rose-300">− {formatMoney(totalRetraits, parametres.devise)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Frais église</p>
                    <p className="font-bold tabular-nums text-amber-300">{formatMoney(partEgliseTotale, parametres.devise)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Net fêtes</p>
                    <p className="font-black tabular-nums text-emerald-300">{formatMoney(netRestantPourFetes, parametres.devise)}</p>
                  </div>
                </div>
              </article>
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                    <th className="py-2.5 px-3">Membre</th>
                    <th className="py-2.5 px-3">Téléphone</th>
                    <th className="py-2.5 px-3 text-right">Total Cotisé</th>
                    <th className="py-2.5 px-3 text-right text-rose-700">Retraits pris</th>
                    <th className="py-2.5 px-3 text-right">Frais Église ({parametres.pourcentage_retenue}%)</th>
                    <th className="py-2.5 px-3 text-right text-emerald-800 font-bold">Reste Net Fêtes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {users.filter((u) => u.role === 'membre' && u.statut === 'actif').map((m) => {
                    const stats = calculateUserStats(m.id, versements, retraits, sundaysList, parametres.pourcentage_retenue);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{m.nom_complet}</td>
                        <td className="py-2 px-3 font-mono text-slate-500 text-xs">{m.telephone}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatMoney(stats.totalVerse, parametres.devise)}</td>
                        <td className="py-2 px-3 text-right text-rose-700 font-medium">
                          {stats.totalRetire > 0 ? `- ${formatMoney(stats.totalRetire, parametres.devise)}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-right text-amber-700">{formatMoney(stats.partEglise, parametres.devise)}</td>
                        <td className="py-2 px-3 text-right font-black text-emerald-700">{formatMoney(stats.montantNetPrevisionnel, parametres.devise)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black text-slate-900 text-sm border-t-2 border-slate-300">
                    <td className="py-3 px-3" colSpan={2}>TOTAUX GÉNÉRAUX</td>
                    <td className="py-3 px-3 text-right">{formatMoney(totalCotise, parametres.devise)}</td>
                    <td className="py-3 px-3 text-right text-rose-700">- {formatMoney(totalRetraits, parametres.devise)}</td>
                    <td className="py-3 px-3 text-right text-amber-800">{formatMoney(partEgliseTotale, parametres.devise)}</td>
                    <td className="py-3 px-3 text-right text-emerald-800">{formatMoney(netRestantPourFetes, parametres.devise)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5 : Analyses IA Administrateur */}
      {activeSection === 'ia_analyse' && (
        <div className="app-card p-6 sm:p-8 space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-500" />
              <h3 className="font-bold text-slate-900 text-lg">Analyses & Synthèses IA Administrateur</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Posez n'importe quelle question sur la tontine M.E.NO.JE. Les calculs sont strictement effectués par l'application et l'IA formule la réponse.
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
            <span className="font-bold text-slate-700 shrink-0">Suggestions :</span>
            <button
              onClick={() => {
                setAdminAiPrompt('Qui n’a rien donné depuis 4 dimanches ?');
                handleRunAdminAiAnalysis('Qui n’a rien donné depuis 4 dimanches ?');
              }}
              className="min-h-11 shrink-0 cursor-pointer rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 font-medium text-amber-900 transition hover:bg-amber-100"
            >
              📋 Qui n'a rien donné depuis 4 dimanches ?
            </button>
            <button
              onClick={() => {
                setAdminAiPrompt('Quel est le bilan des retraits partiels ?');
                handleRunAdminAiAnalysis('Quel est le bilan des retraits partiels ?');
              }}
              className="min-h-11 shrink-0 cursor-pointer rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 font-medium text-amber-900 transition hover:bg-amber-100"
            >
              💼 Bilan des retraits partiels
            </button>
            <button
              onClick={() => {
                setAdminAiPrompt('Résume l’évolution globale pour le bilan');
                handleRunAdminAiAnalysis('Résume l’évolution globale pour le bilan');
              }}
              className="min-h-11 shrink-0 cursor-pointer rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 font-medium text-amber-900 transition hover:bg-amber-100"
            >
              📈 Bilan synthétique
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={adminAiPrompt}
              onChange={(e) => setAdminAiPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunAdminAiAnalysis()}
              placeholder="Ex: Donne-moi le point sur les retraits et les cotisations…"
              className="field flex-1 text-sm"
            />
            <button
              onClick={() => handleRunAdminAiAnalysis()}
              disabled={isAiAnalyzing}
              className="btn btn-accent shrink-0"
            >
              <Send className="w-4 h-4" />
              {isAiAnalyzing ? 'Analyse…' : 'Analyser'}
            </button>
          </div>

          {adminAiResponse && (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
              {adminAiResponse}
            </div>
          )}
        </div>
      )}

      {/* SECTION 6 : Annonces */}
      {activeSection === 'annonces' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Fil des Annonces Tontine</h3>
              <p className="text-xs text-slate-500">Informations visibles sur le tableau de bord des membres.</p>
            </div>
            <button
              onClick={() => setShowAddAnnonceModal(true)}
              className="btn btn-accent shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nouvelle annonce
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {annonces.map((a) => (
              <div key={a.id} className="app-card p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        a.priorite === 'urgente'
                          ? 'bg-rose-100 text-rose-700'
                          : a.priorite === 'importante'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {a.priorite}
                    </span>
                    <button
                      onClick={() => {
                        onDeleteAnnonce(a.id);
                        toast.success('Annonce supprimée.');
                      }}
                      className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:text-rose-600"
                      aria-label={`Supprimer l'annonce « ${a.titre} »`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{a.titre}</h4>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-wrap">{a.contenu}</p>
                </div>
                <p className="text-[10px] text-slate-400 mt-4 border-t border-slate-100 pt-2">{a.date_publication}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 7 : Réglages */}
      {activeSection === 'reglages' && (
        <div className="app-card p-6 sm:p-8 max-w-2xl space-y-6">
          <h3 className="font-bold text-slate-900 text-lg">Réglages de la Tontine</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="pr-4">
                <p className="font-bold text-slate-900 text-sm">Afficher les montants dans le classement</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Si désactivé, seuls les flammes et badges s'affichent pour protéger la pudeur des familles.
                </p>
              </div>
              <button
                onClick={() => {
                  const next = !parametres.afficher_montants_classement;
                  onUpdateParametres({ afficher_montants_classement: next });
                  toast.success(next ? 'Montants visibles dans le classement.' : 'Montants masqués dans le classement.');
                }}
                role="switch"
                aria-checked={parametres.afficher_montants_classement}
                aria-label="Afficher les montants dans le classement"
                className={`flex h-6 w-12 cursor-pointer items-center rounded-full p-1 transition ${
                  parametres.afficher_montants_classement ? 'justify-end bg-emerald-500' : 'justify-start bg-slate-300'
                }`}
              >
                <div className="bg-white w-4 h-4 rounded-full shadow-md" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900 text-sm">Frais de gestion église ({parametres.pourcentage_retenue}%)</p>
                <p className="text-xs text-slate-500">Pourcentage retenu sur le total versé à la fin de l'exercice.</p>
              </div>
              {apiMode ? (
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={parametres.pourcentage_retenue}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (Number.isFinite(next) && next >= 0 && next <= 100) {
                      onUpdateParametres({ pourcentage_retenue: next });
                    }
                  }}
                  aria-label="Pourcentage de retenue de l'église"
                  className="field w-24 text-center text-sm font-bold"
                />
              ) : (
                <span className="font-mono font-bold text-slate-800 text-sm bg-white px-3 py-1 rounded-xl border border-slate-300">
                  {parametres.pourcentage_retenue} %
                </span>
              )}
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 text-sm">Devise monétaire</p>
                <p className="text-xs text-slate-500">Symbole affiché sur les relevés.</p>
              </div>
              <input
                type="text"
                value={parametres.devise}
                onChange={(e) => onUpdateParametres({ devise: e.target.value })}
                aria-label="Devise monétaire"
                className="field w-24 text-center text-sm font-bold"
              />
            </div>

            {apiMode ? (
              <SessionsCard
                sessions={sessions}
                devise={parametres.devise}
                onOpen={onOpenSession ?? (async () => ({ ok: false, message: 'Action indisponible.' }))}
                onClose={onCloseSession ?? (async () => ({ ok: false, message: 'Action indisponible.' }))}
                onReopen={onReopenSession ?? (async () => ({ ok: false, message: 'Action indisponible.' }))}
              />
            ) : (
              <SundayManager
                sundaysList={sundaysList}
                versements={versements}
                onAddSunday={onAddSunday}
                onDeleteSunday={onDeleteSunday}
              />
            )}

            <BackupCard
              data={{ users, versements, retraits, sundaysList, annonces, parametres }}
              onRestore={onRestoreData}
              onExportJson={onExportBackup}
              onExportCsv={onExportCsv}
              canRestore={!apiMode}
              hint={
                apiMode
                  ? 'Les exports sont générés par le serveur à partir de la base de données de l’église.'
                  : undefined
              }
            />
          </div>
        </div>
      )}
      </div>

      {/* Modal Relevé Individuel Imprimable */}
      {selectedMemberForReceipt && (
        <ReceiptModal
          member={selectedMemberForReceipt}
          stats={calculateUserStats(selectedMemberForReceipt.id, versements, retraits, sundaysList, parametres.pourcentage_retenue)}
          versements={versements}
          retraits={retraits}
          devise={parametres.devise}
          nomEglise={parametres.nom_eglise}
          tauxRetenue={parametres.pourcentage_retenue}
          onClose={() => setSelectedMemberForReceipt(null)}
        />
      )}

      {/* Modal WhatsApp / SMS */}
      {selectedMemberForWhatsApp && (
        <WhatsAppModal
          member={selectedMemberForWhatsApp}
          stats={calculateUserStats(selectedMemberForWhatsApp.id, versements, retraits, sundaysList, parametres.pourcentage_retenue)}
          devise={parametres.devise}
          nomEglise={parametres.nom_eglise}
          tauxRetenue={parametres.pourcentage_retenue}
          onClose={() => setSelectedMemberForWhatsApp(null)}
        />
      )}

      {/* Modal Mot de passe provisoire */}
      {tempPasswordModal && (
        <Modal
          open
          onClose={() => setTempPasswordModal(null)}
          title="Nouveau mot de passe temporaire"
          size="sm"
          footer={
            <button
              onClick={() => setTempPasswordModal(null)}
              className="btn btn-primary w-full"
            >
              Fermer
            </button>
          }
        >
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
              <KeyRound className="h-6 w-6" />
            </div>
            <p className="text-xs text-slate-600">
              Transmettez ce mot de passe provisoire à <strong>{tempPasswordModal.memberName}</strong> :
            </p>
            <div className="rounded-xl bg-slate-100 p-3 font-mono text-lg font-bold tracking-wider text-slate-900">
              {tempPasswordModal.pass}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Créer Nouveau Membre */}
      {showAddMemberModal && (
        <Modal
          open
          onClose={() => setShowAddMemberModal(false)}
          title="Inscrire un nouveau membre"
          description="Pas d'inscription libre : le compte est créé par le secrétariat."
        >
          <form onSubmit={handleCreateMember} className="space-y-3">
            <div>
              <label className="field-label" htmlFor="new-member-name">Nom complet</label>
              <input
                id="new-member-name"
                type="text"
                placeholder="Ex: Marc Koffi"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="field"
                required
              />
            </div>

            <div>
              <label className="field-label" htmlFor="new-member-phone">Numéro de téléphone</label>
              <input
                id="new-member-phone"
                type="tel"
                inputMode="tel"
                placeholder="Ex: +225 07 12 34 56"
                value={newMemberPhone}
                onChange={(e) => setNewMemberPhone(e.target.value)}
                className="field"
                required
              />
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="wa_check"
                checked={newMemberWhatsapp}
                onChange={(e) => setNewMemberWhatsapp(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-amber-500"
              />
              <label htmlFor="wa_check" className="text-xs font-medium text-slate-700">
                Possède un smartphone / WhatsApp (décocher si aîné sans smartphone)
              </label>
            </div>

            <div>
              <label className="field-label" htmlFor="new-member-notes">Notes (optionnel)</label>
              <input
                id="new-member-notes"
                type="text"
                placeholder="Ex: Ne vient pas le dimanche, verse par Mobile Money"
                value={newMemberNotes}
                onChange={(e) => setNewMemberNotes(e.target.value)}
                className="field"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="btn btn-ghost"
              >
                Annuler
              </button>
              <button type="submit" className="btn btn-accent">
                Créer le compte
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Créer Annonce */}
      {showAddAnnonceModal && (
        <Modal
          open
          onClose={() => setShowAddAnnonceModal(false)}
          title="Publier une annonce"
          description="Visible immédiatement sur le tableau de bord des membres."
        >
          <div className="space-y-3">
            <div>
              <label className="field-label" htmlFor="annonce-titre">Titre</label>
              <input
                id="annonce-titre"
                type="text"
                value={annonceTitre}
                onChange={(e) => setAnnonceTitre(e.target.value)}
                className="field"
                placeholder="Ex: Clôture des cotisations fin novembre"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="annonce-priorite">Priorité</label>
              <select
                id="annonce-priorite"
                value={annoncePriorite}
                onChange={(e) => setAnnoncePriorite(e.target.value as 'normale' | 'importante' | 'urgente')}
                className="field"
              >
                <option value="normale">Normale (bleu)</option>
                <option value="importante">Importante (or)</option>
                <option value="urgente">Urgente (rouge)</option>
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="annonce-contenu">Message</label>
              <textarea
                id="annonce-contenu"
                rows={4}
                value={annonceContenu}
                onChange={(e) => setAnnonceContenu(e.target.value)}
                className="field"
                placeholder="Message pour les membres…"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddAnnonceModal(false)}
                className="btn btn-ghost"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (!annonceTitre.trim() || !annonceContenu.trim()) {
                    toast.error('Renseignez un titre et un message.');
                    return;
                  }
                  onAddAnnonce({
                    titre: annonceTitre.trim(),
                    contenu: annonceContenu.trim(),
                    priorite: annoncePriorite,
                    publie_par: currentUser.id,
                  });
                  setShowAddAnnonceModal(false);
                  setAnnonceTitre('');
                  setAnnonceContenu('');
                  toast.success('Annonce publiée.');
                }}
                className="btn btn-accent"
              >
                Publier
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Pavé de collecte : un membre, un montant, enregistrement immédiat */}
      {collecteMember && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="collecte-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeCollecte();
          }}
        >
          <div className="animate-pop my-auto w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="relative bg-slate-900 px-5 pb-4 pt-5 text-white">
              <button
                type="button"
                onClick={closeCollecte}
                aria-label="Fermer la saisie"
                className="absolute right-3 top-3 rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 pr-10">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-sm font-black text-slate-950">
                  {memberInitials(collecteMember.nom_complet)}
                </span>
                <div className="min-w-0">
                  <p id="collecte-title" className="truncate text-base font-black leading-tight">
                    {collecteMember.nom_complet}
                  </p>
                  <p className="truncate text-[11px] text-slate-300">
                    {collecteMember.telephone} · {formatDateFr(selectedSunday)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between gap-3 rounded-2xl bg-white/5 px-3.5 py-2.5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cumul du membre</p>
                  <p className="text-sm font-black tabular-nums text-amber-400">
                    {formatMoney(collecteCumul, parametres.devise)}
                  </p>
                </div>
                {collecteLast && (
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dernier</p>
                    <p className="text-[11px] font-bold text-slate-200">
                      {formatMoney(collecteLast.montant, parametres.devise)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div>
                <label
                  htmlFor="collecte-amount"
                  className="text-[11px] font-bold uppercase tracking-wider text-slate-400"
                >
                  Montant reçu ce dimanche
                </label>
                <div
                  className={`mt-1.5 flex items-baseline gap-2 rounded-2xl border-2 px-4 py-3 transition ${
                    collecteError
                      ? 'border-rose-400 bg-rose-50'
                      : 'border-amber-400 bg-amber-50/60 focus-within:ring-4 focus-within:ring-amber-500/15'
                  }`}
                >
                  <input
                    id="collecte-amount"
                    type="text"
                    inputMode="numeric"
                    enterKeyHint="done"
                    autoComplete="off"
                    autoFocus
                    value={collecteAmount}
                    onChange={(event) => {
                      setCollecteAmount(event.target.value.replace(/[^0-9\s]/g, '').slice(0, 12));
                      setCollecteError(false);
                    }}
                    onFocus={(event) => event.currentTarget.select()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        saveCollecte(true);
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        closeCollecte();
                      }
                    }}
                    placeholder="0"
                    aria-describedby="collecte-help"
                    className="w-full min-w-0 bg-transparent text-3xl font-black tabular-nums text-slate-900 placeholder:text-slate-300 focus:outline-none"
                  />
                  <span className="shrink-0 text-xs font-bold text-slate-500">{parametres.devise}</span>
                </div>
                <p
                  id="collecte-help"
                  className={`mt-1.5 text-[11px] ${collecteError ? 'font-bold text-rose-600' : 'text-slate-400'}`}
                >
                  {collecteError
                    ? 'Entrez un montant supérieur à 0.'
                    : 'Montant remis en main propre : il sert de preuve de suivi, pas de paiement.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {collecteLast && (
                  <button
                    type="button"
                    onClick={() => {
                      setCollecteAmount(String(collecteLast.montant));
                      setCollecteError(false);
                      vibrate(8);
                    }}
                    className="min-h-11 cursor-pointer rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-800 transition hover:bg-amber-100"
                  >
                    Comme la dernière fois · {formatMoney(collecteLast.montant, parametres.devise)}
                  </button>
                )}
                {[1000, 2000, 5000, 10000].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => {
                      setCollecteAmount(String(amount));
                      setCollecteError(false);
                      vibrate(8);
                    }}
                    className="min-h-11 cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold tabular-nums text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    {new Intl.NumberFormat('fr-FR').format(amount)}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => saveCollecte(false)}
                  className="btn btn-outline"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => saveCollecte(true)}
                  className="btn btn-accent btn-sheen"
                >
                  Enregistrer et suivant
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <p className="text-center text-[10px] leading-relaxed text-slate-400">
                « Suivant » enregistre et ouvre le prochain membre non noté.
              </p>

              {collecteSaved && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteVersement(collecteSaved.id);
                    closeCollecte();
                    toast.success('Montant supprimé pour ce dimanche.');
                  }}
                  className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer le montant de ce dimanche
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
