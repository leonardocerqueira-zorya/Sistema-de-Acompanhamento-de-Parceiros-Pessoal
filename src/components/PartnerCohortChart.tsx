import React, { useState } from 'react';
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
import type { Referral, Partner } from '../types';
import { calculatePartnerTenureCohortMetrics } from '../utils/analytics';
import { STAT_MODE_LABEL, type StatMode } from '../utils/statistics';
import { TrendingUp, Users, Filter, BarChart3, HelpCircle, Download } from 'lucide-react';

interface PartnerCohortChartProps {
  referrals: Referral[];
  partners: Partner[];
  /** Média ou mediana — escolhido no topo do dashboard. */
  statMode?: StatMode;
  selectedPartnerId?: string;
  onSelectPartner?: (partnerId: string) => void;
}

export default function PartnerCohortChart({
  referrals,
  partners,
  statMode = 'media',
  selectedPartnerId = 'all',
  onSelectPartner
}: PartnerCohortChartProps) {
  const [internalPartnerId, setInternalPartnerId] = useState<string>(selectedPartnerId);
  const [viewMode, setViewMode] = useState<'average' | 'total'>('average');
  const [showInfo, setShowInfo] = useState(false);

  // Sync with prop if it changes externally
  const activePartnerId = selectedPartnerId !== 'all' ? selectedPartnerId : internalPartnerId;

  const handlePartnerChange = (newId: string) => {
    setInternalPartnerId(newId);
    if (onSelectPartner) {
      onSelectPartner(newId);
    }
  };

  const { metrics, partnerName, isFiltered, activePartnersCount } = calculatePartnerTenureCohortMetrics(
    referrals,
    partners,
    {
      selectedPartnerId: activePartnerId,
      viewMode: viewMode,
      limitMonths: 12,
      statMode
    }
  );

  const isMedian = statMode === 'mediana';
  const statLabel = STAT_MODE_LABEL[statMode].toLowerCase();

  // Calculate high-level cohort insights
  const highestConv = metrics.reduce(
    (max, curr) => (curr.conversionRate > max.rate && curr.referrals > 0 ? { month: curr.monthLabel, rate: curr.conversionRate } : max),
    { month: '—', rate: 0 }
  );

  const month1 = metrics.find(m => m.monthIndex === 1);
  const month2 = metrics.find(m => m.monthIndex === 2);
  const month3 = metrics.find(m => m.monthIndex === 3);

  // CSV Export for this cohort report
  const handleExportCSV = () => {
    const headers = [
      'Ciclo de Maturação',
      isFiltered ? 'Indicações' : viewMode === 'average' ? `Indicações (${STAT_MODE_LABEL[statMode]} por Parceiro)` : 'Total de Indicações',
      isFiltered ? 'Fechamentos' : viewMode === 'average' ? `Fechamentos (${STAT_MODE_LABEL[statMode]} por Parceiro)` : 'Total de Fechamentos',
      'Taxa de Conversão Exibida (%)',
      'Conversão Agregada do Canal (%)',
      'Conversão por Parceiro - Média (%)',
      'Conversão por Parceiro - Mediana (%)',
      'Parceiros que Indicaram no Mês',
      'Total Bruto Indicações',
      'Total Bruto Fechadas',
      'Parceiros no Cohort'
    ];

    const pct = (v: number | null) => (v === null ? '' : v.toFixed(1).replace('.', ',') + '%');

    const rows = metrics.map(m => [
      m.monthLabel,
      m.referrals,
      m.closedDeals,
      pct(m.conversionRate),
      pct(m.conversionRateAggregate),
      pct(m.conversionRateMean),
      pct(m.conversionRateMedian),
      m.partnersWithReferralsInMonth,
      m.totalReferralsRaw,
      m.totalClosedRaw,
      m.activePartnersInTenure
    ]);

    const csvContent = '\uFEFF' + [
      `Relatório de Maturação do Canal - ${partnerName}`,
      `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`,
      `Estatística exibida: ${STAT_MODE_LABEL[statMode]}`,
      '',
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `maturacao_parceiros_${partnerName.toLowerCase().replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Custom Tooltip mimicking clean dashboard aesthetics
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zry-roxo text-white rounded-xl p-3.5 shadow-xl border border-zry-border-strong text-xs space-y-2 min-w-[210px] pointer-events-none">
          <div className="flex items-center justify-between border-b border-zry-border-strong pb-1.5 font-bold text-zry-text-2">
            <span>{label} de Parceria</span>
            <span className="text-[10px] text-zry-text-2">
              {isFiltered ? 'Individual' : `${data.activePartnersInTenure} parceiro(s)`}
            </span>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zry-text-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-zry-lilas inline-block"></span>
                {isFiltered || viewMode === 'total' ? 'Indicações:' : `Indicações (${statLabel}):`}
              </span>
              <span className="font-extrabold text-white">
                {data.referrals} {isFiltered ? '' : viewMode === 'average' ? '/parceiro' : ''}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zry-warning">
                <span className="w-2.5 h-2.5 rounded-sm bg-zry-warning inline-block"></span>
                {isFiltered || viewMode === 'total' ? 'Fechadas:' : `Fechadas (${statLabel}):`}
              </span>
              <span className="font-extrabold text-zry-warning">
                {data.closedDeals} {isFiltered ? '' : viewMode === 'average' ? '/parceiro' : ''}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-zry-border-strong">
              <span className="flex items-center gap-1.5 text-zry-info font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-zry-roxo inline-block"></span>
                {isMedian ? 'Conversão (mediana):' : 'Conversão (canal):'}
              </span>
              <span className="font-black text-zry-info text-sm">
                {data.conversionRate.toFixed(1)}%
              </span>
            </div>

            {/* A outra leitura fica visível no tooltip: agregada e mediana
                respondem perguntas diferentes e a diferença entre elas é o
                próprio diagnóstico (poucos parceiros carregando o canal). */}
            {!isFiltered && (
              <div className="flex items-center justify-between text-[10px] text-zry-text-2">
                <span>{isMedian ? 'Agregada do canal:' : 'Mediana por parceiro:'}</span>
                <span className="font-semibold">
                  {isMedian
                    ? `${data.conversionRateAggregate.toFixed(1)}%`
                    : data.conversionRateMedian === null
                      ? '—'
                      : `${data.conversionRateMedian.toFixed(1)}% (${data.partnersWithReferralsInMonth} parceiros)`}
                </span>
              </div>
            )}
          </div>

          {!isFiltered && viewMode === 'average' && (
            <div className="pt-1.5 border-t border-zry-border-strong text-[10px] text-zry-text-2 flex justify-between">
              <span>Total no mês:</span>
              <span className="text-zry-text-2 font-medium">
                {data.totalClosedRaw} de {data.totalReferralsRaw}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-zry-surface rounded-3xl p-6 sm:p-7 border border-zry-border/90 shadow-xs space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zry-border pb-5">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-zry-lilas-30 text-zry-roxo rounded-2xl shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zry-text tracking-tight">
                Conversão por Mês de Parceria (fechadas ÷ indicações)
              </h2>
              <button
                type="button"
                onClick={() => setShowInfo(!showInfo)}
                className="text-zry-text-2 hover:text-zry-text-2 transition"
                title="Entenda como funciona o cálculo por Mês 1, 2, 3..."
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zry-text-2 mt-1">
              Curva de maturação normalizada: <strong className="text-zry-text-2">Mês 1</strong> é o mês de entrada de cada parceiro, permitindo calcular a média consolidada independente de quando ele entrou.
            </p>
          </div>
        </div>

        {/* Filter & View Mode Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Partner Selector Dropdown */}
          <div className="flex items-center gap-2 bg-zry-lilas-30 border border-zry-border rounded-xl px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-zry-text-2" />
            <select
              value={activePartnerId}
              onChange={(e) => handlePartnerChange(e.target.value)}
              className="text-xs font-semibold text-zry-text bg-transparent border-none focus:outline-hidden cursor-pointer pr-1"
            >
              <option value="all">Média de Todos os Parceiros</option>
              {partners
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Average vs Total Toggle (Only applicable when viewing all partners) */}
          {!isFiltered && (
            <div className="flex items-center bg-zry-lilas-30 p-1 rounded-xl border border-zry-border/80 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('average')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  viewMode === 'average'
                    ? 'bg-zry-surface text-zry-text shadow-2xs'
                    : 'text-zry-text-2 hover:text-zry-text'
                }`}
              >
                {STAT_MODE_LABEL[statMode]} / Parceiro
              </button>
              <button
                type="button"
                onClick={() => setViewMode('total')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  viewMode === 'total'
                    ? 'bg-zry-surface text-zry-text shadow-2xs'
                    : 'text-zry-text-2 hover:text-zry-text'
                }`}
              >
                Total do Canal
              </button>
            </div>
          )}

          {/* Export CSV button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zry-lilas-30 hover:bg-zry-lilas text-zry-text-2 text-xs font-semibold rounded-xl border border-zry-border transition"
            title="Exportar dados do gráfico em CSV"
          >
            <Download className="w-3.5 h-3.5 text-zry-text-2" />
            <span className="hidden sm:inline">CSV</span>
          </button>

        </div>
      </div>

      {/* Optional Contextual Info Box */}
      {showInfo && (
        <div className="bg-zry-info-bg/70 border border-zry-info/80 rounded-2xl p-4 text-xs text-zry-info space-y-1.5 animate-in fade-in duration-200">
          <div className="font-bold flex items-center gap-1.5 text-zry-info">
            <TrendingUp className="w-4 h-4 text-zry-info" />
            Como é medido o desempenho relativo (Mês 1, Mês 2, Mês 3...)?
          </div>
          <p className="leading-relaxed">
            Em vez de datas fixas de calendário, alinhamos a linha do tempo de cada parceiro a partir do seu mês de entrada (<span className="font-semibold">Mês 1</span>).
            Quando você visualiza <em>&quot;Média de Todos os Parceiros&quot;</em>, o sistema calcula a quantidade média de indicações e fechamentos que um parceiro entrega no seu 1º mês, no seu 2º mês, e assim sucessivamente.
            Ao selecionar um parceiro no filtro, a curva passa a refletir estritamente o histórico individual dele ao longo do tempo.
          </p>
        </div>
      )}

      {/* Main Chart Canvas */}
      <div className="w-full h-[360px] sm:h-[400px]">
        {metrics.length > 0 && metrics.some(m => m.referrals > 0 || m.closedDeals > 0) ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={metrics}
              margin={{ top: 20, right: 30, left: 0, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFEBE4" />
              
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                axisLine={{ stroke: '#EDE6F7' }}
                tick={{ fill: '#8B84A0', fontSize: 12, fontWeight: 500 }}
                dy={10}
              />
              
              {/* Left Y-Axis: Counts of Referrals and Closed Deals */}
              <YAxis
                yAxisId="left"
                orientation="left"
                tickLine={false}
                axisLine={{ stroke: '#EDE6F7' }}
                tick={{ fill: '#8B84A0', fontSize: 12 }}
                domain={[0, 'auto']}
                allowDecimals={!isFiltered && viewMode === 'average'}
              />
              
              {/* Right Y-Axis: Conversion Rate % */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={{ stroke: '#EDE6F7' }}
                tick={{ fill: '#2A1F45', fontSize: 12, fontWeight: 600 }}
                domain={[0, 100]}
                ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                unit="%"
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Bar 1: Indicações (Light grey/slate as in user reference) */}
              <Bar
                yAxisId="left"
                dataKey="referrals"
                name="Indicações"
                fill="#EDE6F7"
                radius={[4, 4, 0, 0]}
                maxBarSize={38}
              />

              {/* Bar 2: Fechadas (Amber / warm orange as in user reference) */}
              <Bar
                yAxisId="left"
                dataKey="closedDeals"
                name="Fechadas"
                fill="#F4855A"
                radius={[4, 4, 0, 0]}
                maxBarSize={38}
              />

              {/* Line: Conversão % (Blue line with circular dots as in user reference) */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="conversionRate"
                name="Conversão"
                stroke="#2A1F45"
                strokeWidth={3}
                dot={{ r: 4.5, fill: '#2A1F45', stroke: '#FFFFFF', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: '#3A2E5C', stroke: '#FFFFFF', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-zry-border rounded-2xl text-center space-y-3">
            <div className="p-3 bg-zry-lilas-30 text-zry-text-2 rounded-full">
              <BarChart3 className="w-8 h-8" />
            </div>
            <div className="max-w-md">
              <h3 className="text-sm font-bold text-zry-text">
                Sem dados de indicações para maturação
              </h3>
              <p className="text-xs text-zry-text-2 mt-1">
                {isFiltered 
                  ? `O parceiro "${partnerName}" ainda não possui indicações ou fechamentos registrados com datas válidas.`
                  : 'Importe sua planilha de parceiros e indicações ou adicione novos registros para gerar o gráfico de maturação.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Legend Styled Exactly Like the User's Image */}
      <div className="flex items-center justify-center gap-6 pt-2 pb-1 border-t border-zry-border flex-wrap text-xs">
        <div className="flex items-center gap-2">
          <span className="w-8 h-3 rounded-xs bg-zry-roxo inline-block shadow-2xs"></span>
          <span className="font-semibold text-zry-text-2">Conversão</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-8 h-3 rounded-xs bg-zry-warning inline-block shadow-2xs"></span>
          <span className="font-semibold text-zry-text-2">Fechadas</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-8 h-3 rounded-xs bg-zry-lilas inline-block border border-zry-border"></span>
          <span className="font-semibold text-zry-text-2">Indicações</span>
        </div>
      </div>

      {/* Highlights & Cohort Maturation Insights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        
        <div className="bg-zry-lilas-30 rounded-2xl p-4 border border-zry-border/80">
          <span className="text-[11px] font-medium text-zry-text-2 block">
            Pico de Conversão
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-extrabold text-zry-info">
              {highestConv.rate.toFixed(1)}%
            </span>
            <span className="text-xs font-semibold text-zry-text-2">
              em {highestConv.month}
            </span>
          </div>
          <span className="text-[11px] text-zry-text-2 block mt-1">
            Maior eficiência de fechamento na esteira de relacionamento.
          </span>
        </div>

        <div className="bg-zry-lilas-30 rounded-2xl p-4 border border-zry-border/80">
          <span className="text-[11px] font-medium text-zry-text-2 block">
            {isFiltered ? 'Rampa Inicial (Mês 1 → Mês 3)' : `Evolução por ${STAT_MODE_LABEL[statMode]} (Mês 1 → Mês 3)`}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-extrabold text-zry-text">
              {month1 ? `${month1.conversionRate.toFixed(0)}%` : '0%'}
            </span>
            <span className="text-xs text-zry-text-2">&rarr;</span>
            <span className="text-xl font-extrabold text-zry-positive">
              {month3 ? `${month3.conversionRate.toFixed(0)}%` : '—'}
            </span>
          </div>
          <span className="text-[11px] text-zry-text-2 block mt-1">
            Taxa de conversão ({statLabel}) no primeiro trimestre de onboarding.
          </span>
        </div>

        <div className="bg-zry-lilas-30 rounded-2xl p-4 border border-zry-border/80">
          <span className="text-[11px] font-medium text-zry-text-2 block">
            Escopo Analisado
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-extrabold text-zry-text truncate max-w-[180px]">
              {isFiltered ? partnerName : `${activePartnersCount} parceiros`}
            </span>
          </div>
          <span className="text-[11px] text-zry-text-2 block mt-1">
            {isFiltered 
              ? 'Exibindo a curva individualizada deste parceiro.' 
              : `Consolidado de todos os parceiros por ${statLabel}, alinhado pelo ciclo de entrada.`}
          </span>
        </div>

      </div>

    </div>
  );
}
