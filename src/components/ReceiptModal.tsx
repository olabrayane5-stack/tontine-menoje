import React from 'react';
import { User, Versement, Retrait, UserStats } from '../types';
import { formatMoney, formatDateFr } from '../utils/tontineUtils';
import { Printer, X, ShieldCheck, Download, PiggyBank, ArrowDownRight } from 'lucide-react';

interface ReceiptModalProps {
  member: User;
  stats: UserStats;
  versements: Versement[];
  retraits?: Retrait[];
  devise: string;
  nomEglise: string;
  tauxRetenue?: number;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  member,
  stats,
  versements,
  retraits = [],
  devise,
  nomEglise,
  tauxRetenue = 3,
  onClose,
}) => {
  const memberVersements = versements
    .filter((v) => v.user_id === member.id)
    .sort((a, b) => new Date(a.date_dimanche).getTime() - new Date(b.date_dimanche).getTime());

  const memberRetraits = retraits
    .filter((r) => r.user_id === member.id)
    .sort((a, b) => new Date(a.date_retrait).getTime() - new Date(b.date_retrait).getTime());

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="print-receipt bg-white text-slate-800 rounded-[1.75rem] max-w-2xl w-full shadow-2xl overflow-hidden my-8 print:m-0 print:p-0 print:shadow-none print:w-full print:max-w-none print:rounded-none animate-slide-up">
        {/* Actions bar (hidden during print) */}
        <div className="flex items-center justify-between gap-3 bg-slate-900 px-5 py-4 text-white print:hidden sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
              <Printer className="w-4 h-4" />
            </span>
            <h3 className="font-display text-sm font-bold sm:text-base">Relevé individuel d'épargne</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn btn-accent btn-sm"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimer / PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="cursor-pointer rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 print:p-8 bg-white" id="printable-receipt">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-amber-500 pb-5 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 print:text-black">
                <PiggyBank className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">TONTINE {nomEglise}</h1>
                <p className="text-xs uppercase font-semibold text-amber-600 tracking-wider">
                  Service d'Épargne & Fêtes de Fin d'Année
                </p>
                <p className="text-xs text-slate-500">Exercice Annuel 2026 • Janvier à Novembre / Décembre</p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full uppercase tracking-wider print:border">
                Relevé Certifié
              </span>
              <p className="text-xs text-slate-400 mt-1">Édition : {new Date().toLocaleDateString('fr-FR')}</p>
            </div>
          </div>

          {/* Member Card Information */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6 flex flex-wrap justify-between items-center gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Nom du membre</p>
              <p className="text-lg font-bold text-slate-900">{member.nom_complet}</p>
              <p className="text-sm text-slate-600 font-mono">{member.telephone}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Statut</p>
              <p className="text-sm font-semibold text-emerald-600 flex items-center gap-1 justify-end">
                <ShieldCheck className="w-4 h-4" /> Membre Actif
              </p>
              <p className="text-xs text-slate-500">Inscrit le {formatDateFr(member.created_at)}</p>
            </div>
          </div>

          {/* Financial Totals Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
              <p className="text-[10px] font-semibold text-blue-800 uppercase">Total Versé</p>
              <p className="text-base font-bold text-blue-950 mt-1">{formatMoney(stats.totalVerse, devise)}</p>
              <p className="text-[10px] text-blue-600">{stats.nombreDimanches} dimanches</p>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
              <p className="text-[10px] font-semibold text-rose-800 uppercase">Retraits Partiels</p>
              <p className="text-base font-bold text-rose-950 mt-1">{formatMoney(stats.totalRetire, devise)}</p>
              <p className="text-[10px] text-rose-600">{memberRetraits.length} retrait(s)</p>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <p className="text-[10px] font-semibold text-amber-800 uppercase">Frais Église ({tauxRetenue}%)</p>
              <p className="text-base font-bold text-amber-950 mt-1">{formatMoney(stats.partEglise, devise)}</p>
              <p className="text-[10px] text-amber-600">Organisation</p>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <p className="text-[10px] font-semibold text-emerald-800 uppercase">Solde Net Fêtes</p>
              <p className="text-lg font-black text-emerald-950 mt-1">{formatMoney(stats.montantNetPrevisionnel, devise)}</p>
              <p className="text-[10px] text-emerald-600">À récupérer en fin d'année</p>
            </div>
          </div>

          {/* Retraits en cours d'année if any */}
          {memberRetraits.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ArrowDownRight className="w-4 h-4" />
                Retraits d'urgence effectués en cours d'année ({memberRetraits.length})
              </h4>
              <div className="border border-rose-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-rose-50 text-rose-800 font-semibold border-b border-rose-200">
                      <th className="py-2 px-3">Date du retrait</th>
                      <th className="py-2 px-3">Motif / Justification</th>
                      <th className="py-2 px-3 text-right">Montant retiré</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 text-slate-700">
                    {memberRetraits.map((r) => (
                      <tr key={r.id}>
                        <td className="py-1.5 px-3 font-medium">{formatDateFr(r.date_retrait)}</td>
                        <td className="py-1.5 px-3 text-slate-600">{r.motif || 'Retrait anticipé'}</td>
                        <td className="py-1.5 px-3 text-right font-bold text-rose-700">
                          - {formatMoney(r.montant, devise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sunday-by-Sunday Detail Table */}
          <div className="mb-6">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Détail chronologique des cotisations ({memberVersements.length})
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden text-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-xs font-semibold border-b border-slate-200">
                    <th className="py-2 px-3">N°</th>
                    <th className="py-2 px-3">Dimanche</th>
                    <th className="py-2 px-3">Mode</th>
                    <th className="py-2 px-3 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {memberVersements.map((v, idx) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="py-1.5 px-3 text-xs text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-1.5 px-3 font-medium text-xs sm:text-sm">{formatDateFr(v.date_dimanche)}</td>
                      <td className="py-1.5 px-3 text-xs capitalize text-slate-500">
                        {v.mode_reglement === 'especes' ? 'Espèces' : 'Mobile Money'}
                      </td>
                      <td className="py-1.5 px-3 text-right font-semibold text-slate-900 text-xs sm:text-sm">
                        {formatMoney(v.montant, devise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signature / Stamp Section */}
          <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-200 text-xs text-slate-500">
            <div>
              <p className="font-semibold text-slate-700 mb-8">Visa du Membre :</p>
              <div className="border-b border-dashed border-slate-400 w-40"></div>
            </div>
            <div className="text-right flex flex-col items-end">
              <p className="font-semibold text-slate-700 mb-8">Cachet & Signature Administrateur :</p>
              <div className="w-32 h-16 border-2 border-dashed border-amber-400 rounded-lg flex items-center justify-center text-[10px] text-amber-700 text-center font-bold">
                TONTINE {nomEglise}<br />GESTION FINANCIÈRE
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
