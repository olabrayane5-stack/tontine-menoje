import React, { useState } from 'react';
import { SessionSummary } from '../../types';
import { formatDateFr, formatMoney } from '../../utils/tontineUtils';
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Loader2,
  Lock,
  LockOpen,
} from 'lucide-react';

interface SessionsCardProps {
  sessions: SessionSummary[];
  devise?: string;
  onOpen: (date: string) => Promise<{ ok: boolean; message: string }>;
  onClose: (date: string) => Promise<{ ok: boolean; message: string }>;
  onReopen: (date: string) => Promise<{ ok: boolean; message: string }>;
}

type Feedback = { type: 'success' | 'error'; text: string };

/**
 * Gestion des dimanches côté serveur : ouvrir une session, la fermer
 * (les membres actifs sans versement reçoivent alors 0) ou la rouvrir.
 */
export const SessionsCard: React.FC<SessionsCardProps> = ({
  sessions,
  devise = 'FCFA',
  onOpen,
  onClose,
  onReopen,
}) => {
  const [date, setDate] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const openSession = sessions.find((session) => session.ouverte);
  const ordered = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  const run = async (key: string, action: () => Promise<{ ok: boolean; message: string }>) => {
    setBusy(key);
    setFeedback(null);
    try {
      const result = await action();
      setFeedback({ type: result.ok ? 'success' : 'error', text: result.message });
      if (result.ok && key === 'open') setDate('');
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Action impossible.',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    if (!date) {
      setFeedback({ type: 'error', text: 'Choisissez la date du dimanche.' });
      return;
    }
    void run('open', () => onOpen(date));
  };

  const handleClose = (session: SessionSummary) => {
    const confirmed = window.confirm(
      `Fermer le dimanche du ${formatDateFr(session.date)} ?\n\n` +
        'Les membres actifs sans montant recevront automatiquement un versement à 0. ' +
        'La session sera verrouillée jusqu’à une réouverture.'
    );
    if (!confirmed) return;
    void run(`close-${session.id}`, () => onClose(session.date));
  };

  const handleReopen = (session: SessionSummary) => {
    if (
      !window.confirm(
        `Rouvrir le dimanche du ${formatDateFr(session.date)} ?\n\n` +
          'La réouverture est journalisée. Les versements à 0 créés à la fermeture seront conservés.'
      )
    ) {
      return;
    }
    void run(`reopen-${session.id}`, () => onReopen(session.date));
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <CalendarPlus className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Dimanches & sessions</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Une seule session peut être ouverte à la fois. La fermeture verrouille la collecte et
            crédite 0 aux membres actifs sans versement.
          </p>
        </div>
      </div>

      {openSession && (
        <p className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800">
          <LockOpen className="h-3.5 w-3.5 shrink-0" />
          Session ouverte : dimanche du {formatDateFr(openSession.date)}
        </p>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="field flex-1 text-sm"
          aria-label="Date du dimanche à ouvrir"
        />
        <button type="submit" disabled={busy !== null} className="btn btn-accent btn-sm">
          {busy === 'open' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CalendarPlus className="h-3.5 w-3.5" />
          )}
          Ouvrir ce dimanche
        </button>
      </form>

      {feedback && (
        <p
          role="status"
          className={`flex items-start gap-1.5 text-xs font-semibold ${
            feedback.type === 'success' ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </p>
      )}

      <div className="max-h-64 divide-y divide-slate-200 overflow-y-auto rounded-xl border border-slate-200 bg-white">
        {ordered.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-slate-500">
            Aucun dimanche enregistré. Ouvrez le premier dimanche ci-dessus.
          </p>
        )}
        {ordered.map((session) => {
          const closing = busy === `close-${session.id}`;
          const reopening = busy === `reopen-${session.id}`;
          return (
            <div key={session.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800">{formatDateFr(session.date)}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-bold ${
                      session.ouverte
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {session.ouverte ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {session.ouverte ? 'Ouverte' : 'Fermée'}
                  </span>
                  {session.total !== null && (
                    <span>
                      {formatMoney(session.total, devise)} · {session.nbPresents ?? 0} présent(s)
                    </span>
                  )}
                </p>
              </div>

              {session.ouverte ? (
                <button
                  type="button"
                  onClick={() => handleClose(session)}
                  disabled={busy !== null}
                  className="btn btn-outline btn-sm"
                >
                  {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  Fermer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleReopen(session)}
                  disabled={busy !== null}
                  className="btn btn-ghost btn-sm"
                >
                  {reopening ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LockOpen className="h-3.5 w-3.5" />
                  )}
                  Rouvrir
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
