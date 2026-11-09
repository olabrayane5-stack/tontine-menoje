import React, { useRef, useState } from 'react';
import { AppData } from '../types';
import { downloadBackup, downloadCsv, parseBackup } from '../utils/backup';
import { AlertTriangle, CheckCircle2, Database, Download, FileSpreadsheet, Upload } from 'lucide-react';

interface BackupCardProps {
  data: AppData;
  onRestore: (data: AppData) => void;
}

type Feedback = { type: 'success' | 'error'; text: string };

export const BackupCard: React.FC<BackupCardProps> = ({ data, onRestore }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const handleExportJson = () => {
    downloadBackup(data);
    setFeedback({ type: 'success', text: 'Sauvegarde JSON téléchargée.' });
  };

  const handleExportCsv = () => {
    downloadCsv(data);
    setFeedback({ type: 'success', text: 'Historique des opérations exporté en CSV.' });
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

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
    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <Database className="w-4 h-4" />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm">Sauvegarde des données</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Exportez régulièrement vos données : elles vivent uniquement dans ce navigateur.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExportJson}
          className="btn btn-primary btn-sm"
        >
          <Download className="w-3.5 h-3.5" />
          Exporter (JSON)
        </button>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn btn-outline btn-sm"
        >
          <Upload className="w-3.5 h-3.5" />
          Restaurer une sauvegarde
        </button>

        <button
          type="button"
          onClick={handleExportCsv}
          className="btn btn-accent btn-sm"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
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
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </p>
      )}
    </div>
  );
};
