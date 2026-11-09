import React, { useState } from 'react';
import { Versement } from '../types';
import { formatDateFr } from '../utils/tontineUtils';
import { AlertTriangle, CalendarPlus, CheckCircle2, Trash2 } from 'lucide-react';

interface SundayManagerProps {
  sundaysList: string[];
  versements: Versement[];
  onAddSunday: (date: string) => { ok: boolean; message: string };
  onDeleteSunday: (date: string) => { ok: boolean; message: string };
}

type Feedback = { type: 'success' | 'error'; text: string };

export const SundayManager: React.FC<SundayManagerProps> = ({
  sundaysList,
  versements,
  onAddSunday,
  onDeleteSunday,
}) => {
  const [date, setDate] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    const result = onAddSunday(date);
    setFeedback({ type: result.ok ? 'success' : 'error', text: result.message });
    if (result.ok) setDate('');
  };

  const handleDelete = (sunday: string) => {
    const count = versements.filter((versement) => versement.date_dimanche === sunday).length;
    if (count > 0) {
      setFeedback({
        type: 'error',
        text: `Suppression refusée : ${count} versement(s) sont rattachés au ${formatDateFr(sunday)}.`,
      });
      return;
    }
    if (!window.confirm(`Retirer le dimanche ${formatDateFr(sunday)} du calendrier ?`)) return;
    const result = onDeleteSunday(sunday);
    setFeedback({ type: result.ok ? 'success' : 'error', text: result.message });
  };

  return (
    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <CalendarPlus className="w-4 h-4" />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm">Calendrier des dimanches</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Ajoutez les dimanches de cotisation. Un dimanche déjà utilisé ne peut pas être supprimé.
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="field flex-1 text-sm"
          aria-label="Date du nouveau dimanche"
        />
        <button
          type="submit"
          className="btn btn-accent btn-sm"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          Ajouter ce dimanche
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
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </p>
      )}

      <div className="max-h-56 overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
        {sundaysList.length === 0 && (
          <p className="px-3 py-4 text-xs text-slate-500 text-center">Aucun dimanche enregistré.</p>
        )}
        {sundaysList.map((sunday) => (
          <div key={sunday} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-xs font-semibold text-slate-700">{formatDateFr(sunday)}</span>
            <button
              type="button"
              onClick={() => handleDelete(sunday)}
              aria-label={`Supprimer le dimanche ${formatDateFr(sunday)}`}
              title="Supprimer ce dimanche"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
