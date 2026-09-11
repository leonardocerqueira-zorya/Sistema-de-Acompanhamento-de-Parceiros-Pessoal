import { useMemo, useState, type ReactNode } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import type {
  Partner,
  PartnerVintage,
  PartnerVintageWindow,
  Referral
} from '../types';
import {
  calculatePartnerVintages,
  exportPartnerVintageCSV,
  rankPartnerVintages
} from '../utils/partnerVintageAnalytics';
import { formatCurrency, formatDateBR } from '../utils/analytics';
import { STAT_MODE_LABEL, type StatMode } from '../utils/statistics';
import {
  ENGAGEMENT_ZERO_DAYS,
  PARTNER_STATUS_BADGE,
  PARTNER_STATUS_LABEL
} from '../utils/partnerEngagement';
import {
  CalendarRange,
  Download,
  HelpCircle,
  HeartPulse,
  TrendingUp,
  Zap,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Users
} from 'lucide-react';

interface PartnerVintageReportProps {
  partners: Partner[];
  referrals: Referral[];
  /** Média ou mediana — decidido no topo do dashboard, vale para todo o app. */
  statMode: StatMode;
  onSelectPartner?: (partnerId: string) => void;
}

/** Qual série a linha do gráfico acompanha. */
type LineMetric = 'health' | 'activation' | 'conversion';

const LINE_METRIC_LABEL: Record<LineMetric, string> = {
  health: 'Saudáveis hoje (%)',
  activation: 'Ativação da safra (%)',
  conversion: 'Conversão (%)'
};

// Safra nova é saudável de graça: todo parceiro entra com 100% e o score só
// zera depois de ENGAGEMENT_ZERO_DAYS sem indicar. Enquanto a safra não viveu
// esse prazo inteiro, o 100% dela não é mérito — é falta de tempo. Por isso o
// pódio de saúde só aceita safras que já completaram o ciclo de decaimento.
const MIN_MONTHS_FOR_HEALTH_PODIUM = Math.ceil(ENGAGEMENT_ZERO_DAYS / 30) + 1;

const WINDOW_OPTIONS: { value: PartnerVintageWindow; label: string }[] = [
  { value: null, label: 'Desde a entrada' },
  { value: 30, label: '1ºs 30 dias' },
  { value: 60, label: '1ºs 60 dias' },
  { value: 90, label: '1ºs 90 dias' },
  { value: 180, label: '1ºs 180 dias' }
];

export default function PartnerVintageReport({
  partners,
  referrals,
  statMode,
  onSelectPartner
}: PartnerVintageReportProps) {
  const [windowDays, setWindowDays] = useState<PartnerVintageWindow>(null);
  const [lineMetric, setLineMetric] = useState<LineMetric>('health');
  const [expandedVintageId, setExpandedVintageId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const report = useMemo(
    () => calculatePartnerVintages(partners, referrals, { windowDays }),
    [partners, referrals, windowDays]
  );

  const { vintages } = report;

  // Indicações por parceiro conforme a estatística escolhida no topo da tela.
  const pickPerPartner = (v: PartnerVintage): number =>
    (statMode === 'mediana' ? v.referralsPerPartner.median : v.referralsPerPartner.mean) ?? 0;

  const pickConversion = (v: PartnerVintage): number | null =>
    statMode === 'mediana' ? v.conversionByPartner.median : v.conversionRate;

  const pickCycle = (v: PartnerVintage): number | null =>
    statMode === 'mediana' ? v.daysToFirstReferral.median : v.daysToFirstReferral.mean;

  const lineValue = (v: PartnerVintage): number => {
    if (lineMetric === 'health') return v.healthRate;
    if (lineMetric === 'activation') return v.activationRate;
    return pickConversion(v) ?? 0;
  };

  const chartData = vintages.map(v => ({
    shortLabel: v.shortLabel,
    label: v.label,
    perPartner: Number(pickPerPartner(v).toFixed(2)),
    totalReferrals: v.totalReferrals,
    partnerCount: v.partnerCount,
    lineValue: Number(lineValue(v).toFixed(1)),
    healthRate: Number(v.healthRate.toFixed(1)),
    activationRate: Number(v.activationRate.toFixed(1)),
    conversion: pickConversion(v),
    cycle: pickCycle(v),
    healthyCount: v.healthyCount,
    riskCount: v.riskCount,
    inactiveCount: v.inactiveCount,
    isWindowIncomplete: v.isWindowIncomplete
  }));

  // Destaques. Safras de 1 parceiro ficam de fora (um único indicador vira
  // sempre 0% ou 100% e sequestraria o pódio sem dizer nada do canal) e, com
  // janela ativa, safras que ainda não completaram a janela também saem: elas
  // competiriam com meio prazo contra quem cumpriu o prazo inteiro.
  const comparable = windowDays === null ? vintages : vintages.filter(v => !v.isWindowIncomplete);
  const matureForHealth = vintages.filter(v => v.monthsSinceEntry >= MIN_MONTHS_FOR_HEALTH_PODIUM);

  const topProducer = rankPartnerVintages(comparable, v => pickPerPartner(v)).best;
  const topHealth = rankPartnerVintages(
    matureForHealth,
    v => (v.healthyCount + v.riskCount + v.inactiveCount > 0 ? v.healthRate : null)
  ).best;
  // Ciclo é "quanto menor melhor": inverte o sinal para reaproveitar o ranking.
  const fastestActivation = rankPartnerVintages(comparable, v => {
    const cycle = pickCycle(v);
    return cycle === null ? null : -cycle;
  }).best;

  const excludedFromPodium = vintages.length - comparable.length;
  const excludedFromHealth = vintages.length - matureForHealth.length;

  const statLabel = STAT_MODE_LABEL[statMode].toLowerCase();

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-zry-roxo text-white rounded-xl p-3.5 shadow-xl border border-zry-border-strong text-xs space-y-2 min-w-[230px] pointer-events-none">
        <div className="flex items-center justify-between border-b border-zry-border-strong pb-1.5 font-bold">
          <span>Safra {d.label}</span>
          <span className="text-[10px] text-white/60">{d.partnerCount} parceiro(s)</span>
        </div>
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-white/70">Indicações por parceiro ({statLabel}):</span>
            <span className="font-extrabold">{d.perPartner}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/70">Indicações totais:</span>
            <span className="font-bold">{d.totalReferrals}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/70">Ativação:</span>
            <span className="font-bold">{d.activationRate}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/70">Conversão ({statLabel}):</span>
            <span className="font-bold">{d.conversion === null ? '—' : `${d.conversion.toFixed(1)}%`}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/70">Ciclo até a 1ª indicação:</span>
            <span className="font-bold">{d.cycle === null ? '—' : `${Math.round(d.cycle)} dias`}</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/15 pt-1.5">
            <span className="text-white/70">Saúde hoje:</span>
            <span className="font-extrabold">{d.healthRate}%</span>
          </div>
          <div className="text-[10px] text-white/60">
            {d.healthyCount} saudável(is) · {d.riskCount} em risco · {d.inactiveCount} inativo(s)
          </div>
          {d.isWindowIncomplete && (
            <div className="text-[10px] text-zry-coral pt-1 border-t border-white/15">
              Safra ainda não completou a janela — o número tende a subir.
            </div>
          )}
        </div>
      </div>
    );
  };

  const expanded = expandedVintageId ? vintages.find(v => v.vintageId === expandedVintageId) : null;

  return (
    <div className="bg-zry-surface rounded-3xl p-6 sm:p-7 border border-zry-border/90 shadow-xs space-y-6">

      {/* Header & controles */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zry-border pb-5">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-zry-lilas-30 text-zry-roxo rounded-2xl shrink-0">
            <CalendarRange className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zry-text tracking-tight">
                Safras de Parceiro (por mês de entrada)
              </h2>
              <button
                type="button"
                onClick={() => setShowInfo(!showInfo)}
                className="text-zry-text-2 hover:text-zry-text transition"
                title="Entenda como a safra de parceiro é montada"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zry-text-2 mt-1">
              Cada safra é quem entrou entre o dia 1 e o último dia do mês. Não há corte: a safra não fecha, só envelhece.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Janela de produção — é ela que torna safras de idades diferentes comparáveis */}
          <div className="flex items-center bg-zry-lilas-30 p-1 rounded-xl border border-zry-border/80 text-xs">
            {WINDOW_OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setWindowDays(opt.value)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  windowDays === opt.value
                    ? 'bg-zry-surface text-zry-text shadow-2xs'
                    : 'text-zry-text-2 hover:text-zry-text'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => exportPartnerVintageCSV(report)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zry-lilas-30 hover:bg-zry-lilas text-zry-text-2 text-xs font-semibold rounded-xl border border-zry-border transition"
            title="Exportar comparativo de safras de parceiro em CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      {showInfo && (
        <div className="bg-zry-info-bg/70 border border-zry-info/80 rounded-2xl p-4 text-xs text-zry-info space-y-2 animate-in fade-in duration-200">
          <div className="font-bold flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            Como ler as safras de parceiro
          </div>
          <p className="leading-relaxed">
            A safra de um parceiro é o <strong>mês em que ele entrou no programa</strong> — entrou em 03/03 ou em 28/03, os dois são safra de Março.
            Diferente das <em>safras de indicação</em> (que agrupam leads e têm corte no dia 15 do mês seguinte), a safra de parceiro não fecha nunca.
          </p>
          <p className="leading-relaxed">
            <strong>Janela de produção:</strong> a safra de janeiro teve meses para indicar e a do mês passado teve semanas — comparar os totais só diz quem é mais velha.
            Ao escolher &quot;1ºs 90 dias&quot;, cada parceiro passa a contar apenas o que produziu nos seus 90 primeiros dias de programa, e as safras ficam comparáveis entre si.
            Safra jovem demais para completar a janela aparece marcada: o número dela ainda vai subir.
          </p>
          <p className="leading-relaxed">
            <strong>Saúde</strong> é sempre o estado de <em>hoje</em> (engajamento atual do parceiro) e ignora a janela — uma safra pode ter produzido muito nos primeiros 90 dias e estar inativa agora.
          </p>
        </div>
      )}

      {report.partnersWithoutJoinedDate > 0 && (
        <div className="bg-zry-warning-bg/80 border border-zry-warning/30 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-zry-warning">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>{report.partnersWithoutJoinedDate} parceiro(s) sem data de entrada</strong> ficaram fora de todas as safras.
            A data de entrada é o que define a safra — sem ela o parceiro não entra em nenhuma e some deste comparativo.
          </p>
        </div>
      )}

      {vintages.length === 0 ? (
        <div className="text-center py-12 text-sm text-zry-text-2">
          Nenhum parceiro com data de entrada cadastrada — ainda não há safra para comparar.
        </div>
      ) : (
        <>
          {/* Destaques */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SpotlightCard
              icon={<Zap className="w-4 h-4" />}
              caption="Safra que mais indicou"
              vintage={topProducer}
              value={topProducer ? `${pickPerPartner(topProducer).toFixed(1)}` : '—'}
              unit="indicações/parceiro"
              detail={topProducer ? `${topProducer.totalReferrals} indicações de ${topProducer.partnerCount} parceiros` : 'Sem safra comparável com 2+ parceiros'}
              note={
                excludedFromPodium > 0
                  ? `${excludedFromPodium} safra(s) fora do pódio por ainda não terem completado a janela.`
                  : undefined
              }
            />
            <SpotlightCard
              icon={<HeartPulse className="w-4 h-4" />}
              caption="Safra mais saudável hoje"
              vintage={topHealth}
              value={topHealth ? `${topHealth.healthRate.toFixed(0)}%` : '—'}
              unit="parceiros saudáveis"
              detail={topHealth ? `${topHealth.healthyCount} de ${topHealth.partnerCount} ainda engajados` : `Nenhuma safra com ${MIN_MONTHS_FOR_HEALTH_PODIUM}+ meses e 2+ parceiros`}
              note={
                excludedFromHealth > 0
                  ? `${excludedFromHealth} safra(s) recente(s) fora: todo parceiro entra com 100% e ainda não deu tempo de o engajamento cair.`
                  : undefined
              }
            />
            <SpotlightCard
              icon={<TrendingUp className="w-4 h-4" />}
              caption="Safra que ativou mais rápido"
              vintage={fastestActivation}
              value={fastestActivation && pickCycle(fastestActivation) !== null ? `${Math.round(pickCycle(fastestActivation)!)}` : '—'}
              unit={`dias até a 1ª indicação (${statLabel})`}
              detail={fastestActivation ? `${fastestActivation.partnersWithReferral} de ${fastestActivation.partnerCount} parceiros indicaram` : 'Sem safra comparável com 2+ parceiros'}
            />
          </div>

          {/* Gráfico */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-zry-text-2">
                Barras: indicações por parceiro ({statLabel}
                {windowDays !== null && ` · primeiros ${windowDays} dias`}). Linha: {LINE_METRIC_LABEL[lineMetric].toLowerCase()}.
              </p>
              <div className="flex items-center bg-zry-lilas-30 p-1 rounded-xl border border-zry-border/80 text-xs">
                {(Object.keys(LINE_METRIC_LABEL) as LineMetric[]).map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLineMetric(key)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      lineMetric === key
                        ? 'bg-zry-surface text-zry-text shadow-2xs'
                        : 'text-zry-text-2 hover:text-zry-text'
                    }`}
                  >
                    {LINE_METRIC_LABEL[key]}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full h-[340px] sm:h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 16, right: 24, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFEBE4" />
                  <XAxis
                    dataKey="shortLabel"
                    tickLine={false}
                    axisLine={{ stroke: '#EDE6F7' }}
                    tick={{ fill: '#8B84A0', fontSize: 12, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={{ stroke: '#EDE6F7' }}
                    tick={{ fill: '#8B84A0', fontSize: 12 }}
                    domain={[0, 'auto']}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={{ stroke: '#EDE6F7' }}
                    tick={{ fill: '#8B84A0', fontSize: 12 }}
                    domain={[0, 100]}
                    unit="%"
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8F3FD' }} />
                  <Bar
                    yAxisId="left"
                    dataKey="perPartner"
                    name="Indicações por parceiro"
                    fill="#F4855A"
                    radius={[6, 6, 0, 0]}
                    barSize={26}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="lineValue"
                    name={LINE_METRIC_LABEL[lineMetric]}
                    stroke="#2A1F45"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#2A1F45' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabela comparativa */}
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs min-w-[860px]">
              <thead>
                <tr className="text-left text-zry-text-2 border-b border-zry-border">
                  <th className="py-2.5 px-2 font-semibold">Safra</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Parceiros</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Ativação</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Indic./parceiro</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Indicações</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Conversão</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Ciclo 1ª ind.</th>
                  <th className="py-2.5 px-2 font-semibold text-right">MRR ativo</th>
                  <th className="py-2.5 px-2 font-semibold">Saúde hoje</th>
                  <th className="py-2.5 px-2" />
                </tr>
              </thead>
              <tbody>
                {vintages.map(v => {
                  const conv = pickConversion(v);
                  const cycle = pickCycle(v);
                  const isOpen = expandedVintageId === v.vintageId;
                  return (
                    <tr
                      key={v.vintageId}
                      className={`border-b border-zry-border/60 transition cursor-pointer ${
                        isOpen ? 'bg-zry-lilas-30' : 'hover:bg-zry-lilas-30/60'
                      }`}
                      onClick={() => setExpandedVintageId(isOpen ? null : v.vintageId)}
                    >
                      <td className="py-2.5 px-2">
                        <div className="font-bold text-zry-text">{v.label}</div>
                        <div className="text-[10px] text-zry-text-2">
                          {v.monthsSinceEntry} {v.monthsSinceEntry === 1 ? 'mês' : 'meses'} de programa
                          {v.isWindowIncomplete && <span className="text-zry-warning"> · janela incompleta</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-semibold text-zry-text">{v.partnerCount}</td>
                      <td className="py-2.5 px-2 text-right">
                        <span className={v.activationRate >= 50 ? 'text-zry-positive font-bold' : 'text-zry-text-2'}>
                          {v.activationRate.toFixed(0)}%
                        </span>
                        <div className="text-[10px] text-zry-text-2">{v.partnersWithReferral} indicaram</div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-zry-text">
                        {pickPerPartner(v).toFixed(1)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-zry-text-2">{v.totalReferrals}</td>
                      <td className="py-2.5 px-2 text-right">
                        <span className={conv !== null && conv >= 50 ? 'text-zry-positive font-bold' : 'text-zry-text font-semibold'}>
                          {conv === null ? '—' : `${conv.toFixed(0)}%`}
                        </span>
                        <div className="text-[10px] text-zry-text-2">{v.wonDeals} ganho(s)</div>
                      </td>
                      <td className="py-2.5 px-2 text-right text-zry-text">
                        {cycle === null ? '—' : `${Math.round(cycle)}d`}
                      </td>
                      <td className="py-2.5 px-2 text-right text-zry-text font-semibold">
                        {formatCurrency(v.activeWonVolume)}
                      </td>
                      <td className="py-2.5 px-2">
                        <HealthBar vintage={v} />
                      </td>
                      <td className="py-2.5 px-2 text-zry-text-2">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Drill-down da safra selecionada */}
          {expanded && (
            <div className="bg-zry-lilas-30 border border-zry-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-zry-roxo" />
                  <h4 className="text-sm font-bold text-zry-text">
                    Parceiros da safra de {expanded.label}
                  </h4>
                </div>
                <span className="text-[11px] text-zry-text-2">
                  {expanded.partnerCount} parceiro(s) · entrada entre {formatDateBR(expanded.startDate)} e {formatDateBR(expanded.endDate)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[680px]">
                  <thead>
                    <tr className="text-left text-zry-text-2 border-b border-zry-border">
                      <th className="py-2 px-2 font-semibold">Parceiro</th>
                      <th className="py-2 px-2 font-semibold">Entrada</th>
                      <th className="py-2 px-2 font-semibold">Status</th>
                      <th className="py-2 px-2 font-semibold text-right">Indicações</th>
                      <th className="py-2 px-2 font-semibold text-right">Conversão</th>
                      <th className="py-2 px-2 font-semibold text-right">1ª indicação</th>
                      <th className="py-2 px-2 font-semibold text-right">MRR ativo</th>
                      <th className="py-2 px-2 font-semibold text-right">Engajamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expanded.members.map(m => (
                      <tr
                        key={m.partnerId}
                        className="border-b border-zry-border/50 hover:bg-zry-surface/70 transition cursor-pointer"
                        onClick={() => onSelectPartner?.(m.partnerId)}
                      >
                        <td className="py-2 px-2 font-semibold text-zry-text">{m.partnerName}</td>
                        <td className="py-2 px-2 text-zry-text-2">{formatDateBR(m.joinedDate)}</td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PARTNER_STATUS_BADGE[m.status]}`}>
                            {PARTNER_STATUS_LABEL[m.status]}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-zry-text">{m.referrals}</td>
                        <td className="py-2 px-2 text-right text-zry-text">
                          {m.conversionRate === null ? '—' : `${m.conversionRate.toFixed(0)}%`}
                        </td>
                        <td className="py-2 px-2 text-right text-zry-text-2">
                          {m.daysToFirstReferral === null ? '—' : `${m.daysToFirstReferral}d`}
                        </td>
                        <td className="py-2 px-2 text-right text-zry-text">{formatCurrency(m.activeWonVolume)}</td>
                        <td className="py-2 px-2 text-right">
                          <span
                            className={`font-bold ${
                              m.engagementLevel === 'saudavel'
                                ? 'text-zry-positive'
                                : m.engagementLevel === 'risco'
                                  ? 'text-zry-warning'
                                  : 'text-zry-text-2'
                            }`}
                          >
                            {m.engagementScore === null ? '—' : `${m.engagementScore.toFixed(0)}%`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SpotlightCard({
  icon,
  caption,
  vintage,
  value,
  unit,
  detail,
  note
}: {
  icon: ReactNode;
  caption: string;
  vintage: PartnerVintage | null;
  value: string;
  unit: string;
  detail: string;
  /** Por que alguma safra ficou fora desta comparação. */
  note?: string;
}) {
  return (
    <div className="bg-zry-lilas-30 rounded-2xl p-4 border border-zry-border">
      <div className="flex items-center justify-between text-xs text-zry-text-2">
        <span className="flex items-center gap-1.5 font-semibold">
          <span className="text-zry-roxo">{icon}</span>
          {caption}
        </span>
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-2xl font-extrabold text-zry-text tracking-tight">{value}</span>
        <span className="text-[11px] font-semibold text-zry-text-2">{unit}</span>
      </div>
      <div className="text-sm font-bold text-zry-roxo mt-1">{vintage ? vintage.label : '—'}</div>
      <p className="text-[11px] text-zry-text-2 mt-1.5 leading-relaxed">{detail}</p>
      {note && (
        <p className="text-[10.5px] text-zry-warning mt-1.5 leading-relaxed border-t border-zry-border pt-1.5">
          {note}
        </p>
      )}
    </div>
  );
}

/** Barra empilhada de saudáveis / em risco / inativos da safra. */
function HealthBar({ vintage }: { vintage: PartnerVintage }) {
  const total = vintage.healthyCount + vintage.riskCount + vintage.inactiveCount;
  if (total === 0) {
    return <span className="text-[10px] text-zry-text-2">sem data de entrada</span>;
  }
  const pct = (n: number) => (n / total) * 100;
  return (
    <div className="min-w-[110px]">
      <div className="flex h-2 rounded-full overflow-hidden bg-zry-border">
        <div className="bg-zry-positive" style={{ width: `${pct(vintage.healthyCount)}%` }} />
        <div className="bg-zry-warning" style={{ width: `${pct(vintage.riskCount)}%` }} />
        <div className="bg-zry-text-2/50" style={{ width: `${pct(vintage.inactiveCount)}%` }} />
      </div>
      <div className="text-[10px] text-zry-text-2 mt-1">
        <span className="text-zry-positive font-bold">{vintage.healthyCount}</span>
        {' · '}
        <span className="text-zry-warning font-bold">{vintage.riskCount}</span>
        {' · '}
        <span className="font-bold">{vintage.inactiveCount}</span>
      </div>
    </div>
  );
}
