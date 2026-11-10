import React, { useState } from 'react';
import { User, Versement, Retrait, Annonce, ParametresApp, UserStats } from '../types';
import { calculateUserStats, formatMoney, formatDateFr, generateMemberAIResponse } from '../utils/tontineUtils';
import { errorMessage } from '../api/client';
import { ReceiptModal } from './ReceiptModal';
import { AnimatedAmount } from './AnimatedAmount';
import { Stagger, StaggerItem } from './motion/Stagger';
import { useToast } from './ui/Toast';
import {
  Wallet,
  PiggyBank,
  Flame,
  Award,
  Calendar,
  FileText,
  Sparkles,
  Send,
  Lock,
  ArrowDownRight,
  Bell,
  Clock,
  ShieldCheck,
  TrendingUp,
  Info,
} from 'lucide-react';

interface MemberDashboardProps {
  currentUser: User;
  allVersements: Versement[];
  allRetraits?: Retrait[];
  sundaysList: string[];
  annonces: Annonce[];
  parametres: ParametresApp;
  /** Statistiques calculées par le serveur (mode API). */
  serverStats?: UserStats;
  onUpdateUserPassword: (
    userId: number,
    newPassword: string,
    currentPassword?: string
  ) => Promise<void> | void;
}

export const MemberDashboard: React.FC<MemberDashboardProps> = ({
  currentUser,
  allVersements,
  allRetraits = [],
  sundaysList,
  annonces,
  parametres,
  serverStats,
  onUpdateUserPassword,
}) => {
  const [showReceipt, setShowReceipt] = useState(false);
  const [activeTab, setActiveTab] = useState<'apercu' | 'historique' | 'assistant' | 'annonces'>('apercu');
  const toast = useToast();

  // Assistant IA personnel
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState<Array<{ sender: 'user' | 'ia'; text: string; time: string }>>([
    {
      sender: 'ia',
      text: `Bonjour ${currentUser.nom_complet} ! Je suis votre assistant personnel Tontine M.E.NO.JE. Je peux répondre à vos questions sur vos cotisations, vos retraits en cours d'année, votre solde disponible ou le montant net que vous recevrez pour les fêtes de fin d'année.`,
      time: 'Maintenant',
    },
  ]);
  const [aiQuotaUsed, setAiQuotaUsed] = useState(1);

  // Changement de mot de passe obligatoire première connexion
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const stats: UserStats =
    serverStats ??
    calculateUserStats(currentUser.id, allVersements, allRetraits, sundaysList, parametres.pourcentage_retenue);

  const memberVersements = allVersements
    .filter((v) => v.user_id === currentUser.id)
    .sort((a, b) => new Date(b.date_dimanche).getTime() - new Date(a.date_dimanche).getTime());

  const memberRetraits = allRetraits
    .filter((r) => r.user_id === currentUser.id)
    .sort((a, b) => new Date(b.date_retrait).getTime() - new Date(a.date_retrait).getTime());

  const handleSendAiQuestion = (customQ?: string) => {
    const q = customQ || aiQuestion;
    if (!q.trim()) return;

    if (aiQuotaUsed >= parametres.quota_ia_quotidien) {
      toast.error(`Quota de ${parametres.quota_ia_quotidien} questions atteint. Vos informations restent consultables dans les autres onglets.`);
      return;
    }

    const timeNow = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const userMsg = { sender: 'user' as const, text: q, time: timeNow };

    const responseText = generateMemberAIResponse(q, currentUser, stats, allVersements, allRetraits, parametres.devise, parametres.pourcentage_retenue);
    const iaMsg = { sender: 'ia' as const, text: responseText, time: timeNow };

    setAiChatHistory((prev) => [...prev, userMsg, iaMsg]);
    setAiQuotaUsed((prev) => prev + 1);
    setAiQuestion('');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError('8 caractères minimum, avec au moins une lettre et un chiffre.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (serverStats && !currentPassword) {
      setPasswordError('Saisissez d’abord votre mot de passe provisoire actuel.');
      return;
    }

    setPasswordSubmitting(true);
    try {
      await onUpdateUserPassword(currentUser.id, newPassword, currentPassword || undefined);
      setPasswordSuccess(true);
      toast.success('Mot de passe personnel enregistré.');
    } catch (error) {
      setPasswordError(errorMessage(error));
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const tabs: Array<{
    key: 'apercu' | 'historique' | 'assistant' | 'annonces';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
    badge?: string;
  }> = [
    { key: 'apercu' as const, label: 'Aperçu', icon: Wallet },
    { key: 'historique' as const, label: 'Historique', icon: Calendar, count: memberVersements.length + memberRetraits.length },
    { key: 'assistant' as const, label: 'Assistant', icon: Sparkles, badge: `${parametres.quota_ia_quotidien - aiQuotaUsed}` },
    { key: 'annonces' as const, label: 'Informations', icon: Bell, count: annonces.length },
  ];

  return (
    <div className="space-y-6">
      {/* Première connexion : mot de passe */}
      {currentUser.must_change_password && !passwordSuccess && (
        <div className="app-card overflow-hidden rounded-2xl border-amber-300/70">
          <div className="flex flex-col gap-4 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/25">
                <Lock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-slate-900">Première connexion : choisissez votre mot de passe</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Vous utilisez un mot de passe provisoire. Définissez votre mot de passe personnel pour sécuriser votre épargne.
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-2 sm:flex-row">
              {serverStats && (
                <input
                  type="password"
                  placeholder="Mot de passe provisoire"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium focus:border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-500/15"
                  required
                />
              )}
              <input
                type="password"
                placeholder="Nouveau mot de passe"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium focus:border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-500/15"
                required
              />
              <input
                type="password"
                placeholder="Confirmer"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium focus:border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-500/15"
                required
              />
              <button
                type="submit"
                disabled={passwordSubmitting}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
              >
                {passwordSubmitting ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </form>
            {passwordError && <p className="text-xs font-bold text-rose-600">{passwordError}</p>}
          </div>
        </div>
      )}

      {/* Héro membre */}
      <section className="app-hero animate-slide-up relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="app-hero-ring -right-20 -top-24 h-64 w-64" />
        <div className="app-hero-ring -bottom-32 right-24 h-72 w-72" />
        <div className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-amber-500/20 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="app-chip border border-amber-400/30 bg-amber-500/15 text-amber-300">
                <Sparkles className="h-3 w-3" />
                Espace épargnant
              </span>
              <span className="text-[11px] font-semibold text-slate-400">Tontine 2026</span>
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Bienvenue, {currentUser.nom_complet.split(' ')[0]}
            </h1>
            <p className="mt-1.5 text-xs text-slate-300 sm:text-sm">
              {formatDateFr(new Date().toISOString().slice(0, 10))} · Votre épargne progresse, continuez ainsi.
            </p>
          </div>

          <button
            onClick={() => setShowReceipt(true)}
            className="btn btn-accent btn-sheen"
          >
            <FileText className="h-4 w-4" />
            Mon relevé officiel
          </button>
        </div>
      </section>

      {/* Onglets */}
      <nav
        aria-label="Sections de mon espace"
        className="hide-scrollbar animate-rise -mx-1 flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-900/5 bg-slate-900/5 p-1"
        style={{ animationDelay: '120ms' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            aria-current={activeTab === tab.key ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2 min-h-11 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
              activeTab === tab.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
            }`}
          >
            <tab.icon className={`h-4 w-4 ${activeTab === tab.key ? 'text-amber-500' : ''}`} />
            {tab.label}
            {typeof tab.count === 'number' && tab.count > 0 && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">
                {tab.count}
              </span>
            )}
            {tab.badge && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div key={activeTab} className="page-transition">
        {/* Aperçu */}
        {activeTab === 'apercu' && (
          <div className="space-y-5">
            <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" gap={0.07}>
              <StaggerItem className="app-card app-stat-tile p-5 text-blue-600">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
                  <Wallet className="h-5 w-5" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total versé</p>
                <h3 className="mt-1 text-xl font-black tabular-nums text-slate-900 sm:text-2xl">
                  <AnimatedAmount value={stats.totalVerse} devise={parametres.devise} />
                </h3>
                <p className="mt-1 text-[11px] text-slate-500">{stats.nombreDimanches} dimanche(s) de cotisation</p>
              </StaggerItem>

              <StaggerItem className="app-card app-stat-tile p-5 text-rose-600">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
                  <ArrowDownRight className="h-5 w-5" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Retraits</p>
                <h3 className="mt-1 text-xl font-black tabular-nums text-rose-700 sm:text-2xl">
                  <AnimatedAmount value={stats.totalRetire} devise={parametres.devise} />
                </h3>
                <p className="mt-1 text-[11px] text-slate-500">{memberRetraits.length} retrait(s) accordé(s)</p>
              </StaggerItem>

              <StaggerItem className="app-card app-stat-tile p-5 text-amber-600">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                  <PiggyBank className="h-5 w-5" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Solde disponible</p>
                <h3 className="mt-1 text-xl font-black tabular-nums text-amber-950 sm:text-2xl">
                  <AnimatedAmount value={stats.soldeActuel} devise={parametres.devise} />
                </h3>
                <p className="mt-1 text-[11px] text-slate-500">Retirable en cas d'urgence</p>
              </StaggerItem>

              <StaggerItem className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-5 text-white shadow-xl shadow-emerald-900/20">
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-xl" />
                <div className="relative">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Net estimé pour les fêtes</p>
                  <h3 className="mt-1 text-xl font-black tabular-nums sm:text-2xl">
                    <AnimatedAmount value={stats.montantNetPrevisionnel} devise={parametres.devise} />
                  </h3>
                  <p className="mt-1 text-[10px] leading-relaxed text-emerald-100">
                    Après {parametres.pourcentage_retenue}% de retenue ({formatMoney(stats.partEglise, parametres.devise)})
                  </p>
                </div>
              </StaggerItem>
            </Stagger>

            {/* Série & badges */}
            <div
              className="animate-rise relative overflow-hidden rounded-[1.75rem] bg-gradient-to-r from-orange-500 via-amber-500 to-amber-400 p-6 text-slate-950 shadow-lg shadow-amber-500/20"
              style={{ animationDelay: '280ms' }}
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/25 backdrop-blur">
                    <Flame className="h-8 w-8 fill-orange-700 text-orange-800" />
                  </div>
                  <div>
                    <p className="text-xl font-black sm:text-2xl">{stats.serieEnCours} dimanches consécutifs</p>
                    <p className="mt-0.5 text-xs font-semibold text-amber-950/80">
                      Votre assiduité vous rapporte <strong>{stats.points} points</strong> au classement.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {stats.badges.length === 0 && (
                    <span className="rounded-xl border border-amber-950/15 bg-white/25 px-3 py-1.5 text-[11px] font-bold">
                      Premiers pas : cotisez ce dimanche !
                    </span>
                  )}
                  {stats.badges.map((b) => (
                    <span
                      key={b.code}
                      title={`${b.nom} : ${b.description}`}
                      className="flex items-center gap-1.5 rounded-xl border border-amber-950/15 bg-white/30 px-3 py-1.5 text-[11px] font-bold backdrop-blur-sm"
                    >
                      <Award className="h-3.5 w-3.5" />
                      {b.nom}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Résumé express */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="app-card animate-rise p-5" style={{ animationDelay: '340ms' }}>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">Votre épargne en un coup d'œil</h3>
                </div>
                <ul className="mt-3 space-y-2 text-xs text-slate-600">
                  <li className="flex items-center justify-between gap-2">
                    <span>Dernière cotisation</span>
                    <strong className="text-slate-900">
                      {memberVersements[0] ? formatDateFr(memberVersements[0].date_dimanche) : 'Aucune'}
                    </strong>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span>Prochain dimanche</span>
                    <strong className="text-slate-900">
                      {sundaysList.find((s) => s > new Date().toISOString().slice(0, 10))
                        ? formatDateFr(sundaysList.find((s) => s > new Date().toISOString().slice(0, 10))!)
                        : 'Calendrier à jour'}
                    </strong>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span>Retenue de l'église</span>
                    <strong className="text-slate-900">{parametres.pourcentage_retenue}%</strong>
                  </li>
                </ul>
              </div>

              <div className="app-card animate-rise flex flex-col justify-between gap-3 p-5" style={{ animationDelay: '400ms' }}>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                    <Info className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">Une question sur votre épargne ?</h3>
                </div>
                <p className="text-xs leading-relaxed text-slate-600">
                  L'assistant répond instantanément à vos questions sur vos versements, retraits et prévisions.
                </p>
                <button
                  onClick={() => setActiveTab('assistant')}
                  className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  Poser une question
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Historique */}
        {activeTab === 'historique' && (
          <div className="space-y-5">
            {memberRetraits.length > 0 && (
              <div className="app-card overflow-hidden rounded-2xl border-rose-200/70">
                <div className="flex items-center gap-2 border-b border-rose-100 bg-rose-50/60 px-5 py-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
                    <ArrowDownRight className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-rose-900">Retraits partiels ({memberRetraits.length})</h3>
                    <p className="text-[11px] text-rose-700/70">Montants déjà retirés sur votre épargne</p>
                  </div>
                </div>
                <div className="divide-y divide-rose-100 sm:hidden">
                  {memberRetraits.map((r) => (
                    <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{formatDateFr(r.date_retrait)}</p>
                        <p className="truncate text-[11px] text-slate-500">{r.motif || 'Retrait anticipé'}</p>
                      </div>
                      <p className="shrink-0 text-sm font-black text-rose-700">
                        − {formatMoney(r.montant, parametres.devise)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto p-2 sm:block">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="text-[10px] font-bold uppercase tracking-wider text-rose-700/70">
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Motif</th>
                        <th className="px-3 py-2.5 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100">
                      {memberRetraits.map((r) => (
                        <tr key={r.id}>
                          <td className="px-3 py-2.5 font-semibold text-slate-900">{formatDateFr(r.date_retrait)}</td>
                          <td className="px-3 py-2.5 text-slate-600">{r.motif || 'Retrait anticipé'}</td>
                          <td className="px-3 py-2.5 text-right font-black text-rose-700">
                            − {formatMoney(r.montant, parametres.devise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="app-card overflow-hidden rounded-2xl">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Historique des cotisations</h3>
                  <p className="text-[11px] text-slate-500">
                    Montants enregistrés par le secrétariat · preuve de suivi, pas un paiement en ligne.
                  </p>
                </div>
                <button
                  onClick={() => setShowReceipt(true)}
                  className="btn btn-outline btn-sm self-start"
                >
                  <FileText className="h-4 w-4 text-amber-600" />
                  Imprimer le relevé
                </button>
              </div>

              {memberVersements.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Calendar className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-sm font-bold text-slate-700">Aucune cotisation pour le moment</p>
                  <p className="mt-1 text-xs text-slate-500">Votre premier versement apparaîtra ici.</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 sm:hidden">
                    {memberVersements.map((v) => (
                      <div key={v.id} className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {formatDateFr(v.date_dimanche)}
                          </p>
                          <span className="mt-1 inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {v.mode_reglement === 'especes' ? 'Espèces' : 'Mobile Money'}
                          </span>
                        </div>
                        <p className="shrink-0 text-sm font-black tabular-nums text-slate-900">
                          {formatMoney(v.montant, parametres.devise)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full border-collapse text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-5 py-3">Dimanche</th>
                        <th className="px-5 py-3">Mode</th>
                        <th className="px-5 py-3 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {memberVersements.map((v) => (
                        <tr key={v.id} className="transition hover:bg-slate-50/70">
                          <td className="px-5 py-3 font-semibold text-slate-900">{formatDateFr(v.date_dimanche)}</td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                              {v.mode_reglement === 'especes' ? 'Espèces' : 'Mobile Money'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-black text-slate-900">
                            {formatMoney(v.montant, parametres.devise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Assistant */}
        {activeTab === 'assistant' && (
          <div className="app-card flex h-[560px] flex-col overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 p-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 text-slate-950">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Assistant personnel</h3>
                  <p className="text-[11px] text-slate-300">Confidentiel · Cotisations & retraits</p>
                </div>
              </div>
              <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-bold">
                {parametres.quota_ia_quotidien - aiQuotaUsed} restant(s)
              </span>
            </div>

            <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto border-b border-amber-100 bg-amber-50/60 p-3 text-xs">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-900">Suggestions</span>
              {[
                { label: '🎉 Montant pour les fêtes', q: 'Combien je vais recevoir pour les fêtes ?' },
                { label: '💼 Solde disponible', q: 'Puis-je faire un retrait partiel ?' },
                { label: '📊 Total versé', q: 'Combien j’ai donné au total ?' },
              ].map((s) => (
                <button
                  key={s.q}
                  onClick={() => handleSendAiQuestion(s.q)}
                  className="shrink-0 rounded-full border border-amber-200 bg-white px-3 py-1.5 font-semibold text-amber-900 transition hover:bg-amber-100 cursor-pointer"
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/50 p-4">
              {aiChatHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed sm:text-sm ${
                      msg.sender === 'user'
                        ? 'rounded-br-md bg-slate-900 text-white shadow-sm'
                        : 'rounded-bl-md border border-slate-200 bg-white text-slate-800 shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <span className={`mt-1 block text-[10px] ${msg.sender === 'user' ? 'text-right text-slate-400' : 'text-slate-400'}`}>
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
              <input
                type="text"
                placeholder="Posez votre question…"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendAiQuestion()}
                className="flex-1 rounded-2xl border border-transparent bg-slate-100 px-4 py-2.5 text-xs focus:border-amber-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/15 sm:text-sm"
              />
              <button
                onClick={() => handleSendAiQuestion()}
                aria-label="Envoyer la question"
                className="rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 p-2.5 text-slate-950 shadow-md shadow-amber-500/20 transition hover:from-amber-300 hover:to-orange-400 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Annonces */}
        {activeTab === 'annonces' && (
          <div className="space-y-4">
            {annonces.length === 0 && (
              <div className="app-card px-5 py-10 text-center">
                <p className="text-sm font-bold text-slate-700">Aucune information pour le moment</p>
              </div>
            )}
            {annonces.map((annonce, index) => (
              <article
                key={annonce.id}
                className={`app-card animate-rise overflow-hidden rounded-2xl border-l-4 p-5 ${
                  annonce.priorite === 'urgente'
                    ? 'border-l-rose-500'
                    : annonce.priorite === 'importante'
                    ? 'border-l-amber-500'
                    : 'border-l-sky-500'
                }`}
                style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`app-chip ${
                      annonce.priorite === 'urgente'
                        ? 'bg-rose-100 text-rose-700'
                        : annonce.priorite === 'importante'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-sky-100 text-sky-700'
                    }`}
                  >
                    {annonce.priorite}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="h-3 w-3" />
                    {annonce.date_publication}
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900">{annonce.titre}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{annonce.contenu}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      {showReceipt && (
        <ReceiptModal
          member={currentUser}
          stats={stats}
          versements={allVersements}
          retraits={allRetraits}
          devise={parametres.devise}
          nomEglise={parametres.nom_eglise}
          tauxRetenue={parametres.pourcentage_retenue}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  );
};
