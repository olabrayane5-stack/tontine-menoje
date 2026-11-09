import { User, Versement, Retrait, Badge, UserStats, ParsedVersementsResult } from '../types';
import { BADGES_LIST, SUNDAYS_LIST } from '../data/mockData';

export const formatMoney = (amount: number, devise: string = 'FCFA'): string => {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} ${devise}`;
};

/**
 * Convertit une saisie libre en montant entier positif.
 * Tolère les séparateurs de milliers : « 10 000 », « 10.000 », « 10 000 FCFA ».
 * Retourne `null` si aucun chiffre exploitable n'est présent.
 */
export const parseAmountInput = (raw: string): number | null => {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const value = Number.parseInt(digits, 10);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
};

/** Normalise un texte pour une recherche tolérante aux accents et à la casse. */
export const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/**
 * Ajoute ou met à jour des versements en garantissant **un seul versement par
 * membre et par dimanche**. Les entrées en double sont fusionnées, les
 * identifiants sont calculés à partir de la liste courante (donc sans collision
 * même lors d'un enregistrement groupé) et les montants invalides sont ignorés.
 */
export const upsertVersements = (
  existing: Versement[],
  incoming: Array<Omit<Versement, 'id' | 'created_at'>>,
  createdAt: string
): Versement[] => {
  if (incoming.length === 0) return existing;

  const next = [...existing];
  let nextId = next.reduce((max, versement) => Math.max(max, versement.id), 0) + 1;

  for (const item of incoming) {
    const montant = Math.round(Number(item.montant));
    if (!Number.isFinite(montant) || montant <= 0) continue;

    const index = next.findIndex(
      (versement) =>
        versement.user_id === item.user_id && versement.date_dimanche === item.date_dimanche
    );

    if (index >= 0) {
      next[index] = {
        ...next[index],
        montant,
        mode_reglement: item.mode_reglement,
        commentaire: item.commentaire ?? next[index].commentaire,
        enregistre_par: item.enregistre_par,
      };
    } else {
      next.unshift({
        ...item,
        montant,
        id: nextId++,
        created_at: createdAt,
      });
    }
  }

  return next;
};

export const formatDateFr = (dateStr: string): string => {
  try {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

// Calcule les statistiques d'un membre :
// total versé, retraits partiels en cours d'année, solde actuel, retenue de l'église, montant net prévisionnel
export const calculateUserStats = (
  userId: number,
  versements: Versement[],
  retraits: Retrait[] = [],
  sundaysList: string[] = SUNDAYS_LIST,
  tauxRetenue: number = 3
): UserStats => {
  const userVersements = versements.filter((v) => v.user_id === userId);
  const userRetraits = retraits.filter((r) => r.user_id === userId);

  const totalVerse = userVersements.reduce((sum, v) => sum + Number(v.montant), 0);
  const totalRetire = userRetraits.reduce((sum, r) => sum + Number(r.montant), 0);
  const soldeActuel = Math.max(0, totalVerse - totalRetire);

  const nombreDimanches = userVersements.length;

  // Frais d'organisation prélevés par l'église sur l'épargne totale
  const partEglise = Math.round(totalVerse * (tauxRetenue / 100));

  // Montant net final prévisionnel que le membre touchera en fin d'année
  const montantNetPrevisionnel = Math.max(0, totalVerse - partEglise - totalRetire);

  // Duolingo streak : série de dimanches consécutifs avec cotisation
  const sortedSundays = [...sundaysList].sort().reverse();
  const paidDatesSet = new Set(userVersements.map((v) => v.date_dimanche));

  let serieEnCours = 0;
  for (const sunday of sortedSundays) {
    if (paidDatesSet.has(sunday)) {
      serieEnCours++;
    } else {
      break;
    }
  }

  // Attribution des badges et points de régularité
  const earnedBadges: Badge[] = [];
  let points = nombreDimanches * 10 + serieEnCours * 15;

  if (nombreDimanches >= 1) {
    const b = BADGES_LIST.find((item) => item.code === 'PREMIER_PAS');
    if (b) {
      earnedBadges.push(b);
      points += b.points;
    }
  }
  if (serieEnCours >= 4) {
    const b = BADGES_LIST.find((item) => item.code === 'SERIE_4');
    if (b) {
      earnedBadges.push(b);
      points += b.points;
    }
  }
  if (serieEnCours >= 8) {
    const b = BADGES_LIST.find((item) => item.code === 'SERIE_8');
    if (b) {
      earnedBadges.push(b);
      points += b.points;
    }
  }
  if (serieEnCours >= 12) {
    const b = BADGES_LIST.find((item) => item.code === 'SERIE_12');
    if (b) {
      earnedBadges.push(b);
      points += b.points;
    }
  }
  if (sundaysList.length > 0 && nombreDimanches / sundaysList.length >= 0.8) {
    const b = BADGES_LIST.find((item) => item.code === 'REGULARITE_OR');
    if (b) {
      earnedBadges.push(b);
      points += b.points;
    }
  }

  return {
    userId,
    totalVerse,
    totalRetire,
    soldeActuel,
    nombreDimanches,
    serieEnCours,
    points,
    badges: earnedBadges,
    partEglise,
    montantNetPrevisionnel,
  };
};

// Saisie rapide IA pour l'administrateur
export const parseVersementsBatchText = (
  rawText: string,
  members: User[]
): ParsedVersementsResult => {
  const result: ParsedVersementsResult = {
    matched: [],
    ambiguous: [],
    notFound: [],
  };

  if (!rawText.trim()) return result;

  const lines = rawText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);

  lines.forEach((line) => {
    const match = line.match(/^([a-zA-ZÀ-ÿ\s'-]+?)\s*[:=]?\s*(\d+[\d\s]*)(?:\s*(?:fcfa|f|cfa|eur|€))?$/i);

    if (!match) return;

    const rawName = match[1].trim();
    const montantClean = parseInt(match[2].replace(/\s+/g, ''), 10);

    if (isNaN(montantClean) || montantClean <= 0) return;

    const lowerQuery = rawName.toLowerCase();

    const candidates = members.filter((m) => {
      const lowerName = m.nom_complet.toLowerCase();
      return (
        lowerName.includes(lowerQuery) ||
        lowerName.split(/\s+/).some((part) => part.startsWith(lowerQuery) || lowerQuery.includes(part))
      );
    });

    if (candidates.length === 1) {
      result.matched.push({
        userId: candidates[0].id,
        userName: candidates[0].nom_complet,
        montant: montantClean,
        confiance: 0.95,
      });
    } else if (candidates.length > 1) {
      result.ambiguous.push({
        rawName,
        montant: montantClean,
        suggestions: candidates.map((c) => ({ id: c.id, nom: c.nom_complet })),
      });
    } else {
      result.notFound.push({
        rawName,
        montant: montantClean,
      });
    }
  });

  return result;
};

// Générateur de message WhatsApp / SMS prêt à envoyer
export const generateWhatsAppMessage = (
  member: User,
  stats: UserStats,
  devise: string = 'FCFA',
  nomEglise: string = 'M.E.NO.JE',
  tauxRetenue: number = 3
): string => {
  return `🎉 *TONTINE M.E.NO.JE 2026 - OBJECTIF FÊTES SANS SOUCIS* 🎉\n\n` +
    `Bonjour cher(e) *${member.nom_complet}*,\n` +
    `Voici le point officiel de votre épargne tontine à ce jour :\n\n` +
    `💰 *Total cotisé :* ${formatMoney(stats.totalVerse, devise)}\n` +
    `📅 *Dimanches participés :* ${stats.nombreDimanches}\n` +
    `🔥 *Série en cours :* ${stats.serieEnCours} dimanche(s) consécutif(s)\n` +
    (stats.totalRetire > 0 ? `🔻 *Retraits partiels déjà effectués :* ${formatMoney(stats.totalRetire, devise)}\n` : '') +
    `💼 *Solde disponible restant :* ${formatMoney(stats.soldeActuel, devise)}\n\n` +
    `📊 *Prévision de fin d'année (Novembre/Décembre) :*\n` +
    `• Votre montant net à récupérer : *${formatMoney(stats.montantNetPrevisionnel, devise)}*\n` +
    `• Frais d'organisation église (${tauxRetenue}%) : ${formatMoney(stats.partEglise, devise)}\n\n` +
    `Bravo pour votre constance, les fêtes se préparent dès maintenant ! 💪✨\n` +
    `_Coordination Tontine ${nomEglise}_`;
};

// Assistant IA Membre
export const generateMemberAIResponse = (
  question: string,
  member: User,
  stats: UserStats,
  versements: Versement[],
  retraits: Retrait[] = [],
  devise: string = 'FCFA',
  tauxRetenue: number = 3
): string => {
  const q = question.toLowerCase();
  const userVersements = versements.filter((v) => v.user_id === member.id);
  const userRetraits = retraits.filter((r) => r.user_id === member.id);

  if (q.includes('retrait') || q.includes('retirer') || q.includes('partiel') || q.includes('urgence')) {
    if (stats.totalRetire > 0) {
      return `Vous avez déjà effectué **${formatMoney(stats.totalRetire, devise)}** de retrait(s) partiel(s). Votre solde actuel restant en caisse est de **${formatMoney(stats.soldeActuel, devise)}**. Vous pouvez demander un nouveau retrait auprès de l'administrateur dans la limite de ce solde.`;
    }
    return `Votre solde actuellement disponible en caisse est de **${formatMoney(stats.soldeActuel, devise)}** (sur un total versé de ${formatMoney(stats.totalVerse, devise)}). Vous pouvez solliciter un retrait partiel auprès de l'administrateur en cas de besoin sans attendre la fin d'année.`;
  }

  if (q.includes('combien') && (q.includes('recevoir') || q.includes('rendre') || q.includes('fin') || q.includes('toucher') || q.includes('restitution') || q.includes('fêtes'))) {
    return `Bonjour ${member.nom_complet} ! Sur votre total cotisé de ${formatMoney(stats.totalVerse, devise)}${stats.totalRetire > 0 ? ` (moins ${formatMoney(stats.totalRetire, devise)} déjà retirés)` : ''}, le montant prévisionnel que vous recevrez en fin d'année pour préparer vos fêtes est de **${formatMoney(stats.montantNetPrevisionnel, devise)}**, après déduction des ${tauxRetenue}% d'organisation pour l'église (${formatMoney(stats.partEglise, devise)}).`;
  }

  if (q.includes('total') || (q.includes('combien') && q.includes('donné') && !q.includes('mois'))) {
    return `À ce jour, vous avez cotisé un total de **${formatMoney(stats.totalVerse, devise)}** sur ${stats.nombreDimanches} dimanche(s). Votre solde actuel en caisse est de **${formatMoney(stats.soldeActuel, devise)}**.`;
  }

  if (q.includes('mois') || q.includes('février') || q.includes('janvier') || q.includes('mars')) {
    const recentSundays = [...new Set(userVersements.map((v) => v.date_dimanche))].sort().slice(-4);
    const recentVersements = userVersements.filter((v) => recentSundays.includes(v.date_dimanche));
    const totalMois = recentVersements.reduce((acc, v) => acc + Number(v.montant), 0);
    return `Sur vos ${recentSundays.length} derniers dimanches de cotisation, vous avez versé **${formatMoney(totalMois, devise)}**.`;
  }

  if (q.includes('série') || q.includes('flamme') || q.includes('badge') || q.includes('streak') || q.includes('point')) {
    return `🔥 Votre série actuelle est de **${stats.serieEnCours} dimanche(s) consécutif(s)** ! Vous cumulez **${stats.points} points** de régularité. Continuez sur ce rythme pour boucler l'année sereinement !`;
  }

  if (q.includes('3%') || q.includes('pourcent') || q.includes('frais') || q.includes('église')) {
    return `La règle de la tontine M.E.NO.JE est la suivante : l'église retient ${tauxRetenue}% sur le total de vos versements à la fin de l'exercice pour couvrir la gestion et les frais paroissiaux. Sur votre total de ${formatMoney(stats.totalVerse, devise)}, cela représente **${formatMoney(stats.partEglise, devise)}**. Vous recevrez le reste (**${formatMoney(stats.montantNetPrevisionnel, devise)}**).`;
  }

  return `Bonjour ${member.nom_complet}. À ce jour, vous avez cotisé **${formatMoney(stats.totalVerse, devise)}** (${stats.nombreDimanches} dimanches). Votre solde disponible en caisse est de **${formatMoney(stats.soldeActuel, devise)}**. En fin d'année, votre montant net à récupérer sera de **${formatMoney(stats.montantNetPrevisionnel, devise)}**.`;
};

// Assistant IA Administrateur
export const generateAdminAIAnalysis = (
  question: string,
  members: User[],
  versements: Versement[],
  retraits: Retrait[] = [],
  sundaysList: string[] = SUNDAYS_LIST,
  devise: string = 'FCFA',
  tauxRetenue: number = 3
): string => {
  const q = question.toLowerCase();
  const totalGlobalVerse = versements.reduce((sum, v) => sum + Number(v.montant), 0);
  const totalGlobalRetire = retraits.reduce((sum, r) => sum + Number(r.montant), 0);
  const soldeGlobalEnCaisse = totalGlobalVerse - totalGlobalRetire;
  const partEgliseTotale = Math.round(totalGlobalVerse * (tauxRetenue / 100));
  const netRestantAuxMembres = totalGlobalVerse - partEgliseTotale - totalGlobalRetire;

  if (q.includes('retrait') || q.includes('sorti') || q.includes('partiel')) {
    return `💼 **Bilan des retraits partiels en cours d'année :**\n\n` +
      `• Total des retraits accordés : **${formatMoney(totalGlobalRetire, devise)}** (${retraits.length} retraits)\n` +
      `• Solde actuellement en caisse : **${formatMoney(soldeGlobalEnCaisse, devise)}**\n` +
      `• Les membres ayant retiré de l'argent voient leur solde de fin d'année ajusté automatiquement.`;
  }

  if (q.includes('rien donné') || q.includes('retard') || q.includes('absent') || q.includes('relance')) {
    const last4Sundays = sundaysList.slice(-4);
    const activeMembers = members.filter((m) => m.role === 'membre' && m.statut === 'actif');
    const inactiveRecent = activeMembers.filter((m) => {
      const hasGiven = versements.some((v) => v.user_id === m.id && last4Sundays.includes(v.date_dimanche));
      return !hasGiven;
    });

    const noms = inactiveRecent.slice(0, 8).map((m) => `• **${m.nom_complet}** (${m.whatsapp_disponible ? 'WhatsApp dispo' : '⚠️ Sans smartphone / Remise papier'})`).join('\n');
    return `📋 **Membres n'ayant pas cotisé sur les 4 derniers dimanches :**\n\n` +
      `Il y a actuellement **${inactiveRecent.length} membre(s)** sans versement sur les 4 derniers dimanches (${last4Sundays.join(', ')}).\n\n` +
      `Membres à contacter avec le message WhatsApp/SMS prêt à l'emploi :\n${noms}\n\n` +
      `💡 *Rappel : Beaucoup de personnes ne viennent pas physiquement le dimanche mais peuvent faire un dépôt Mobile Money ou confier leur part.*`;
  }

  if (q.includes('meilleur') || q.includes('record') || q.includes('pic')) {
    const totalsBySunday: Record<string, number> = {};
    versements.forEach((v) => {
      totalsBySunday[v.date_dimanche] = (totalsBySunday[v.date_dimanche] || 0) + Number(v.montant);
    });

    let bestSunday = '';
    let maxMontant = 0;
    Object.entries(totalsBySunday).forEach(([dim, val]) => {
      if (val > maxMontant) {
        maxMontant = val;
        bestSunday = dim;
      }
    });

    return `🏆 **Meilleur dimanche d'épargne :**\n\nLe record de versement est celui du **${formatDateFr(bestSunday)}** avec un total de **${formatMoney(maxMontant, devise)}** collecté pour la tontine.`;
  }

  if (q.includes('résume') || q.includes('évolution') || q.includes('bilan') || q.includes('rapport')) {
    return `📈 **Bilan Global de la Tontine M.E.NO.JE 2026 :**\n\n` +
      `• **Total cotisé à ce jour :** ${formatMoney(totalGlobalVerse, devise)}\n` +
      `• **Retraits partiels accordés :** ${formatMoney(totalGlobalRetire, devise)}\n` +
      `• **Liquidités actuellement en caisse :** ${formatMoney(soldeGlobalEnCaisse, devise)}\n` +
      `• **Frais d'organisation église (${tauxRetenue}%) :** ${formatMoney(partEgliseTotale, devise)}\n` +
      `• **Net prévisionnel restant à rendre aux membres :** ${formatMoney(netRestantAuxMembres, devise)}\n` +
      `• **Nombre de dimanches enregistrés :** ${sundaysList.length} dimanches\n\n` +
      `🎯 *Objectif : Permettre à tous les 50 membres de passer d'excellentes fêtes de fin d'année sans dettes.*`;
  }

  return `📊 **Rapport général :** Total cotisé : **${formatMoney(totalGlobalVerse, devise)}**, retraits partiels : **${formatMoney(totalGlobalRetire, devise)}**, solde en caisse : **${formatMoney(soldeGlobalEnCaisse, devise)}**, part ${tauxRetenue}% église : **${formatMoney(partEgliseTotale, devise)}**.`;
};
