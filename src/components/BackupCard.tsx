import React, { useRef, useState } from 'react';
import { AppData } from '../types';
import { downloadBackup, downloadCsv, parseBackup } from '../utils/backup';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';

interface BackupCardProps {
  data: AppData;
  onRestore?: (data: AppData) => void;
  /** Exports serveur (mode API). À défaut, les exports locaux sont utilisés. */
  onExportJson?: () => Promise<void>;
  onExportCsv?: () => Promise<void>;
  /** La restauration n'est proposée qu'en mode démonstration. */
  canRestore?: boolean;
  hint?: string;
}

type Feedback = { type: 'success' | 'error'; text: string };

export const BackupCard: React.FC<BackupCardProps> = ({
  data,
  onRestore,
  onExportJson,
  onExportCsv,
  canRestore = true,
  hint,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState<'json' | 'csv' | null>(null);

  const handleExportJson = async () => {
    setBusy('json');
    setFeedback(null);
    try {
      if (onExportJson) await onExportJson();
      else downloadBackup(data);
      setFeedback({ type: 'success', text: 'Sauvegarde JSON téléchargée.' });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Téléchargement impossible.',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleExportCsv = async () => {
    setBusy('csv');
    setFeedback(null);
    try {
      if (onExportCsv) await onExportCsv();
      else downloadCsv(data);
      setFeedback({ type: 'success', text: 'Historique des opérations exporté en CSV.' });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Téléchargement impossible.',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onRestore) return;

    try {
      const restored = parseBackup(await file.text());
      const confirmed = window.confirm(
        `Restaurer « ${file.name} » ?\n\n` +
          `Les données actuelles seront remplacées par :\n` +
          `• ${restored.users.length} membre(s)\n` +
          `• ${restored.versements.length} versement(s)\n` +
          `• ${restored.retraits.length} retrait(s)\n` +
          `• ${restored.sundaysList.length} dimanche(s)`
      );
      if (!confirmed) return;

      onRestore(restored);
      setFeedback({ type: 'success', text: 'Sauvegarde restaurée avec succès.' });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Impossible de lire ce fichier.',
      });
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <Database className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Sauvegarde des données</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {hint ??
              'Exportez régulièrement vos données : elles vivent uniquement dans ce navigateur.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExportJson}
          disabled={busy !== null}
          className="btn btn-primary btn-sm"
        >
          {busy === 'json' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Exporter (JSON)
        </button>

        {canRestore && onRestore && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn btn-outline btn-sm"
          >
            <Upload className="h-3.5 w-3.5" />
            Restaurer une sauvegarde
          </button>
        )}

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={busy !== null}
          className="btn btn-accent btn-sm"
        >
          {busy === 'csv' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-3.5 w-3.5" />
          )}
          Exporter (CSV)
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImport}
        />
      </div>

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
    </div>
  );
};
