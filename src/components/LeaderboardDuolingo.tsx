import React, { useState } from 'react';
import { Badge, ClassementEntry, User, Versement, Retrait, ParametresApp, UserStats } from '../types';
import { calculateUserStats, formatMoney } from '../utils/tontineUtils';
import { Stagger, StaggerItem } from './motion/Stagger';
import {
  Flame,
  Award,
  Sparkles,
  ShieldCheck,
  Footprints,
  Crown,
  HeartHandshake,
  Eye,
  EyeOff,
  CalendarCheck,
  TrendingUp,
  Users,
} from 'lucide-react';

interface LeaderboardDuolingoProps {
  users: User[];
  versements: Versement[];
  retraits?: Retrait[];
  sundaysList: string[];
  parametres: ParametresApp;
  currentUserId?: number;
  /** Classement calculé par le serveur (mode API) : prioritaire sur le calcul local. */
  serverClassement?: ClassementEntry[];
  /** Définitions des badges renvoyées par `GET /api/classement`. */
  badgeDefinitions?: Badge[];
}

type FilterKey = 'tous' | 'series' | 'badges';

export const LeaderboardDuolingo: React.FC<LeaderboardDuolingoProps> = ({
  users,
  versements,
  retraits = [],
  sundaysList,
  parametres,
  currentUserId,
  serverClassement,
  badgeDefinitions,
}) => {
  const [filter, setFilter] = useState<FilterKey>('tous');

  const activeMembers = users.filter((u) => u.role === 'membre' && u.statut === 'actif');

  const membersWithStats: Array<{ member: User; stats: UserStats }> = serverClassement
    ? serverClassement.map((entry) => {
        const definitions = new Map((badgeDefinitions ?? []).map((badge) => [badge.code, badge]));
        return {
          member: {
            id: entry.userId,
            nom_complet: entry.nom,
            telephone: '',
            role: 'membre',
            statut: 'actif',
            must_change_password: false,
            whatsapp_disponible: true,
            created_at: '',
          },
          stats: {
            userId: entry.userId,
            totalVerse: entry.totalVerse ?? 0,
            totalRetire: 0,
            soldeActuel: 0,
            nombreDimanches: entry.nombreDimanches,
            serieEnCours: entry.serieEnCours,
            points: entry.points,
            badges: entry.badges.map(
              (code, index) =>
                definitions.get(code) ?? {
                  id: index + 1,
                  code,
                  nom: code,
                  description: '',
                  icone: 'Footprints',
                  points: 0,
                }
            ),
            partEglise: 0,
            montantNetPrevisionnel: 0,
          },
        };
      })
    : activeMembers.map((member) => ({
        member,
        stats: calculateUserStats(
          member.id,
          versements,
          retraits,
          sundaysList,
          parametres.pourcentage_retenue
        ),
      }));

  // Tri par points puis par série de dimanches consécutifs
  const sortedMembers = [...membersWithStats].sort((a, b) => {
    if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
    return b.stats.serieEnCours - a.stats.serieEnCours;
  });

  const filteredMembers = sortedMembers.filter((item) => {
    if (filter === 'series') return item.stats.serieEnCours >= 3;
    if (filter === 'badges') return item.stats.badges.length >= 2;
    return true;
  });

  const podium = sortedMembers.slice(0, 3);
  // Podium classique : 2e à gauche, 1er au centre, 3e à droite
  const podiumDisplay = [
    { item: podium[1], rank: 2 },
    { item: podium[0], rank: 1 },
    { item: podium[2], rank: 3 },
  ].filter((entry) => Boolean(entry.item)) as Array<{
    item: (typeof podium)[number];
    rank: number;
  }>;
  const currentUserRank = currentUserId
    ? sortedMembers.findIndex((item) => item.member.id === currentUserId) + 1
    : 0;

  const filters: Array<{ key: FilterKey; label: string; icon: React.ComponentType<{ className?: string }>; count: number }> = [
    { key: 'tous', label: 'Tous les membres', icon: Users, count: sortedMembers.length },
    { key: 'series', label: 'Séries en feu', icon: Flame, count: sortedMembers.filter((i) => i.stats.serieEnCours >= 3).length },
    { key: 'badges', label: 'Multi-badgés', icon: Award, count: sortedMembers.filter((i) => i.stats.badges.length >= 2).length },
  ];

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 border-amber-300';
    if (rank === 2) return 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800 border-slate-300';
    if (rank === 3) return 'bg-gradient-to-br from-orange-400 to-amber-700 text-amber-50 border-orange-500';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const renderBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Flame':
        return <Flame className="w-3.5 h-3.5 text-amber-500" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />;
      case 'Crown':
        return <Crown className="w-3.5 h-3.5 text-amber-600" />;
      case 'HeartHandshake':
        return <HeartHandshake className="w-3.5 h-3.5 text-rose-500" />;
      default:
        return <Footprints className="w-3.5 h-3.5 text-emerald-500" />;
    }
  };

  const podiumStyles = [
    {
      wrapper: 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-950 sm:pb-8',
      medal: '🥇',
      height: 'sm:pt-8',
      caption: '1er',
    },
    {
      wrapper: 'bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 text-slate-800 sm:pb-5',
      medal: '🥈',
      height: 'sm:pt-5',
      caption: '2e',
    },
    {
      wrapper: 'bg-gradient-to-b from-orange-300 via-orange-400 to-orange-600 text-slate-950 sm:pb-4',
      medal: '🥉',
      height: 'sm:pt-4',
      caption: '3e',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Héro du classement */}
      <section className="app-hero animate-slide-up relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="app-hero-ring -right-24 -top-28 h-72 w-72" />
        <div className="app-hero-ring -bottom-40 right-32 h-80 w-80" />
        <div className="absolute -left-20 bottom-0 h-52 w-52 rounded-full bg-amber-500/20 blur-3xl" />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="app-chip border border-amber-400/30 bg-amber-500/15 text-amber-300">
              <Sparkles className="h-3 w-3" />
              Objectif Fêtes Sans Soucis
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              Tontine {parametres.nom_eglise} · 2026
            </span>
          </div>

          <h1 className="mt-3 max-w-2xl text-2xl font-black tracking-tight text-white sm:text-3xl">
            Tableau de constance & d'épargne
          </h1>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-300 sm:text-sm">
            Chaque dimanche respecté vous rapproche d'une fin d'année sereine. La constance est
            récompensée avant les montants.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200">
              <Flame className="h-3.5 w-3.5 text-amber-300" />
              Séries consécutives
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200">
              <Award className="h-3.5 w-3.5 text-amber-200" />
              Badges de prévoyance
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200">
              {parametres.afficher_montants_classement ? (
                <>
                  <Eye className="h-3.5 w-3.5 text-emerald-300" />
                  Montants visibles
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5 text-amber-200" />
                  Montants masqués · Pudeur active
                </>
              )}
            </span>
            {currentUserRank > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-emerald-200">
                <TrendingUp className="h-3.5 w-3.5" />
                Votre rang : #{currentUserRank}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Podium */}
      {podium.length > 0 && (
        <section aria-label="Podium du classement" className="grid grid-cols-3 items-end gap-2 sm:gap-4">
          {podiumDisplay.map(({ item, rank }, index) => {
            const style = podiumStyles[rank - 1];
            const isCurrentUser = currentUserId === item.member.id;
            return (
              <div
                key={item.member.id}
                style={{ animationDelay: `${120 + index * 90}ms` }}
                className={`animate-pop relative flex flex-col items-center overflow-hidden rounded-[1.5rem] px-2 pt-4 text-center shadow-lg transition sm:px-4 sm:pt-6 ${style.wrapper} ${style.height} ${
                  isCurrentUser ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-transparent' : ''
                }`}
              >
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/25 blur-xl" />
                <span className="relative text-2xl sm:text-3xl">{style.medal}</span>
                <div className="relative mt-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/30 text-lg font-black backdrop-blur sm:h-14 sm:w-14 sm:text-xl">
                  {item.member.nom_complet.charAt(0)}
                </div>
                <p className="relative mt-2 line-clamp-2 text-[11px] font-black leading-tight sm:text-sm">
                  {item.member.nom_complet}
                </p>
                <p className="relative mt-0.5 text-[10px] font-bold uppercase tracking-wider opacity-70">
                  {style.caption}
                  {isCurrentUser ? ' · Vous' : ''}
                </p>
                <div className="relative mt-2 flex items-center gap-1.5 pb-3 text-[10px] font-bold sm:text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2 py-1">
                    <Flame className="h-3 w-3" />
                    {item.stats.serieEnCours}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2 py-1">
                    <Sparkles className="h-3 w-3" />
                    {item.stats.points} pts
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Filtres */}
      <nav
        aria-label="Filtres du classement"
        className="hide-scrollbar animate-rise -mx-1 flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white/70 p-1"
        style={{ animationDelay: '260ms' }}
      >
        {filters.map((item) => {
          const isActive = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              aria-pressed={isActive}
              className={`flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
              }`}
            >
              <item.icon className={`h-4 w-4 ${isActive ? 'text-amber-500' : ''}`} />
              {item.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                  isActive ? 'bg-amber-100 text-amber-700' : 'bg-slate-200/70 text-slate-500'
                }`}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Liste */}
      <Stagger key={filter} className="space-y-2.5" gap={0.035}>
        {filteredMembers.length === 0 && (
          <div className="app-card px-5 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
              <Award className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-bold text-slate-800">Aucun membre dans ce filtre</p>
            <p className="mt-1 text-xs text-slate-500">
              Les séries et badges apparaissent au fil des dimanches cotisés.
            </p>
          </div>
        )}

        {filteredMembers.map((item) => {
          const rank = sortedMembers.findIndex((m) => m.member.id === item.member.id) + 1;
          const isCurrentUser = currentUserId === item.member.id;

          return (
            <StaggerItem
              key={item.member.id}
              as="article"
              className={`flex items-center gap-3 rounded-2xl border p-3 transition sm:gap-4 sm:p-4 ${
                isCurrentUser
                  ? 'border-amber-300 bg-amber-50/80 ring-2 ring-amber-400/30 shadow-md'
                  : 'app-card app-card-interactive border-transparent'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-black sm:h-10 sm:w-10 sm:text-sm ${getRankBadgeColor(
                  rank
                )}`}
              >
                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
              </div>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-black text-slate-950 shadow-inner">
                {item.member.nom_complet.charAt(0)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-bold text-slate-900 sm:text-base">
                    {item.member.nom_complet}
                  </h3>
                  {isCurrentUser && (
                    <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-900">
                      Vous
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                      item.stats.serieEnCours > 0
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Flame
                      className={`h-3 w-3 ${
                        item.stats.serieEnCours > 0 ? 'fill-orange-500 text-orange-500' : ''
                      }`}
                    />
                    {item.stats.serieEnCours} dim.
                  </span>

                  <span className="text-[11px] font-semibold text-slate-500">
                    <strong className="text-amber-600">{item.stats.points}</strong> pts
                  </span>

                  {item.stats.badges.length > 0 && (
                    <span className="flex items-center gap-1">
                      {item.stats.badges.map((b) => (
                        <span
                          key={b.code}
                          title={`${b.nom} : ${b.description}`}
                          className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 bg-slate-100"
                        >
                          {renderBadgeIcon(b.icone)}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                {parametres.afficher_montants_classement ? (
                  <>
                    <p className="text-sm font-black text-slate-900 sm:text-base">
                      {formatMoney(item.stats.totalVerse, parametres.devise)}
                    </p>
                    <p className="text-[10px] text-slate-500">{item.stats.nombreDimanches} dimanche(s)</p>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                      <CalendarCheck className="h-3 w-3" />
                      Épargnant actif
                    </span>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {item.stats.nombreDimanches} versement(s)
                    </p>
                  </>
                )}
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>

      <p className="text-center text-[11px] text-slate-400">
        Le classement valorise la régularité : chaque dimanche cotisé consécutif augmente vos points.
      </p>
    </div>
  );
};
