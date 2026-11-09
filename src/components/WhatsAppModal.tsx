import React, { useState } from 'react';
import { User, UserStats } from '../types';
import { generateWhatsAppMessage } from '../utils/tontineUtils';
import { Share2, Copy, Check, MessageSquare, X, ExternalLink, Smartphone } from 'lucide-react';

interface WhatsAppModalProps {
  member: User;
  stats: UserStats;
  devise: string;
  nomEglise: string;
  tauxRetenue?: number;
  onClose: () => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  member,
  stats,
  devise,
  nomEglise,
  tauxRetenue = 3,
  onClose,
}) => {
  const initialText = generateWhatsAppMessage(member, stats, devise, nomEglise, tauxRetenue);
  const [message, setMessage] = useState(initialText);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const cleanPhone = member.telephone.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="app-card max-w-lg w-full overflow-hidden rounded-2xl animate-slide-up">
        <div className="relative flex items-center justify-between overflow-hidden bg-slate-900 px-6 py-5 text-white">
          <div className="relative flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
              <MessageSquare className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold tracking-tight">Message WhatsApp & SMS</h3>
              <p className="text-[11px] text-slate-300">Un message clair, prêt à envoyer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="relative cursor-pointer rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-amber-500/10 blur-2xl" />
        </div>

        <div className="p-6">
          <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-800 font-bold shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">{member.nom_complet}</p>
              <p className="text-xs text-slate-500 font-mono">{member.telephone}</p>
              {!member.whatsapp_disponible && (
                <span className="inline-block mt-1 text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  ⚠️ Aîné sans smartphone - Envoi par SMS normal recommandé
                </span>
              )}
            </div>
          </div>

          <label className="field-label">
            Texte prêt à l'envoi (modifiable)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
            className="field resize-none font-mono text-xs leading-relaxed"
          />

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleCopy}
              className="btn btn-primary flex-1"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copié dans le presse-papier !' : 'Copier pour SMS'}
            </button>

            {member.whatsapp_disponible && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-accent flex-1"
              >
                <Share2 className="w-4 h-4" />
                Ouvrir sur WhatsApp
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
