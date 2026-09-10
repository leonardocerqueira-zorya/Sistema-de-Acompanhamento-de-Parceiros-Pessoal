import React, { useMemo, useState } from 'react';
import type { Referral } from '../types';
import { calculateMonthlyChurn } from '../utils/churnAnalytics';
import { formatCurrency, formatDateBR } from '../utils/analytics';
import { TrendingDown, ChevronDown, ChevronUp, XCircle } from 'lucide-react';

interface ChurnReportProps {
  referrals: Referral[];
  onSelectReferral?: (referralId: string) => void;
}

export default function ChurnReport({ referrals, onSelectReferral }: ChurnReportProps) {
  const monthlyChurn = useMemo(() => calculateMonthlyChurn(referrals), [referrals]);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  const totalChurnedCount = monthlyChurn.reduce((sum, m) => sum + m.churnedCount, 0);
  const totalChurnedVolume = monthlyChurn.reduce((sum, m) => sum + m.churnedVolume, 0);

  if (totalChurnedCount === 0) {
    return null; // Sem cancelamentos ainda — não vale poluir o Dashboard com uma tabela vazia
  }

  return (
    <div className="bg-zry-surface rounded-3xl p-6 border border-zry-border/90 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zry-border pb-4">
        <div>
          <h3 className="text-base font-bold text-zry-text flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-zry-danger" />
            Cancelamentos por Mês
          </h3>
          <p className="text-xs text-zry-text-2 mt-0.5">
            Clique em um mês para abrir a lista de clientes que cancelaram naquele período.
          </p>
        </div>
        <span className="text-xs font-semibold text-zry-text-2">
          {totalChurnedCount} cancelamento(s) — {formatCurrency(totalChurnedVolume)} de MRR perdido
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-zry-text-2">
          <thead className="bg-zry-lilas-30 text-zry-text-2 font-semibold border-b border-zry-border uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 px-3">Mês</th>
              <th className="py-3 px-3 text-center">Cancelamentos</th>
              <th className="py-3 px-3 text-right">MRR Perdido</th>
              <th className="py-3 px-3 text-center">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zry-border">
            {monthlyChurn.slice().reverse().map(m => {
              const isSelected = selectedMonthKey === m.monthKey;
              return (
                <React.Fragment key={m.monthKey}>
                  <tr
                    className={`hover:bg-zry-lilas-30/80 transition ${m.churnedCount > 0 ? 'cursor-pointer' : ''} ${
                      isSelected ? 'bg-zry-info-bg/40 font-medium' : ''
                    }`}
                    onClick={() => m.churnedCount > 0 && setSelectedMonthKey(isSelected ? null : m.monthKey)}
                  >
                    <td className="py-3 px-3 font-bold text-zry-text">{m.monthLabel}</td>
                    <td className="py-3 px-3 text-center font-bold text-zry-danger">
                      {m.churnedCount > 0 ? m.churnedCount : <span className="text-zry-text-2 font-normal">—</span>}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-zry-text">
                      {m.churnedVolume > 0 ? formatCurrency(m.churnedVolume) : <span className="text-zry-text-2 font-normal">—</span>}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {m.churnedCount > 0 && (
                        <button type="button" className="text-zry-text-2 hover:text-zry-text-2 p-1">
                          {isSelected ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </td>
                  </tr>

                  {isSelected && (
                    <tr>
                      <td colSpan={4} className="p-4 bg-zry-lilas-30/70 border-y border-zry-border">
                        <div className="bg-zry-surface rounded-xl border border-zry-border overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-zry-lilas-30 text-zry-text-2 font-semibold text-[10px] uppercase">
                              <tr>
                                <th className="py-2 px-3">Cliente</th>
                                <th className="py-2 px-3">Parceiro</th>
                                <th className="py-2 px-3">Data Fechamento</th>
                                <th className="py-2 px-3">Cancelado em</th>
                                <th className="py-2 px-3">Motivo</th>
                                <th className="py-2 px-3 text-right">MRR Perdido</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zry-border">
                              {m.referrals.map(r => (
                                <tr
                                  key={r.id}
                                  className="hover:bg-zry-lilas-30 transition cursor-pointer"
                                  onClick={() => onSelectReferral && onSelectReferral(r.id)}
                                >
                                  <td className="py-2 px-3 font-semibold text-zry-text">{r.clientName}</td>
                                  <td className="py-2 px-3 text-zry-text-2">{r.partnerName}</td>
                                  <td className="py-2 px-3 text-zry-text-2">{formatDateBR(r.closeDate)}</td>
                                  <td className="py-2 px-3">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zry-danger-bg text-zry-danger">
                                      <XCircle className="w-3 h-3" /> {formatDateBR(r.churnedAt)}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-zry-text-2">{r.churnReason || '—'}</td>
                                  <td className="py-2 px-3 text-right font-bold text-zry-text">
                                    {formatCurrency(Number(r.dealValue) || 0)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
