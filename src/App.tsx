import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  User,
  Versement,
  Retrait,
  Annonce,
  ParametresApp,
  AppData,
  UserStats,
  ClassementEntry,
  Badge,
  SessionSummary,
} from './types';
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
  api,
  clearToken,
  errorMessage,
  getToken,
  isApiMode,
  setToken,
  UNAUTHORIZED_EVENT,
} from './api/client';
import {
  toAnnonce,
  toBackupData,
  toBadge,
  toClassementEntry,
  toParametres,
  toReglagesPatch,
  toRetrait,
  toSessionSummary,
  toStats,
  toUser,
  toVersement,
} from './api/mappers';
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
  Loader2,
  UserRound,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function App() {
  // Données de l'application. En mode API, elles viennent du serveur et la
  // persistance locale est désactivée (`enabled = false`).
  const [users, setUsers] = usePersistentState<User[]>(
    'users',
    isApiMode ? [] : INITIAL_USERS,
    !isApiMode
  );
  const [versements, setVersements] = usePersistentState<Versement[]>(
    'versements',
    isApiMode ? [] : generateInitialVersements,
    !isApiMode
  );
  const [retraits, setRetraits] = usePersistentState<Retrait[]>(
    'retraits',
    isApiMode ? [] : INITIAL_RETRAITS,
    !isApiMode
  );
  const [sundaysList, setSundaysList] = usePersistentState<string[]>(
    'sundays',
    isApiMode ? [] : SUNDAYS_LIST,
    !isApiMode
  );
  const [annonces, setAnnonces] = usePersistentState<Annonce[]>(
    'annonces',
    isApiMode ? [] : INITIAL_ANNONCES,
    !isApiMode
  );
  const [parametres, setParametres] = usePersistentState<ParametresApp>(
    'parametres',
    DEFAULT_PARAMETRES,
    !isApiMode
  );

  // Authentification démo : identifiant de l'utilisateur connecté.
  const [currentUserId, setCurrentUserId] = usePersistentState<number | null>(
    'currentUserId',
    null,
    !isApiMode
  );

  // État du mode API
  const [apiUser, setApiUser] = useState<User | null>(null);
  const [apiStats, setApiStats] = useState<UserStats | undefined>(undefined);
  const [serverClassement, setServerClassement] = useState<ClassementEntry[] | undefined>(undefined);
  const [serverBadges, setServerBadges] = useState<Badge[] | undefined>(undefined);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [booting, setBooting] = useState(isApiMode && Boolean(getToken()));
  const [busyCount, setBusyCount] = useState(0);

  const currentUser = isApiMode
    ? apiUser
    : currentUserId === null
    ? null
    : users.find((u) => u.id === currentUserId && u.statut === 'actif') ?? null;

  // Navigation principale
  const [activeTab, setActiveTab] = useState<'dashboard' | 'classement'>('dashboard');
  const [showTechGuide, setShowTechGuide] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const reglagesTimer = useRef<number | null>(null);
  const toast = useToast();

  // Exécute une action serveur en affichant la barre de progression globale.
  const withBusy = useCallback(async <T,>(task: () => Promise<T>): Promise<T> => {
    setBusyCount((count) => count + 1);
    try {
      return await task();
    } finally {
      setBusyCount((count) => Math.max(0, count - 1));
    }
  }, []);

  // Chargement complet côté administrateur : la sauvegarde serveur a le format du front.
  const loadAdminData = useCallback(async () => {
    const [backup, sessionsResponse] = await Promise.all([api.backup(), api.sessions()]);
    const data = toBackupData(backup);
    setUsers(data.users);
    setVersements(data.versements);
    setRetraits(data.retraits);
    setSundaysList(data.sundaysList);
    setAnnonces(data.annonces);
    setParametres(data.parametres);
    setSessions(sessionsResponse.sessions.map(toSessionSummary));
  }, [setUsers, setVersements, setRetraits, setSundaysList, setAnnonces, setParametres]);

  // Chargement du relevé personnel côté membre.
  const loadMemberData = useCallback(
    async (userId: number) => {
      const [releve, classementResponse, annoncesResponse, reglagesResponse] = await Promise.all([
        api.releve(),
        api.classement(),
        api.annonces(),
        api.reglages(),
      ]);

      setVersements(releve.versements.map((versement) => toVersement(versement, userId)));
      setRetraits(releve.retraits.map((retrait) => toRetrait(retrait, userId)));
      setSundaysList(Array.from(new Set(releve.versements.map((versement) => versement.date))).sort());
      setAnnonces(annoncesResponse.annonces.map(toAnnonce));
      setParametres(toParametres(reglagesResponse.reglages));
      setApiStats(toStats(releve.stats));
      setServerClassement(classementResponse.classement.map(toClassementEntry));
      setServerBadges(classementResponse.badges.map((badge, index) => toBadge(badge, index)));
    },
    [setVersements, setRetraits, setSundaysList, setAnnonces, setParametres]
  );

  const refreshForUser = useCallback(
    async (user: User) => {
      if (user.role === 'admin') await loadAdminData();
      else await loadMemberData(user.id);
    },
    [loadAdminData, loadMemberData]
  );

  // Reprise de session au démarrage : le jeton est conservé dans le localStorage.
  useEffect(() => {
    if (!isApiMode) return;
    if (!getToken()) {
      setBooting(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const me = await api.me();
        const user = toUser(me.user);
        if (cancelled) return;
        setApiUser(user);
        setParametres(toParametres(me.reglages));
        if (user.role === 'membre') setApiStats(toStats(me.stats));
        await refreshForUser(user);
      } catch (error) {
        clearToken();
        if (!cancelled) toast.error(errorMessage(error));
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jeton rejeté par le serveur : retour à l'écran de connexion.
  useEffect(() => {
    if (!isApiMode) return;
    const onUnauthorized = () => {
      setApiUser(null);
      setApiStats(undefined);
      setServerClassement(undefined);
      setServerBadges(undefined);
      setSessions([]);
      toast.info('Votre session a expiré. Veuillez vous reconnecter.');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (reglagesTimer.current !== null) window.clearTimeout(reglagesTimer.current);
    };
  }, []);

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

  const handleApiLogin = async (telephone: string, password: string) => {
    const response = await withBusy(() => api.login(telephone, password));
    setToken(response.token);
    const user = toUser(response.user);
    setApiUser(user);
    await withBusy(() => refreshForUser(user));
  };

  const handleLogout = async () => {
    setIsProfileDropdownOpen(false);
    if (!isApiMode) {
      setCurrentUserId(null);
      return;
    }
    try {
      await api.logout();
    } catch {
      // Jeton déjà invalide : on nettoie quand même la session locale.
    }
    clearToken();
    setApiUser(null);
    setApiStats(undefined);
    setServerClassement(undefined);
    setServerBadges(undefined);
    setSessions([]);
  };

  // Handlers Versements
  // En démo, `upsertVersements` garantit un seul versement par membre et par
  // dimanche. En mode API, l'invariant est garanti par le serveur.
  const handleAddVersement = async (
    v: Omit<Versement, 'id' | 'created_at'>
  ): Promise<boolean | void> => {
    if (!isApiMode) {
      const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
      setVersements((prev) => upsertVersements(prev, [v], createdAt));
      return;
    }

    return withBusy(async () => {
      try {
        const existing = sessions.find((session) => session.date === v.date_dimanche);
        if (existing && existing.statut === 'fermee') {
          toast.error('Dimanche fermé : rouvrez la session avant de saisir.');
          return false;
        }

        let sessionId = existing?.id;
        if (!sessionId) {
          const created = await api.createSession(v.date_dimanche);
          const summary = toSessionSummary(created.session);
          sessionId = summary.id;
          setSessions((prev) =>
            [...prev.filter((session) => session.date !== summary.date), summary].sort((a, b) =>
              a.date.localeCompare(b.date)
            )
          );
          setSundaysList((prev) =>
            prev.includes(summary.date) ? prev : [...prev, summary.date].sort()
          );
        }

        await api.saveVersement(sessionId, v.user_id, v.montant);
        const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
        setVersements((prev) =>
          upsertVersements(prev, [{ ...v, session_id: sessionId }], createdAt)
        );
        return true;
      } catch (error) {
        toast.error(errorMessage(error));
        return false;
      }
    });
  };

  const handleAddBatchVersements = async (
    items: Array<Omit<Versement, 'id' | 'created_at'>>
  ): Promise<boolean | void> => {
    if (!isApiMode) {
      const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
      setVersements((prev) => upsertVersements(prev, items, createdAt));
      return;
    }
    if (items.length === 0) return;

    return withBusy(async () => {
      try {
        const date = items[0].date_dimanche;
        const existing = sessions.find((session) => session.date === date);
        if (existing && existing.statut === 'fermee') {
          toast.error('Dimanche fermé : rouvrez la session avant de saisir.');
          return false;
        }

        let sessionId = existing?.id;
        if (!sessionId) {
          const created = await api.createSession(date);
          const summary = toSessionSummary(created.session);
          sessionId = summary.id;
          setSessions((prev) =>
            [...prev.filter((session) => session.date !== summary.date), summary].sort((a, b) =>
              a.date.localeCompare(b.date)
            )
          );
          setSundaysList((prev) => (prev.includes(summary.date) ? prev : [...prev, summary.date].sort()));
        }

        for (const item of items) {
          await api.saveVersement(sessionId, item.user_id, item.montant);
        }

        const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
        setVersements((prev) =>
          upsertVersements(
            prev,
            items.map((item) => ({ ...item, session_id: sessionId as number })),
            createdAt
          )
        );
        return true;
      } catch (error) {
        toast.error(errorMessage(error));
        return false;
      }
    });
  };

  const handleDeleteVersement = async (id: number): Promise<boolean | void> => {
    if (!isApiMode) {
      if (window.confirm('Voulez-vous vraiment supprimer ce versement ?')) {
        setVersements((prev) => prev.filter((v) => v.id !== id));
      }
      return;
    }

    const target = versements.find((versement) => versement.id === id);
    if (!target) return;
    if (!window.confirm('Voulez-vous vraiment annuler ce versement ? Le montant sera remis à 0.')) {
      return false;
    }

    return withBusy(async () => {
      try {
        let sessionId = sessions.find((session) => session.date === target.date_dimanche)?.id;
        if (!sessionId) {
          const created = await api.createSession(target.date_dimanche);
          const summary = toSessionSummary(created.session);
          sessionId = summary.id;
          setSessions((prev) =>
            [...prev.filter((session) => session.date !== summary.date), summary].sort((a, b) =>
              a.date.localeCompare(b.date)
            )
          );
        }
        await api.saveVersement(sessionId, target.user_id, 0);
        const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
        setVersements((prev) =>
          upsertVersements(prev, [{ ...target, session_id: sessionId as number, montant: 0 }], createdAt)
        );
        toast.success('Versement annulé (montant remis à 0).');
        return true;
      } catch (error) {
        toast.error(errorMessage(error));
        return false;
      }
    });
  };

  // Handlers Retraits Partiels
  const handleAddRetrait = async (r: Omit<Retrait, 'id' | 'created_at'>): Promise<boolean | void> => {
    if (!isApiMode) {
      const newId = retraits.length > 0 ? Math.max(...retraits.map((x) => x.id)) + 1 : 1;
      const newEntry: Retrait = {
        ...r,
        id: newId,
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };
      setRetraits((prev) => [newEntry, ...prev]);
      return;
    }

    return withBusy(async () => {
      try {
        const response = await api.createRetrait({
          userId: r.user_id,
          montant: r.montant,
          motif: r.motif,
          date: r.date_retrait,
        });
        const created: Retrait = {
          ...r,
          id: response.retrait.id,
          created_at: response.retrait.createdAt,
        };
        setRetraits((prev) => [created, ...prev]);
        return true;
      } catch (error) {
        toast.error(errorMessage(error));
        return false;
      }
    });
  };

  const handleDeleteRetrait = async (id: number): Promise<boolean | void> => {
    if (!isApiMode) {
      if (window.confirm('Voulez-vous annuler ce retrait partiel ?')) {
        setRetraits((prev) => prev.filter((r) => r.id !== id));
      }
      return;
    }

    if (!window.confirm('Voulez-vous annuler ce retrait partiel ? Le montant sera recrédité au membre.')) {
      return false;
    }

    return withBusy(async () => {
      try {
        await api.deleteRetrait(id);
        setRetraits((prev) => prev.filter((r) => r.id !== id));
        toast.success('Retrait annulé.');
        return true;
      } catch (error) {
        toast.error(errorMessage(error));
        return false;
      }
    });
  };

  // Handlers Utilisateurs
  const handleAddUser = async (
    u: Omit<User, 'id' | 'created_at'>
  ): Promise<{ motDePasseProvisoire?: string } | void> => {
    if (!isApiMode) {
      const newId = users.length > 0 ? Math.max(...users.map((x) => x.id)) + 1 : 1;
      const newUser: User = {
        ...u,
        id: newId,
        created_at: new Date().toISOString().split('T')[0],
      };
      setUsers((prev) => [...prev, newUser]);
      return;
    }

    return withBusy(async () => {
      try {
        const response = await api.createMember({
          nom: u.nom_complet,
          telephone: u.telephone,
          motDePasse: u.password,
        });
        const created = toUser(response.member);
        setUsers((prev) => [...prev, created]);
        return { motDePasseProvisoire: response.motDePasseProvisoire };
      } catch (error) {
        toast.error(errorMessage(error));
        throw error;
      }
    });
  };

  const handleToggleUserStatus = (userId: number): void => {
    if (!isApiMode) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, statut: u.statut === 'actif' ? 'inactif' : 'actif' } : u
        )
      );
      return;
    }

    const target = users.find((u) => u.id === userId);
    if (!target) return;
    const nextActif = target.statut !== 'actif';

    void withBusy(async () => {
      try {
        await api.setMemberActive(userId, nextActif);
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, statut: nextActif ? 'actif' : 'inactif' } : u
          )
        );
        toast.success(nextActif ? 'Membre réactivé.' : 'Membre désactivé.');
      } catch (error) {
        toast.error(errorMessage(error));
      }
    });
  };

  const handleResetUserPassword = async (userId: number): Promise<string> => {
    if (!isApiMode) {
      const tempPass = 'Menoje' + Math.floor(1000 + Math.random() * 9000);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, password: tempPass, must_change_password: true } : u
        )
      );
      return tempPass;
    }

    return withBusy(async () => {
      const response = await api.resetMemberPassword(userId);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, must_change_password: true } : u))
      );
      return response.motDePasseProvisoire;
    });
  };

  const handleUpdateUserPassword = async (
    userId: number,
    newPassword: string,
    currentPassword?: string
  ): Promise<void> => {
    if (!isApiMode) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, password: newPassword, must_change_password: false } : u
        )
      );
      return;
    }

    await withBusy(() => api.changePassword(currentPassword ?? '', newPassword));
    setApiUser((prev) => (prev ? { ...prev, must_change_password: false } : prev));
  };

  // Handlers Annonces
  const handleAddAnnonce = async (a: Omit<Annonce, 'id' | 'date_publication'>): Promise<void> => {
    if (!isApiMode) {
      const newId = annonces.length > 0 ? Math.max(...annonces.map((x) => x.id)) + 1 : 1;
      const now =
        new Date().toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }) +
        ' ' +
        new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      const newA: Annonce = { ...a, id: newId, date_publication: now };
      setAnnonces((prev) => [newA, ...prev]);
      return;
    }

    await withBusy(async () => {
      try {
        await api.createAnnonce({ titre: a.titre, contenu: a.contenu });
        const response = await api.annonces();
        setAnnonces(response.annonces.map(toAnnonce));
      } catch (error) {
        toast.error(errorMessage(error));
      }
    });
  };

  const handleDeleteAnnonce = (id: number): void => {
    if (!isApiMode) {
      setAnnonces((prev) => prev.filter((a) => a.id !== id));
      return;
    }

    void withBusy(async () => {
      try {
        await api.deleteAnnonce(id);
        setAnnonces((prev) => prev.filter((a) => a.id !== id));
      } catch (error) {
        toast.error(errorMessage(error));
      }
    });
  };

  // Réglages : mise à jour immédiate à l'écran, enregistrement serveur différé.
  const handleUpdateParametres = (p: Partial<ParametresApp>) => {
    setParametres((prev) => ({ ...prev, ...p }));

    if (!isApiMode) return;
    const body = toReglagesPatch(p);
    if (Object.keys(body).length === 0) return;

    if (reglagesTimer.current !== null) window.clearTimeout(reglagesTimer.current);
    reglagesTimer.current = window.setTimeout(() => {
      void withBusy(async () => {
        try {
          const response = await api.updateReglages(body);
          setParametres(toParametres(response.reglages));
        } catch (error) {
          toast.error(errorMessage(error));
        }
      });
    }, 600);
  };

  // Sessions (dimanches) côté serveur
  const handleOpenSession = async (date: string): Promise<{ ok: boolean; message: string }> => {
    try {
      return await withBusy(async () => {
        const response = await api.createSession(date);
        const created = toSessionSummary(response.session);
        setSessions((prev) =>
          [...prev.filter((session) => session.date !== created.date), created].sort((a, b) =>
            a.date.localeCompare(b.date)
          )
        );
        setSundaysList((prev) => (prev.includes(date) ? prev : [...prev, date].sort()));
        return { ok: true, message: `Dimanche du ${formatDateFr(date)} ouvert.` };
      });
    } catch (error) {
      return { ok: false, message: errorMessage(error) };
    }
  };

  const refreshSessions = async () => {
    const response = await api.sessions();
    setSessions(response.sessions.map(toSessionSummary));
  };

  const handleCloseSession = async (date: string): Promise<{ ok: boolean; message: string }> => {
    const session = sessions.find((item) => item.date === date);
    if (!session) return { ok: false, message: 'Session introuvable.' };

    try {
      return await withBusy(async () => {
        const response = await api.closeSession(session.id);
        await refreshSessions();
        return {
          ok: true,
          message: `Dimanche du ${formatDateFr(date)} fermé : ${response.presents} présent(s).`,
        };
      });
    } catch (error) {
      return { ok: false, message: errorMessage(error) };
    }
  };

  const handleReopenSession = async (date: string): Promise<{ ok: boolean; message: string }> => {
    const session = sessions.find((item) => item.date === date);
    if (!session) return { ok: false, message: 'Session introuvable.' };

    try {
      return await withBusy(async () => {
        await api.reopenSession(session.id);
        await refreshSessions();
        return { ok: true, message: `Dimanche du ${formatDateFr(date)} rouvert.` };
      });
    } catch (error) {
      return { ok: false, message: errorMessage(error) };
    }
  };

  const handleExportBackup = () => withBusy(() => api.downloadBackup());
  const handleExportCsv = () => withBusy(() => api.downloadCsv());

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

  // Écran de démarrage en mode API (vérification du jeton).
  if (isApiMode && booting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-slate-600">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/25">
          <Church className="h-6 w-6" />
        </div>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Loader2 className="h-4 w-4 animate-spin" />
          Connexion au serveur de l’église…
        </p>
      </div>
    );
  }

  // Si l'utilisateur n'est pas connecté, afficher l'écran de connexion !
  if (!currentUser) {
    return (
      <LoginScreen
        users={users}
        nomEglise={parametres.nom_eglise}
        apiMode={isApiMode}
        onLogin={isApiMode ? handleApiLogin : undefined}
        onLoginSuccess={isApiMode ? undefined : (user) => setCurrentUserId(user.id)}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col text-slate-800 selection:bg-amber-500 selection:text-slate-950">
      {busyCount > 0 && (
        <div
          className="fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden bg-amber-200 print:hidden"
          role="progressbar"
          aria-label="Communication avec le serveur"
        >
          <div className="h-full w-1/2 animate-pulse bg-amber-500" />
        </div>
      )}

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
                          onClick={handleLogout}
                          className="flex w-full cursor-pointer items-center gap-2.5 min-h-11 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-rose-700 transition hover:bg-rose-50"
                        >
                          <LogOut className="h-4 w-4" />
                          Se déconnecter
                        </button>
                      </div>

                      {!isApiMode && (
                        <>
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
                        </>
                      )}
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
                serverClassement={isApiMode ? serverClassement : undefined}
                badgeDefinitions={isApiMode ? serverBadges : undefined}
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
                apiMode={isApiMode}
                sessions={sessions}
                onOpenSession={isApiMode ? handleOpenSession : undefined}
                onCloseSession={isApiMode ? handleCloseSession : undefined}
                onReopenSession={isApiMode ? handleReopenSession : undefined}
                onExportBackup={isApiMode ? handleExportBackup : undefined}
                onExportCsv={isApiMode ? handleExportCsv : undefined}
              />
            ) : (
              <MemberDashboard
                currentUser={currentUser}
                allVersements={versements}
                allRetraits={retraits}
                sundaysList={sundaysList}
                annonces={annonces}
                parametres={parametres}
                serverStats={isApiMode ? apiStats : undefined}
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
              {currentUser.role === 'admin' && !isApiMode && (
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
                onClick={handleLogout}
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
