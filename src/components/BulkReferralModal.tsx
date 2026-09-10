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
    <div className="fixed inset-0 z-50 bg-zry-roxo/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zry-surface rounded-zry-xl border border-zry-border shadow-lg max-w-lg w-full p-6 my-8">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-zry-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zry-lilas-30 text-zry-roxo flex items-center justify-center shrink-0">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-zry-text">
                Registrar Indicações sem Empresa (Lote)
              </h3>
              <p className="text-[12px] text-zry-text-2 mt-0.5">
                Backfill de quantidade + status para preservar a taxa de conversão e o histórico de perdidos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zry-text-2 hover:text-zry-text font-bold text-sm w-8 h-8 rounded-full hover:bg-zry-lilas-30 transition shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Master-only warning */}
        <div className="mt-4 bg-zry-warning-bg border border-zry-warning/30 text-zry-warning rounded-zry-lg p-3.5 text-[12px] flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-zry-warning shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Recurso exclusivo do acesso Master.</span>
            <p className="mt-0.5 leading-relaxed">
              Cada indicação criada aqui entra como um número (sem empresa) e ficará visível para o executivo
              <strong> completar o cadastro da empresa</strong> depois. O time não deve registrar indicações assim no dia a dia.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Parceiro Indicador *</label>
            {partners.length === 0 ? (
              <div className="bg-zry-warning-bg border border-zry-warning/30 text-zry-warning rounded-zry-lg p-3.5 text-[12px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Cadastre ao menos um parceiro antes de registrar indicações em lote.</span>
              </div>
            ) : (
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
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
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Status Comercial *</label>
              <select
                value={dealStatus}
                onChange={(e) => setDealStatus(e.target.value as DealStatus)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Quantidade *</label>
              <input
                type="number"
                min={1}
                max={500}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Data de Referência *</label>
              <input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              />
              <span className="block text-[10px] text-zry-text-2 mt-1">Define a safra das indicações.</span>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Observação do lote (opcional)</label>
            <input
              type="text"
              placeholder="Ex: Backfill histórico agosto/2026 — planilha antiga"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
            />
          </div>

          <div className="bg-zry-lilas-30 border border-zry-border text-zry-text-2 rounded-zry-lg p-3.5 text-[12px]">
            <span className="flex items-center gap-1.5 font-semibold text-zry-text">
              <Layers className="w-3.5 h-3.5 text-zry-roxo" />
              Resumo
            </span>
            <p className="mt-1 leading-relaxed">
              Serão criadas <strong className="text-zry-text">{qtyNum}</strong> indicação(ões) sem empresa
              com status <strong className="text-zry-text">{STATUS_OPTIONS.find(s => s.value === dealStatus)?.label}</strong>,
              vinculadas ao parceiro selecionado. Cada uma aparecerá como pendência "completar cadastro".
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zry-border">
            <button
              type="button"
              onClick={onClose}
              className="text-zry-text-2 hover:text-zry-text font-semibold px-4 py-2.5 rounded-full text-[12.5px] transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={partners.length === 0 || qtyNum < 1}
              className="bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-5 py-2.5 rounded-full text-[12.5px] transition disabled:opacity-50"
            >
              Criar {qtyNum > 0 ? `${qtyNum} indicação(ões)` : 'indicações'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
