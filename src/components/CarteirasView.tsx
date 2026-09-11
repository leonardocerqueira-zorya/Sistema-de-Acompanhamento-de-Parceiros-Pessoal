import { useEffect, useMemo, useState } from 'react';
import type { Partner, Referral } from '../types';
import { formatCurrency } from '../utils/analytics';
import {
  summarize,
  EMPTY_STAT_SUMMARY,
  STAT_MODE_LABEL,
  type StatMode,
  type StatSummary
} from '../utils/statistics';
import { listProfiles, listPendingInvites } from '../services/authService';
import { PARTNER_STATUS_LABEL, PARTNER_STATUS_BADGE } from '../utils/partnerEngagement';
import {
  Users,
  ChevronDown,
  ChevronUp,
  UserCheck,
  AlertTriangle,
  Filter,
  Clock,
  Merge
} from 'lucide-react';

interface CarteirasViewProps {
  partners: Partner[];
  referrals: Referral[];
  onSelectPartnerForReferrals: (partnerId: string) => void;
  onEditPartner: (partner: Partner) => void;
  /** Reescreve o Executivo Responsável de todos os parceiros de uma carteira. */
  onMergeExecutive?: (de: string, para: string) => void;
  isMaster?: boolean;
}

interface ExecutiveGroup {
  executive: string;
  isUnassigned: boolean;
  isPendingInvite: boolean;
  partners: Partner[];
  totalReferrals: number;
  wonReferrals: number;
  lostReferrals: number;
  pipelineReferrals: number;
  wonVolume: number;
  conversionRate: number; // agregada da carteira: ganhas ÷ indicações
  // Conversão parceiro a parceiro dentro da carteira. A agregada é dominada
  // por quem mais indica; a mediana mostra como vai o parceiro típico, que é
  // o que o executivo precisa saber para agir.
  conversionByPartner: StatSummary;
}

export default function CarteirasView({
  partners,
  referrals,
  onSelectPartnerForReferrals,
  onEditPartner,
  onMergeExecutive,
  isMaster = false
}: CarteirasViewProps) {
  // Conversão por média (agregada da carteira) ou mediana (parceiro típico).
  const [statMode, setStatMode] = useState<StatMode>('media');

  // Carteira duplicada acontece quando o mesmo executivo entra escrito de dois
  // jeitos ("Igor" e "Igor Brandão"), normalmente vindo de importação. Unificar
  // reescreve o Executivo Responsável de todos os parceiros da carteira de origem.
  const [unificando, setUnificando] = useState<string | null>(null);
  const [destino, setDestino] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  // Executivos convidados em Usuários contam como executivo mesmo antes de fazer
  // login (sem perfil criado ainda) — assim o Master já vê a carteira reservada
  // pra essa pessoa, mesmo vazia, em vez de só aparecer quando ela finalmente entrar.
  const [pendingInviteExecutives, setPendingInviteExecutives] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([listProfiles(), listPendingInvites()])
      .then(([profiles, invites]) => {
        if (!active) return;
        const activeNames = new Set(
          profiles
            .filter(p => p.role === 'executivo' && p.executiveName)
            .map(p => (p.executiveName as string).trim().toLowerCase())
        );
        const pendingOnly = Array.from(new Set(
          invites
            .filter(i => i.role === 'executivo' && i.executiveName && !activeNames.has((i.executiveName as string).trim().toLowerCase()))
            .map(i => (i.executiveName as string).trim())
        ));
        setPendingInviteExecutives(pendingOnly);
      })
      .catch(() => setPendingInviteExecutives([]));
    return () => { active = false; };
  }, []);

  const groups = useMemo<ExecutiveGroup[]>(() => {
    // Taxas de conversão individuais dos parceiros de cada carteira, para a
    // mediana. Chaveado igual ao mapa de carteiras.
    const ratesByExecutive = new Map<string, number[]>();
    const refsByPartner = new Map<string, Referral[]>();
    referrals.forEach(r => {
      if (!refsByPartner.has(r.partnerId)) refsByPartner.set(r.partnerId, []);
      refsByPartner.get(r.partnerId)!.push(r);
    });

    const map = new Map<string, ExecutiveGroup>();
    partners.forEach(p => {
      const execName = (p.accountOwner || '').trim();
      const key = execName ? execName.toLowerCase() : '__unassigned__';
      if (!map.has(key)) {
        map.set(key, {
          executive: execName || 'Sem executivo definido',
          isUnassigned: !execName,
          isPendingInvite: false,
          partners: [],
          totalReferrals: 0,
          wonReferrals: 0,
          lostReferrals: 0,
          pipelineReferrals: 0,
          wonVolume: 0,
          conversionRate: 0,
          conversionByPartner: EMPTY_STAT_SUMMARY
        });
      }
      const g = map.get(key)!;
      g.partners.push(p);

      const pRefs = refsByPartner.get(p.id) || [];
      let partnerWon = 0;
      pRefs.forEach(r => {
        g.totalReferrals += 1;
        if (r.dealStatus === 'ganho') {
          g.wonReferrals += 1;
          partnerWon += 1;
          if (r.dealValue) g.wonVolume += r.dealValue;
        } else if (r.dealStatus === 'perdido') {
          g.lostReferrals += 1;
        } else {
          g.pipelineReferrals += 1;
        }
      });

      // Quem não indicou não tem conversão 0%: não tem conversão nenhuma, e
      // por isso fica fora da distribuição da carteira.
      if (pRefs.length > 0) {
        const rates = ratesByExecutive.get(key) || [];
        rates.push((partnerWon / pRefs.length) * 100);
        ratesByExecutive.set(key, rates);
      }
    });

    // Garante uma carteira (vazia) para quem já foi convidado como executivo
    // mas ainda não tem nenhum parceiro atribuído.
    pendingInviteExecutives.forEach(name => {
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          executive: name,
          isUnassigned: false,
          isPendingInvite: true,
          partners: [],
          totalReferrals: 0,
          wonReferrals: 0,
          lostReferrals: 0,
          pipelineReferrals: 0,
          wonVolume: 0,
          conversionRate: 0,
          conversionByPartner: EMPTY_STAT_SUMMARY
        });
      }
    });

    const list = Array.from(map.values());
    list.forEach(g => {
      g.conversionRate = g.totalReferrals > 0 ? (g.wonReferrals / g.totalReferrals) * 100 : 0;
      const gKey = g.isUnassigned ? '__unassigned__' : g.executive.toLowerCase();
      g.conversionByPartner = summarize(ratesByExecutive.get(gKey) || []);
    });
    // Executivos com carteira primeiro; "sem executivo" por último.
    return list.sort((a, b) => {
      if (a.isUnassigned !== b.isUnassigned) return a.isUnassigned ? 1 : -1;
      return b.totalReferrals - a.totalReferrals;
    });
  }, [partners, referrals, pendingInviteExecutives]);

  const totalExecutives = groups.filter(g => !g.isUnassigned).length;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-zry-text leading-none">Carteiras por Executivo</h1>
          <p className="text-[13px] text-zry-text-2 mt-1.5 max-w-xl">
            Cada parceiro pertence a um Executivo Responsável (Zorya/QRPoint). Acompanhe a carteira, o volume e a conversão de cada executivo.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1 bg-zry-lilas-30 p-1 rounded-full border border-zry-border"
            title="Média usa a conversão agregada da carteira; mediana usa a do parceiro típico"
          >
            <span className="text-[11px] text-zry-text-2 px-2 font-semibold">Conversão:</span>
            {(['media', 'mediana'] as StatMode[]).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setStatMode(mode)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition ${
                  statMode === mode ? 'bg-zry-roxo text-zry-creme' : 'text-zry-text-2 hover:text-zry-roxo'
                }`}
              >
                {STAT_MODE_LABEL[mode]}
              </button>
            ))}
          </div>
          <div className="bg-zry-surface border border-zry-border rounded-zry-lg px-4 py-2.5 text-center">
            <span className="block text-[11px] text-zry-text-2 font-semibold uppercase tracking-wider">Executivos</span>
            <span className="text-[20px] font-bold text-zry-text">{totalExecutives}</span>
          </div>
          <div className="bg-zry-surface border border-zry-border rounded-zry-lg px-4 py-2.5 text-center">
            <span className="block text-[11px] text-zry-text-2 font-semibold uppercase tracking-wider">Parceiros</span>
            <span className="text-[20px] font-bold text-zry-text">{partners.length}</span>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-zry-surface rounded-zry-lg p-10 border border-zry-border text-center text-[13px] text-zry-text-2">
          Nenhum parceiro cadastrado ainda. Cadastre parceiros e informe o Executivo Responsável para montar as carteiras.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => {
            const key = g.isUnassigned ? '__unassigned__' : g.executive.toLowerCase();
            const isOpen = expanded === key;
            return (
              <div
                key={key}
                className={`bg-zry-surface rounded-zry-lg border overflow-hidden ${
                  g.isUnassigned ? 'border-zry-warning/40' : g.isPendingInvite ? 'border-zry-info/40' : 'border-zry-border'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : key)}
                  className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-[22px] py-[18px] text-left hover:bg-zry-lilas-30/60 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      g.isUnassigned ? 'bg-zry-warning-bg text-zry-warning' : g.isPendingInvite ? 'bg-zry-info-bg text-zry-info' : 'bg-zry-lilas text-zry-roxo'
                    }`}>
                      {g.isUnassigned ? <AlertTriangle className="w-4 h-4" /> : g.isPendingInvite ? <Clock className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-bold text-zry-text text-[15px] flex items-center gap-2 flex-wrap">
                        {g.executive}
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-lilas text-zry-text-2">
                          {g.partners.length} parceiro(s)
                        </span>
                        {g.isPendingInvite && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-info-bg text-zry-info">
                            Convite pendente
                          </span>
                        )}
                      </div>
                      <div className="text-[12.5px] text-zry-text-2 mt-1">
                        {g.totalReferrals} indicação(ões) • {g.wonReferrals} ganhas • {g.lostReferrals} perdidas • {g.pipelineReferrals} em aberto
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="text-right">
                      <span className="block text-[11px] text-zry-text-2 uppercase font-semibold tracking-wider">
                        Conversão ({STAT_MODE_LABEL[statMode].toLowerCase()})
                      </span>
                      {(() => {
                        const shown =
                          statMode === 'mediana' ? g.conversionByPartner.median : g.conversionRate;
                        return (
                          <span
                            className={`text-[15px] font-bold ${
                              shown !== null && shown >= 50 ? 'text-zry-positive' : 'text-zry-text'
                            }`}
                          >
                            {shown === null ? '—' : `${shown.toFixed(0)}%`}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="text-right">
                      <span className="block text-[11px] text-zry-text-2 uppercase font-semibold tracking-wider">Volume Ganho</span>
                      <span className="text-[15px] font-bold text-zry-text">{formatCurrency(g.wonVolume)}</span>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-zry-text-2" /> : <ChevronDown className="w-4 h-4 text-zry-text-2" />}
                  </div>
                </button>

                {isMaster && onMergeExecutive && !g.isUnassigned && g.partners.length > 0 && (
                  <div className="px-[22px] pb-3 -mt-1">
                    {unificando === g.executive ? (
                      <div className="flex items-center gap-2 flex-wrap bg-zry-lilas-30 rounded-zry-lg px-3.5 py-3">
                        <span className="text-[12.5px] text-zry-text-2">
                          Mover os {g.partners.length} parceiro(s) de <strong className="text-zry-text">{g.executive}</strong> para
                        </span>
                        <select
                          value={destino}
                          onChange={e => setDestino(e.target.value)}
                          className="bg-zry-surface border border-zry-border rounded-full px-3 py-1.5 text-[12.5px] text-zry-text focus:outline-none focus:border-zry-border-strong"
                        >
                          <option value="">Selecione o executivo…</option>
                          {groups
                            .filter(o => !o.isUnassigned && o.executive !== g.executive)
                            .map(o => <option key={o.executive} value={o.executive}>{o.executive}</option>)}
                        </select>
                        <button
                          type="button"
                          disabled={!destino}
                          onClick={() => {
                            onMergeExecutive(g.executive, destino);
                            setUnificando(null);
                            setDestino('');
                          }}
                          className="bg-zry-roxo text-zry-creme font-bold px-3.5 py-1.5 rounded-full text-[12px] disabled:opacity-50 transition"
                        >
                          Unificar
                        </button>
                        <button
                          type="button"
                          onClick={() => { setUnificando(null); setDestino(''); }}
                          className="text-[12px] font-semibold text-zry-text-2 hover:text-zry-text px-2 py-1.5 transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setUnificando(g.executive); setDestino(''); }}
                        title="Usar quando o mesmo executivo aparece escrito de dois jeitos"
                        className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-zry-text-2 hover:text-zry-roxo transition"
                      >
                        <Merge className="w-3.5 h-3.5" />
                        Unificar com outra carteira
                      </button>
                    )}
                  </div>
                )}

                {isOpen && (
                  <div className="border-t border-zry-border">
                    {g.isUnassigned && (
                      <div className="mx-[22px] mt-[18px] text-[12.5px] text-zry-warning bg-zry-warning-bg rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Estes parceiros estão sem executivo. Edite cada parceiro e informe o Executivo Responsável para atribuí-los a uma carteira.
                      </div>
                    )}
                    {g.isPendingInvite && g.partners.length === 0 && (
                      <div className="mx-[22px] mt-[18px] text-[12.5px] text-zry-info bg-zry-info-bg rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                        <Clock className="w-4 h-4 shrink-0" />
                        {g.executive} foi convidado(a) como executivo em Usuários, mas ainda não tem parceiros nem fez login. Atribua parceiros a essa pessoa em "Editar Parceiro".
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr>
                            <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">Parceiro</th>
                            <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">Perfil</th>
                            <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">Status</th>
                            <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">Contrato</th>
                            <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px] text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.partners.map(p => (
                            <tr key={p.id} className="border-t border-zry-border hover:bg-zry-lilas-30/60 transition">
                              <td className="py-3.5 px-[22px] text-[13px] font-semibold text-zry-text">{p.name}</td>
                              <td className="py-3.5 px-[22px] text-[13px] text-zry-text-2">{p.profile || '—'}</td>
                              <td className="py-3.5 px-[22px] text-[13px]">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${PARTNER_STATUS_BADGE[p.status]}`}>
                                  {PARTNER_STATUS_LABEL[p.status]}
                                </span>
                              </td>
                              <td className="py-3.5 px-[22px] text-[13px]">
                                {p.hasSignedContract === undefined ? (
                                  <span className="text-zry-text-2">—</span>
                                ) : (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                    p.hasSignedContract ? 'bg-zry-positive-bg text-zry-positive' : 'bg-zry-danger-bg text-zry-danger'
                                  }`}>
                                    {p.hasSignedContract ? 'Assinado' : 'Sem contrato'}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-[22px] text-[13px] text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => onSelectPartnerForReferrals(p.id)}
                                    className="inline-flex items-center gap-1.5 border border-zry-border-strong text-zry-roxo font-semibold px-3.5 py-[7px] rounded-full text-[12px] hover:bg-zry-lilas-30 transition"
                                    title="Ver indicações deste parceiro"
                                  >
                                    <Filter className="w-3.5 h-3.5" /> Indicações
                                  </button>
                                  <button
                                    onClick={() => onEditPartner(p)}
                                    className="inline-flex items-center gap-1.5 border border-zry-border-strong text-zry-roxo font-semibold px-3.5 py-[7px] rounded-full text-[12px] hover:bg-zry-lilas-30 transition"
                                    title="Editar parceiro"
                                  >
                                    <Users className="w-3.5 h-3.5" /> Editar
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
