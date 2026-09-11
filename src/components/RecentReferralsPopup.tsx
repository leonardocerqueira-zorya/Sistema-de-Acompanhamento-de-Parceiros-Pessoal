import { useEffect, useMemo, useState } from 'react';
import type { DealStatus, Referral } from '../types';
import { CalendarDays, Clock3, X } from 'lucide-react';

interface RecentReferralsPopupProps {
  referrals: Referral[];
  onOpenReferral?: (referral: Referral) => void;
}

const statusLabels: Record<DealStatus, string> = {
  novo: 'Novo',
  contato: 'Em contato',
  qualificado: 'Qualificado',
  negociacao: 'Negociação',
  ganho: 'Ganho / Fechado',
  perdido: 'Perdido'
};

const statusClasses: Record<DealStatus, string> = {
  novo: 'bg-zry-lilas-30 text-zry-roxo',
  contato: 'bg-blue-50 text-blue-700',
  qualificado: 'bg-cyan-50 text-cyan-700',
  negociacao: 'bg-amber-50 text-amber-700',
  ganho: 'bg-zry-positive-bg text-zry-positive',
  perdido: 'bg-red-50 text-red-700'
};

const parseLocalDate = (value?: string) => value ? new Date(`${value}T12:00:00`) : null;

export default function RecentReferralsPopup({
  referrals,
  onOpenReferral
}: RecentReferralsPopupProps) {
  const [open, setOpen] = useState(false);
  const storageKey = `recent-referrals-popup-${new Date().toISOString().slice(0, 10)}`;

  const recent = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    return referrals
      .filter(referral => {
        const date = parseLocalDate(referral.referralDate);
        return date && date >= start && date <= end;
      })
      .sort((a, b) => (b.referralDate || '').localeCompare(a.referralDate || ''));
  }, [referrals]);

  useEffect(() => {
    if (sessionStorage.getItem(storageKey)) return;
    const timer = window.setTimeout(() => setOpen(true), 500);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  const close = () => {
    sessionStorage.setItem(storageKey, 'seen');
    setOpen(false);
  };

  if (!open) return null;

  const won = recent.filter(referral => referral.dealStatus === 'ganho').length;
  const openDeals = recent.filter(referral => !['ganho', 'perdido'].includes(referral.dealStatus)).length;

  return (
    <div className="fixed inset-0 z-[100] bg-zry-roxo/35 backdrop-blur-[2px] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="recent-referrals-title">
      <div className="w-full max-w-3xl max-h-[82vh] bg-zry-surface rounded-3xl border border-zry-border shadow-2xl overflow-hidden flex flex-col">
        <div className="p-5 sm:p-6 border-b border-zry-border flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-zry-lilas-30 text-zry-roxo">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 id="recent-referrals-title" className="text-lg font-extrabold text-zry-text">Últimas indicações</h2>
              <p className="text-xs text-zry-text-2 mt-1">
                Registradas nos últimos 7 dias e com o status comercial atual.
              </p>
            </div>
          </div>
          <button type="button" onClick={close} className="p-2 rounded-full text-zry-text-2 hover:bg-zry-lilas-30 hover:text-zry-roxo transition" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 p-4 sm:px-6 bg-zry-lilas-30/35 border-b border-zry-border">
          <Summary label="Indicações" value={recent.length} />
          <Summary label="Em andamento" value={openDeals} />
          <Summary label="Ganhas" value={won} />
        </div>

        <div className="overflow-y-auto p-4 sm:p-6">
          {recent.length === 0 ? (
            <div className="py-10 text-center">
              <Clock3 className="w-8 h-8 text-zry-text-2/50 mx-auto" />
              <p className="text-sm font-bold text-zry-text mt-3">Nenhuma indicação nos últimos 7 dias</p>
              <p className="text-xs text-zry-text-2 mt-1">A lista respeita a carteira disponível para o seu acesso.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map(referral => (
                <button
                  key={referral.id}
                  type="button"
                  onClick={() => onOpenReferral?.(referral)}
                  className={`w-full rounded-2xl border border-zry-border p-3.5 sm:p-4 text-left transition ${onOpenReferral ? 'hover:border-zry-roxo/40 hover:bg-zry-lilas-30/25' : 'cursor-default'}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zry-text truncate">{referral.clientName || 'Cliente não informado'}</p>
                      <p className="text-[11px] text-zry-text-2 mt-0.5 truncate">
                        {referral.partnerName} · {formatDate(referral.referralDate)}
                      </p>
                    </div>
                    <span className={`self-start sm:self-auto shrink-0 px-2.5 py-1 rounded-full text-[10.5px] font-bold ${statusClasses[referral.dealStatus]}`}>
                      {statusLabels[referral.dealStatus]}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 sm:px-6 border-t border-zry-border flex justify-end">
          <button type="button" onClick={close} className="px-5 py-2.5 rounded-full bg-zry-roxo text-zry-creme text-xs font-bold hover:bg-zry-roxo-hover transition">
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-zry-surface border border-zry-border p-2.5 text-center">
      <p className="text-lg font-extrabold text-zry-text">{value}</p>
      <p className="text-[10px] text-zry-text-2 font-semibold">{label}</p>
    </div>
  );
}

function formatDate(value?: string) {
  const date = parseLocalDate(value);
  return date ? date.toLocaleDateString('pt-BR') : 'Data não informada';
}
