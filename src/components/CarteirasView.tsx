import { useMemo, useState } from 'react';
import type { Partner, Referral } from '../types';
import { formatCurrency } from '../utils/analytics';
import {
  Briefcase,
  Users,
  ChevronDown,
  ChevronUp,
  UserCheck,
  AlertTriangle,
  Filter,
  TrendingUp
} from 'lucide-react';

interface CarteirasViewProps {
  partners: Partner[];
  referrals: Referral[];
  onSelectPartnerForReferrals: (partnerId: string) => void;
  onEditPartner: (partner: Partner) => void;
}

interface ExecutiveGroup {
  executive: string;
  isUnassigned: boolean;
  partners: Partner[];
  totalReferrals: number;
  wonReferrals: number;
  lostReferrals: number;
  pipelineReferrals: number;
  wonVolume: number;
  conversionRate: number;
}

export default function CarteirasView({
  partners,
  referrals,
  onSelectPartnerForReferrals,
  onEditPartner
}: CarteirasViewProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = useMemo<ExecutiveGroup[]>(() => {
    const refsByPartner = new Map<string, Referral[]>();
    referrals.forEach(r => {
      if (!refsByPartner.has(r.partnerId)) refsByPartner.set(r.partnerId, []);
      refsByPartner.get(r.partnerId)!.push(r);
    });

    const map = new Map<string, ExecutiveGroup>();
    partners.forEach(p => {
      const execName = (p.responsiblePerson || '').trim();
      const key = execName ? execName.toLowerCase() : '__unassigned__';
      if (!map.has(key)) {
        map.set(key, {
          executive: execName || 'Sem executivo definido',
          isUnassigned: !execName,
          partners: [],
          totalReferrals: 0,
          wonReferrals: 0,
          lostReferrals: 0,
          pipelineReferrals: 0,
          wonVolume: 0,
          conversionRate: 0
        });
      }
      const g = map.get(key)!;
      g.partners.push(p);

      const pRefs = refsByPartner.get(p.id) || [];
      pRefs.forEach(r => {
        g.totalReferrals += 1;
        if (r.dealStatus === 'ganho') {
          g.wonReferrals += 1;
          if (r.dealValue) g.wonVolume += r.dealValue;
        } else if (r.dealStatus === 'perdido') {
          g.lostReferrals += 1;
        } else {
          g.pipelineReferrals += 1;
        }
      });
    });

    const list = Array.from(map.values());
    list.forEach(g => {
      g.conversionRate = g.totalReferrals > 0 ? (g.wonReferrals / g.totalReferrals) * 100 : 0;
    });
    // Executivos com carteira primeiro; "sem executivo" por último.
    return list.sort((a, b) => {
      if (a.isUnassigned !== b.isUnassigned) return a.isUnassigned ? 1 : -1;
      return b.totalReferrals - a.totalReferrals;
    });
  }, [partners, referrals]);

  const totalExecutives = groups.filter(g => !g.isUnassigned).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Carteiras por Executivo</h2>
            <p className="text-xs text-slate-500 max-w-xl">
              Cada parceiro pertence a um executivo (Pessoa Responsável). Acompanhe a carteira, o volume e a conversão de cada executivo.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 text-center">
            <span className="block text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Executivos</span>
            <span className="text-xl font-black text-slate-900">{totalExecutives}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 text-center">
            <span className="block text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Parceiros</span>
            <span className="text-xl font-black text-slate-900">{partners.length}</span>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center text-sm text-slate-500">
          Nenhum parceiro cadastrado ainda. Cadastre parceiros e informe a Pessoa Responsável para montar as carteiras.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => {
            const key = g.isUnassigned ? '__unassigned__' : g.executive.toLowerCase();
            const isOpen = expanded === key;
            return (
              <div
                key={key}
                className={`bg-white rounded-2xl border shadow-xs overflow-hidden ${
                  g.isUnassigned ? 'border-amber-200' : 'border-slate-200/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : key)}
                  className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 text-left hover:bg-slate-50/70 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${g.isUnassigned ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {g.isUnassigned ? <AlertTriangle className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        {g.executive}
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {g.partners.length} parceiro(s)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {g.totalReferrals} indicação(ões) • {g.wonReferrals} ganhas • {g.lostReferrals} perdidas • {g.pipelineReferrals} em aberto
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="block text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Conversão</span>
                      <span className={`text-sm font-black ${g.conversionRate >= 50 ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {g.conversionRate.toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Volume Ganho</span>
                      <span className="text-sm font-bold text-slate-900">{formatCurrency(g.wonVolume)}</span>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                    {g.isUnassigned && (
                      <div className="mb-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Estes parceiros estão sem executivo. Edite cada parceiro e informe a Pessoa Responsável para atribuí-los a uma carteira.
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-slate-500 uppercase tracking-wider font-semibold text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Parceiro</th>
                            <th className="py-2 px-3">Perfil</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {g.partners.map(p => (
                            <tr key={p.id} className="hover:bg-white transition">
                              <td className="py-2 px-3 font-semibold text-slate-900">{p.name}</td>
                              <td className="py-2 px-3 text-slate-600">{p.profile || '—'}</td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  p.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' :
                                  p.status === 'onboarding' ? 'bg-blue-100 text-blue-800' :
                                  'bg-slate-200 text-slate-700'
                                }`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => onSelectPartnerForReferrals(p.id)}
                                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                                    title="Ver indicações deste parceiro"
                                  >
                                    <Filter className="w-3 h-3" /> Indicações
                                  </button>
                                  <button
                                    onClick={() => onEditPartner(p)}
                                    className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold"
                                    title="Editar parceiro"
                                  >
                                    <Users className="w-3 h-3" /> Editar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
