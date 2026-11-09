import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { User, Versement, Retrait, Annonce, ParametresApp, AppData } from './types';
import {
  INITIAL_USERS,
  SUNDAYS_LIST,
  generateInitialVersements,
  INITIAL_RETRAITS,
  INITIAL_ANNONCES,
  DEFAULT_PARAMETRES,
} from './data/mockData';
import { LoginScreen } from './components/LoginScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { MemberDashboard } from './components/MemberDashboard';
import { LeaderboardDuolingo } from './components/LeaderboardDuolingo';
import { TechGuideModal } from './components/TechGuideModal';
import { ThemeToggle } from './components/ThemeToggle';
import { PageTransition } from './components/motion/PageTransition';
import { useToast } from './components/ui/Toast';
import { clearStoredState, usePersistentState } from './hooks/usePersistentState';
import { formatDateFr, upsertVersements } from './utils/tontineUtils';
import {
  Church,
  Code2,
  LogOut,
  Flame,
  ChevronDown,
  Smartphone,
  ShieldCheck,
  LayoutDashboard,
  Download,
  UserRound,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function App() {
  // Données de l'application (persistées dans le localStorage)
  const [users, setUsers] = usePersistentState<User[]>('users', INITIAL_USERS);
  const [versements, setVersements] = usePersistentState<Versement[]>('versements', generateInitialVersements);
  const [retraits, setRetraits] = usePersistentState<Retrait[]>('retraits', INITIAL_RETRAITS);
  const [sundaysList, setSundaysList] = usePersistentState<string[]>('sundays', SUNDAYS_LIST);
  const [annonces, setAnnonces] = usePersistentState<Annonce[]>('annonces', INITIAL_ANNONCES);
  const [parametres, setParametres] = usePersistentState<ParametresApp>('parametres', DEFAULT_PARAMETRES);

  // Authentification : identifiant de l'utilisateur connecté (null = écran de connexion)
  // Par défaut, l'application démarre sur la page de connexion.
  const [currentUserId, setCurrentUserId] = usePersistentState<number | null>('currentUserId', null);
  const currentUser = currentUserId === null ? null : users.find((u) => u.id === currentUserId && u.statut === 'actif') ?? null;

  // Navigation principale
  const [activeTab, setActiveTab] = useState<'dashboard' | 'classement'>('dashboard');
  const [showTechGuide, setShowTechGuide] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Capture l'invite d'installation PWA du navigateur (Chrome / Edge / Android)
  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  // Ferme le menu profil avec Échap ou un clic en dehors.
  useEffect(() => {
    if (!isProfileDropdownOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsProfileDropdownOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [isProfileDropdownOpen]);

  // Handlers Versements
  // `upsertVersements` garantit un seul versement par membre et par dimanche :
  // une nouvelle saisie met à jour l'existant au lieu de créer un doublon.
  const handleAddVersement = (v: Omit<Versement, 'id' | 'created_at'>) => {
    const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
    setVersements((prev) => upsertVersements(prev, [v], createdAt));
  };

  const handleAddBatchVersements = (items: Array<Omit<Versement, 'id' | 'created_at'>>) => {
    const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
    setVersements((prev) => upsertVersements(prev, items, createdAt));
  };

  const handleDeleteVersement = (id: number) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce versement ?')) {
      setVersements((prev) => prev.filter((v) => v.id !== id));
    }
  };

  // Handlers Retraits Partiels
  const handleAddRetrait = (r: Omit<Retrait, 'id' | 'created_at'>) => {
    const newId = retraits.length > 0 ? Math.max(...retraits.map((x) => x.id)) + 1 : 1;
    const newEntry: Retrait = {
      ...r,
      id: newId,
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    setRetraits((prev) => [newEntry, ...prev]);
  };

  const handleDeleteRetrait = (id: number) => {
    if (window.confirm('Voulez-vous annuler ce retrait partiel ?')) {
      setRetraits((prev) => prev.filter((r) => r.id !== id));
    }
  };

  // Handlers Utilisateurs
  const handleAddUser = (u: Omit<User, 'id' | 'created_at'>) => {
    const newId = users.length > 0 ? Math.max(...users.map((x) => x.id)) + 1 : 1;
    const newUser: User = {
      ...u,
      id: newId,
      created_at: new Date().toISOString().split('T')[0],
    };
    setUsers((prev) => [...prev, newUser]);
  };

  const handleToggleUserStatus = (userId: number) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            statut: u.statut === 'actif' ? 'inactif' : 'actif',
          };
        }
        return u;
      })
    );
  };

  const handleResetUserPassword = (userId: number) => {
    const tempPass = 'Menoje' + Math.floor(1000 + Math.random() * 9000);
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            password: tempPass,
            must_change_password: true,
          };
        }
        return u;
      })
    );
    return tempPass;
  };

  const handleUpdateUserPassword = (userId: number, newPassword: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            password: newPassword,
            must_change_password: false,
          };
        }
        return u;
      })
    );
  };

  // Handlers Annonces
  const handleAddAnnonce = (a: Omit<Annonce, 'id' | 'date_publication'>) => {
    const newId = annonces.length > 0 ? Math.max(...annonces.map((x) => x.id)) + 1 : 1;
    const now = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }) + ' ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const newA: Annonce = {
      ...a,
      id: newId,
      date_publication: now,
    };
    setAnnonces((prev) => [newA, ...prev]);
  };

  const handleDeleteAnnonce = (id: number) => {
    setAnnonces((prev) => prev.filter((a) => a.id !== id));
  };

  const handleUpdateParametres = (p: Partial<ParametresApp>) => {
    setParametres((prev) => ({ ...prev, ...p }));
  };

  const handleInstallPwa = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      toast.success(
        choice.outcome === 'accepted'
          ? 'Application installée sur votre appareil.'
          : 'Installation annulée.'
      );
      return;
    }
    toast.info('Sur Android : menu du navigateur puis « Ajouter à l’écran d’accueil ».');
  };

  const handleResetDemoData = () => {
    if (!window.confirm('Réinitialiser toutes les données de démonstration ? Cette action est irréversible.')) {
      return;
    }
    clearStoredState();
    window.location.reload();
  };

  const handleRestoreData = (data: AppData) => {
    setUsers(data.users);
    setVersements(data.versements);
    setRetraits(data.retraits);
    setSundaysList(data.sundaysList);
    setAnnonces(data.annonces);
    setParametres(data.parametres);
    if (currentUserId !== null && !data.users.some((user) => user.id === currentUserId)) {
      setCurrentUserId(null);
    }
    toast.success('Sauvegarde restaurée avec succès.');
  };

  const handleAddSunday = (date: string): { ok: boolean; message: string } => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, message: 'Choisissez une date valide.' };
    }
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, message: 'Date invalide.' };
    }
    if (parsed.getDay() !== 0) {
      return { ok: false, message: 'La date choisie n’est pas un dimanche.' };
    }
    if (sundaysList.includes(date)) {
      return { ok: false, message: 'Ce dimanche figure déjà dans le calendrier.' };
    }
    setSundaysList((prev) => [...prev, date].sort());
    return { ok: true, message: `${formatDateFr(date)} ajouté au calendrier.` };
  };

  const handleDeleteSunday = (date: string): { ok: boolean; message: string } => {
    if (versements.some((versement) => versement.date_dimanche === date)) {
      return { ok: false, message: 'Des versements sont rattachés à ce dimanche : suppression refusée.' };
    }
    setSundaysList((prev) => prev.filter((sunday) => sunday !== date));
    return { ok: true, message: `${formatDateFr(date)} retiré du calendrier.` };
  };

  // Si l'utilisateur n'est pas connecté, afficher l'écran de connexion !
  if (!currentUser) {
    return (
      <LoginScreen
        users={users}
        onLoginSuccess={(user) => setCurrentUserId(user.id)}
        nomEglise={parametres.nom_eglise}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col text-slate-800 selection:bg-amber-500 selection:text-slate-950">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-xl focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Aller au contenu principal
      </a>

      {/* En-tête */}
      <header className="app-header sticky top-0 z-40 print:hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-[72px] items-center justify-between gap-3">
            {/* Identité */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/25">
                <Church className="h-5 w-5" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex-1 truncate font-display text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                    <span className="hidden sm:inline">Tontine </span>
                    {parametres.nom_eglise}
                  </span>
                  <span className="app-chip hidden bg-amber-100 text-amber-800 sm:inline-flex">
                    Fêtes 2026
                  </span>
                </div>
                <p className="hidden truncate text-[11px] text-slate-500 sm:block">
                  Épargne du dimanche · Fêtes sans soucis
                </p>
              </div>
            </div>

            {/* Navigation desktop */}
            <nav
              aria-label="Navigation principale"
              className="hidden items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50/80 p-1 md:flex"
            >
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                aria-current={activeTab === 'dashboard' ? 'page' : undefined}
                className={`flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-xs font-bold transition ${
                  activeTab === 'dashboard'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                {currentUser.role === 'admin' ? 'Pilotage' : 'Mon espace'}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('classement')}
                aria-current={activeTab === 'classement' ? 'page' : undefined}
                className={`flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-xs font-bold transition ${
                  activeTab === 'classement'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Flame className="h-4 w-4" />
                Classement
              </button>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleInstallPwa}
                className="btn btn-outline btn-sm hidden text-emerald-700 lg:inline-flex"
                title="Installer l'application sur smartphone (PWA)"
              >
                <Download className="h-4 w-4" />
                Installer
              </button>

              <ThemeToggle />

              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  aria-haspopup="menu"
                  aria-expanded={isProfileDropdownOpen}
                  aria-label="Menu du compte"
                  className="flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 pl-1.5 pr-2.5 transition hover:bg-white"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold ${
                      currentUser.role === 'admin'
                        ? 'bg-gradient-to-br from-violet-500 to-violet-700 text-white'
                        : 'bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950'
                    }`}
                  >
                    {currentUser.role === 'admin' ? 'A' : currentUser.nom_complet.charAt(0)}
                  </span>
                  <span className="hidden text-left xl:block">
                    <span className="block max-w-[110px] truncate text-xs font-bold leading-tight text-slate-800">
                      {currentUser.nom_complet}
                    </span>
                    <span className="block text-[10px] capitalize text-slate-400">{currentUser.role}</span>
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${isProfileDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {isProfileDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute right-0 z-50 mt-3 max-h-[80vh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-slate-100 bg-white p-2 shadow-2xl"
                    >
                      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 font-bold backdrop-blur">
                            {currentUser.role === 'admin' ? 'A' : currentUser.nom_complet.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{currentUser.nom_complet}</p>
                            <p className="truncate font-mono text-[11px] text-slate-300">
                              {currentUser.telephone}
                            </p>
                            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                              <ShieldCheck className="h-3 w-3" />
                              {currentUser.role === 'admin' ? 'Administrateur' : 'Membre'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 p-2">
                        <button
                          onClick={() => {
                            handleInstallPwa();
                            setIsProfileDropdownOpen(false);
                          }}
                          className="flex w-full cursor-pointer items-center gap-2.5 min-h-11 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Smartphone className="h-4 w-4 text-emerald-600" />
                          Installer l'application
                        </button>
                        <button
                          onClick={() => {
                            setShowTechGuide(true);
                            setIsProfileDropdownOpen(false);
                          }}
                          className="flex w-full cursor-pointer items-center gap-2.5 min-h-11 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Code2 className="h-4 w-4 text-amber-600" />
                          Code PHP & SQL
                        </button>
                        <button
                          onClick={() => {
                            setCurrentUserId(null);
                            setIsProfileDropdownOpen(false);
                          }}
                          className="flex w-full cursor-pointer items-center gap-2.5 min-h-11 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-rose-700 transition hover:bg-rose-50"
                        >
                          <LogOut className="h-4 w-4" />
                          Se déconnecter
                        </button>
                      </div>

                      <div className="border-t border-slate-100 px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Changer de compte (démo)
                      </div>

                      <div className="py-1">
                        <button
                          onClick={() => {
                            setCurrentUserId(users[0].id);
                            setIsProfileDropdownOpen(false);
                          }}
                          className={`flex w-full cursor-pointer items-center gap-2.5 min-h-11 rounded-xl px-3 py-2 text-left text-xs transition hover:bg-slate-50 ${
                            currentUser.id === users[0].id
                              ? 'bg-violet-50 font-bold text-violet-900'
                              : 'text-slate-700'
                          }`}
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-[10px] font-bold text-white">
                            AD
                          </span>
                          <span className="truncate font-semibold">Pasteur Emmanuel (Admin)</span>
                        </button>

                        {users.slice(1, 8).map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setCurrentUserId(m.id);
                              setIsProfileDropdownOpen(false);
                            }}
                            className={`flex w-full cursor-pointer items-center gap-2.5 min-h-11 rounded-xl px-3 py-2 text-left text-xs transition hover:bg-slate-50 ${
                              currentUser.id === m.id
                                ? 'bg-amber-50 font-bold text-amber-900'
                                : 'text-slate-700'
                            }`}
                          >
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-[10px] font-bold text-amber-800">
                              {m.nom_complet.charAt(0)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-slate-900">
                                {m.nom_complet}
                              </span>
                              <span className="block text-[10px] text-slate-400">{m.telephone}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main
        id="main-content"
        className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-5 sm:px-6 sm:pt-7 md:pb-8 lg:px-8"
      >
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={activeTab}>
            {activeTab === 'classement' ? (
              <LeaderboardDuolingo
                users={users}
                versements={versements}
                retraits={retraits}
                sundaysList={sundaysList}
                parametres={parametres}
                currentUserId={currentUser.id}
              />
            ) : currentUser.role === 'admin' ? (
              <AdminDashboard
                currentUser={currentUser}
                users={users}
                versements={versements}
                retraits={retraits}
                sundaysList={sundaysList}
                annonces={annonces}
                parametres={parametres}
                onAddVersement={handleAddVersement}
                onAddBatchVersements={handleAddBatchVersements}
                onDeleteVersement={handleDeleteVersement}
                onAddRetrait={handleAddRetrait}
                onDeleteRetrait={handleDeleteRetrait}
                onAddUser={handleAddUser}
                onToggleUserStatus={handleToggleUserStatus}
                onResetUserPassword={handleResetUserPassword}
                onAddAnnonce={handleAddAnnonce}
                onDeleteAnnonce={handleDeleteAnnonce}
                onUpdateParametres={handleUpdateParametres}
                onRestoreData={handleRestoreData}
                onAddSunday={handleAddSunday}
                onDeleteSunday={handleDeleteSunday}
              />
            ) : (
              <MemberDashboard
                currentUser={currentUser}
                allVersements={versements}
                allRetraits={retraits}
                sundaysList={sundaysList}
                annonces={annonces}
                parametres={parametres}
                onUpdateUserPassword={handleUpdateUserPassword}
              />
            )}
          </PageTransition>
        </AnimatePresence>
      </main>

      {/* Navigation mobile */}
      <nav
        aria-label="Navigation mobile"
        className="mobile-nav fixed inset-x-0 bottom-0 z-40 md:hidden print:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            aria-current={activeTab === 'dashboard' ? 'page' : undefined}
            className="mobile-nav-item cursor-pointer"
          >
            <LayoutDashboard className="h-5 w-5" />
            {currentUser.role === 'admin' ? 'Pilotage' : 'Espace'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('classement')}
            aria-current={activeTab === 'classement' ? 'page' : undefined}
            className="mobile-nav-item cursor-pointer"
          >
            <Flame className="h-5 w-5" />
            Classement
          </button>

          <button
            type="button"
            onClick={() => {
              setIsProfileDropdownOpen(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="mobile-nav-item cursor-pointer"
          >
            <UserRound className="h-5 w-5" />
            Compte
          </button>
        </div>
      </nav>

      {/* Guide technique */}
      {showTechGuide && <TechGuideModal onClose={() => setShowTechGuide(false)} />}

      {/* Pied de page */}
      <footer className="mt-auto print:hidden">
        <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 md:pb-6 lg:px-8">
          <div className="app-card flex flex-col items-center justify-between gap-3 rounded-2xl px-5 py-4 text-xs sm:flex-row">
            <div className="flex items-center gap-2.5 text-slate-500">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
                <Church className="h-3.5 w-3.5" />
              </span>
              <span>
                Tontine <strong className="text-slate-700">{parametres.nom_eglise}</strong> 2026 · Fêtes
                sans soucis
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <button
                onClick={() => setShowTechGuide(true)}
                className="cursor-pointer font-bold text-amber-600 hover:underline"
              >
                Code PHP/MySQL
              </button>
              {currentUser.role === 'admin' && (
                <button
                  onClick={handleResetDemoData}
                  className="cursor-pointer font-bold text-rose-600 hover:underline"
                >
                  Réinitialiser la démo
                </button>
              )}
              <span className="hidden text-slate-300 sm:inline">•</span>
              <span className="text-[11px] text-slate-400">
                Connecté : <strong className="text-slate-600">{currentUser.nom_complet}</strong>
              </span>
              <button
                onClick={() => setCurrentUserId(null)}
                className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                <LogOut className="h-3.5 w-3.5" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
