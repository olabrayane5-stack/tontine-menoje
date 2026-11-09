import React, { useState } from 'react';
import { User } from '../types';
import { ThemeToggle } from './ThemeToggle';
import {
  ArrowRight,
  CalendarCheck,
  Church,
  Eye,
  EyeOff,
  Lock,
  Phone,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';

interface LoginScreenProps {
  users: User[];
  onLoginSuccess: (user: User) => void;
  nomEglise: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ users, onLoginSuccess, nomEglise }) => {
  const [telephone, setTelephone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanInput = telephone.replace(/\s+/g, '').toLowerCase();

    const user = users.find((u) => {
      const uPhone = u.telephone.replace(/\s+/g, '').toLowerCase();
      return uPhone === cleanInput || u.telephone === telephone;
    });

    if (!user) {
      setError('Numéro de téléphone introuvable. Veuillez contacter le Pasteur ou le secrétariat.');
      return;
    }

    if (user.statut === 'inactif') {
      setError('Ce compte est temporairement inactif. Veuillez vous rapprocher de l’administrateur.');
      return;
    }

    if (user.password && user.password !== password) {
      setError('Mot de passe incorrect. Veuillez réessayer ou contacter le secrétariat.');
      return;
    }

    onLoginSuccess(user);
  };

  const adminUser = users.find((u) => u.role === 'admin') ?? users[0];
  const activeMember = users.find((u) => u.id === 2) ?? users.find((u) => u.role === 'membre') ?? users[0];
  const newMemberWithTempPass = users.find((u) => u.must_change_password) ?? users.find((u) => u.role === 'membre') ?? users[0];

  const quickAccess = [
    {
      key: 'admin',
      user: adminUser,
      label: 'Administrateur',
      hint: 'Pilotage & caisse',
      icon: ShieldCheck,
      tile: 'from-violet-500 to-purple-700',
      ring: 'hover:border-violet-300',
    },
    {
      key: 'membre',
      user: activeMember,
      label: 'Membre',
      hint: 'Mon épargne',
      icon: UserCheck,
      tile: 'from-amber-400 to-orange-600',
      ring: 'hover:border-amber-300',
    },
    {
      key: 'temp',
      user: newMemberWithTempPass,
      label: 'Première connexion',
      hint: 'Mot de passe provisoire',
      icon: Lock,
      tile: 'from-emerald-400 to-teal-600',
      ring: 'hover:border-emerald-300',
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950 text-slate-800">
      {/* Décor de fond */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-amber-500/20 blur-3xl animate-glow-pulse" />
        <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl animate-glow-pulse" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgb(255_255_255)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255)_1px,transparent_1px)] [background-size:56px_56px]" />
      </div>

      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 pt-24 pb-10 sm:px-6 sm:py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pt-16 lg:pb-8">
        {/* Panneau de marque */}
        <section className="hidden text-white lg:block">
          <div className="animate-rise flex items-center gap-3">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 via-amber-500 to-orange-600 text-slate-950 shadow-2xl shadow-amber-500/30">
              <Church className="h-7 w-7" />
              <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-4 ring-ink-950" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300">
                Portail officiel d'épargne
              </p>
              <p className="text-lg font-black tracking-tight">Tontine {nomEglise}</p>
            </div>
          </div>

          <h1
            className="animate-rise mt-10 max-w-xl text-4xl font-black leading-[1.08] tracking-tight xl:text-5xl"
            style={{ animationDelay: '70ms' }}
          >
            L'épargne qui prépare
            <span className="block bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">
              vos fêtes, sereinement.
            </span>
          </h1>

          <p
            className="animate-rise mt-5 max-w-md text-sm leading-relaxed text-slate-300"
            style={{ animationDelay: '140ms' }}
          >
            Chaque dimanche, cotisez pour la tontine de l'église. Suivez votre solde, vos séries
            d'assiduité et votre montant net de fin d'année, en toute transparence.
          </p>

          <figure
            className="animate-rise relative mt-7 max-w-md overflow-hidden rounded-3xl border border-amber-400/25 bg-gradient-to-br from-white/[0.09] to-white/[0.02] p-5 backdrop-blur-sm"
            style={{ animationDelay: '200ms' }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-1 -top-6 text-7xl font-black leading-none text-amber-400/20"
            >
              “
            </span>
            <blockquote className="relative text-sm font-medium italic leading-relaxed text-slate-200">
              « Que chacun donne comme il l'a résolu en son cœur, sans tristesse ni contrainte ; car
              Dieu aime celui qui donne avec joie. »
            </blockquote>
            <figcaption className="relative mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
              <span className="h-px w-6 bg-amber-400/60" />
              2 Corinthiens 9:7
            </figcaption>
          </figure>

          <div className="mt-7 space-y-3">
            {[
              {
                icon: Wallet,
                title: 'Suivi en temps réel',
                text: 'Versements, retraits partiels et solde disponible.',
              },
              {
                icon: CalendarCheck,
                title: 'Assiduité récompensée',
                text: 'Séries de dimanches, points et badges solidaires.',
              },
              {
                icon: Sparkles,
                title: 'Assistant personnel',
                text: 'Des réponses claires sur votre épargne.',
              },
            ].map((item, index) => (
              <div
                key={item.title}
                style={{ animationDelay: `${260 + index * 70}ms` }}
                className="animate-rise flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-sm transition hover:border-amber-400/30 hover:bg-white/[0.07]"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
                  <item.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-white">{item.title}</p>
                  <p className="text-xs text-slate-400">{item.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div
            className="animate-rise mt-8 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-300"
            style={{ animationDelay: '480ms' }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <Users className="h-3.5 w-3.5 text-amber-300" /> 50 membres
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <CalendarCheck className="h-3.5 w-3.5 text-emerald-300" /> 10 dimanches
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-300" /> Gestion sécurisée
            </span>
          </div>
        </section>

        {/* Carte de connexion */}
        <section className="mx-auto w-full max-w-md">
          <div className="app-card animate-slide-up overflow-hidden rounded-2xl" style={{ animationDelay: '120ms' }}>
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-6 py-6 text-white sm:px-8">
              <div className="relative z-10 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/25 lg:hidden">
                  <Church className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
                    Tontine {nomEglise}
                  </p>
                  <h2 className="text-xl font-black tracking-tight">Bon retour parmi nous</h2>
                </div>
              </div>
              <p className="relative z-10 mt-3 max-w-xs text-xs leading-relaxed text-slate-300">
                Connectez-vous avec votre numéro de téléphone pour retrouver votre épargne.
              </p>
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-500/20 blur-2xl" />
              <Church
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-6 right-2 h-28 w-28 text-white/[0.05]"
              />
            </div>

            <div className="space-y-5 p-6 sm:p-8">
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div
                    role="alert"
                    className="animate-pop flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700"
                  >
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="field-label">Numéro de téléphone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="username"
                      placeholder="+225 07 11 22 33"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      className="field pl-11"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="field-label">Mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Votre mot de passe"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="field pl-11 pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg btn-sheen group w-full"
                >
                  Se connecter
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </button>

                <p className="text-center text-[10px] leading-relaxed text-slate-400">
                  Mot de passe oublié ? Rapprochez-vous du secrétariat de l'église.
                </p>
              </form>

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Accès démo
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="grid gap-2">
                {quickAccess.map((item, index) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onLoginSuccess(item.user)}
                    style={{ animationDelay: `${220 + index * 60}ms` }}
                    className={`group flex min-h-[56px] animate-rise items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${item.ring}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${item.tile}`}>
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-800">{item.label}</span>
                      <span className="block truncate text-[10px] text-slate-400">{item.user.nom_complet}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
                  </button>
                ))}
              </div>

              <p className="text-center text-[10px] leading-relaxed text-slate-400">
                Pas d'inscription libre · Comptes créés et gérés par le secrétariat
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] text-slate-400">
            🔒 Vos données restent sur cet appareil.
          </p>
        </section>
      </div>
    </div>
  );
};
