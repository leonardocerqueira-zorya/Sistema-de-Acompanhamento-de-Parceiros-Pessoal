import { useState, useEffect, type FormEvent } from 'react';
import type { Partner, Referral, DealStatus } from '../types';
import { evaluateMissingFields } from '../services/sheetsService';
import { Hash, AlertTriangle, ShieldCheck, Layers } from 'lucide-react';

interface BulkReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (referrals: Referral[]) => void;
  partners: Partner[];
}

const STATUS_OPTIONS: { value: DealStatus; label: string }[] = [
  { value: 'perdido', label: 'Perdido' },
  { value: 'ganho', label: 'Ganho / Fechado' },
  { value: 'negociacao', label: 'Em Negociação' },
  { value: 'qualificado', label: 'Qualificado' },
  { value: 'contato', label: 'Primeiro Contato' },
  { value: 'novo', label: 'Novo Lead' }
];

export default function BulkReferralModal({
  isOpen,
  onClose,
  onCreate,
  partners
}: BulkReferralModalProps) {
  const [partnerId, setPartnerId] = useState('');
  const [dealStatus, setDealStatus] = useState<DealStatus>('perdido');
  const [quantity, setQuantity] = useState<string>('1');
  const [referenceDate, setReferenceDate] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPartnerId(partners[0]?.id || '');
      setDealStatus('perdido');
      setQuantity('1');
      setReferenceDate(new Date().toISOString().slice(0, 10));
      setNote('');
    }
  }, [isOpen, partners]);

  const qtyNum = Math.max(0, Math.min(500, parseInt(quantity, 10) || 0));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const partner = partners.find(p => p.id === partnerId);
    if (!partner) {
      alert('Selecione o parceiro indicador para o lote.');
      return;
    }
    if (qtyNum < 1) {
      alert('Informe uma quantidade de indicações maior que zero.');
      return;
    }
    if (!referenceDate) {
      alert('Informe a data de referência (define a safra das indicações).');
      return;
    }

    const created: Referral[] = [];
    for (let i = 0; i < qtyNum; i++) {
      const base: Partial<Referral> = {
        id: 'ref-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8),
        partnerId: partner.id,
        partnerName: partner.name,
        clientName: '', // sem empresa vinculada (a completar pelo executivo)
        referralDate: referenceDate,
        dealStatus,
        // Won bulk items keep commission pending until a real cadastro define valores
        commissionStatus: dealStatus === 'ganho' ? 'a_pagar' : 'pendente_fechamento',
        closeDate: dealStatus === 'ganho' ? referenceDate : undefined,
        notes: note.trim() || undefined,
        isPlaceholder: true
      };
      const missingFields = evaluateMissingFields(base);
      created.push({
        ...(base as Referral),
        hasMissingData: true,
        missingFields
      });
    }

    onCreate(created);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-amber-300 rounded-xl">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Registrar Indicações sem Empresa (Lote)
              </h3>
              <p className="text-xs text-slate-500">
                Backfill de quantidade + status para preservar a taxa de conversão e o histórico de perdidos
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
        </div>

        {/* Master-only warning */}
        <div className="mt-4 bg-slate-900 text-slate-100 text-xs p-3 rounded-xl flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-300">Recurso exclusivo do acesso Master.</span>
            <p className="text-slate-300 mt-0.5">
              Cada indicação criada aqui entra como um número (sem empresa) e ficará visível para o executivo
              <strong className="text-white"> completar o cadastro da empresa</strong> depois. O time não deve registrar indicações assim no dia a dia.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Parceiro Indicador *</label>
            {partners.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Cadastre ao menos um parceiro antes de registrar indicações em lote.</span>
              </div>
            ) : (
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-1 focus:ring-emerald-500"
              >
                {partners
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.responsiblePerson ? ` — ${p.responsiblePerson}` : ''}
                    </option>
                  ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status Comercial *</label>
              <select
                value={dealStatus}
                onChange={(e) => setDealStatus(e.target.value as DealStatus)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:ring-1 focus:ring-emerald-500"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quantidade *</label>
              <input
                type="number"
                min={1}
                max={500}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Data de Referência *</label>
              <input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-500">Define a safra das indicações.</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Observação do lote (opcional)</label>
            <input
              type="text"
              placeholder="Ex: Backfill histórico agosto/2026 — planilha antiga"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700">
            <span className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              Resumo
            </span>
            <p className="mt-1">
              Serão criadas <strong className="text-slate-900">{qtyNum}</strong> indicação(ões) sem empresa
              com status <strong className="text-slate-900">{STATUS_OPTIONS.find(s => s.value === dealStatus)?.label}</strong>,
              vinculadas ao parceiro selecionado. Cada uma aparecerá como pendência "completar cadastro".
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={partners.length === 0 || qtyNum < 1}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs transition disabled:opacity-50"
            >
              Criar {qtyNum > 0 ? `${qtyNum} indicação(ões)` : 'indicações'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
