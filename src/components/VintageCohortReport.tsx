import React, { useState, useEffect } from 'react';
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
import type { Referral, ReferralVintage } from '../types';
import {
  calculateReferralVintages,
  checkAndTriggerVintageCutoffNotifications,
  exportVintageReportCSV
} from '../utils/vintageAnalytics';
import { formatCurrency, formatDateBR } from '../utils/analytics';
import {
  Calendar,
  TrendingUp,
  Clock,
  AlertCircle,
  Download,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  DollarSign,
  Info
} from 'lucide-react';

interface VintageCohortReportProps {
  referrals: Referral[];
  onSelectReferral?: (referralId: string) => void;
}

export default function VintageCohortReport({
  referrals,
  onSelectReferral
}: VintageCohortReportProps) {
  // Generate vintages for the last 12 months based on current time
  const [vintages, setVintages] = useState<ReferralVintage[]>(() => calculateReferralVintages(referrals));
  const [selectedVintageId, setSelectedVintageId] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'conversion_comparison' | 'monthly_closed'>('conversion_comparison');
  const [showInfo, setShowInfo] = useState(false);

  // Recalculate and trigger cutoff notification check when referrals change
  useEffect(() => {
    const computed = calculateReferralVintages(referrals);
    setVintages(computed);
    checkAndTriggerVintageCutoffNotifications(computed);
  }, [referrals]);

  // Identify the most relevant vintage for the spotlight card:
  // Prefer the vintage whose cutoff is currently approaching (e.g. Aug/26 with cutoff on 15/09),
  // or the latest closed cutoff vintage.
  const activeSpotlight = vintages.find(v => v.isCutoffApproaching) ||
    [...vintages].reverse().find(v => v.isCutoffReached && v.totalReferrals > 0) ||
    vintages[vintages.length - 1];

  // Selected vintage for referral drill-down
  const currentDetailVintage = selectedVintageId
    ? vintages.find(v => v.vintageId === selectedVintageId)
    : null;

  // Chart data preparation
  const chartData = vintages.map(v => {
    // Breakdown of closures by relative timing:
    // M0 = closed in same month as referral
    // M1 = closed in 1st month following referral
    // M2 = closed in 2nd month following referral
    // M3+ = closed in 3rd or later months
    const m0 = v.monthlyBreakdown.find(m => m.relativeMonthIndex === 0)?.closedCount || 0;
    const m1 = v.monthlyBreakdown.find(m => m.relativeMonthIndex === 1)?.closedCount || 0;
    const m2 = v.monthlyBreakdown.find(m => m.relativeMonthIndex === 2)?.closedCount || 0;
    const m3plus = v.monthlyBreakdown
      .filter(m => m.relativeMonthIndex >= 3)
      .reduce((sum, item) => sum + item.closedCount, 0);

    return {
      vintageId: v.vintageId,
      shortLabel: v.shortLabel,
      label: v.label,
      totalReferrals: v.totalReferrals,
      closedAtCutoff: v.closedAtCutoff,
      conversionAtCutoff: v.conversionAtCutoff,
      closedTotal: v.closedTotal,
      conversionCurrent: v.conversionCurrent,
      closedPostCutoff: v.closedPostCutoff,
      postCutoffGainPercent: v.postCutoffGainPercent,
      m0,
      m1,
      m2,
      m3plus,
      isCutoffReached: v.isCutoffReached,
      cutoffLabel: v.cutoffLabel
    };
  });

  // Custom chart tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zry-roxo text-white rounded-xl p-3.5 shadow-xl border border-zry-border-strong text-xs space-y-2 min-w-[220px] pointer-events-none">
          <div className="flex items-center justify-between border-b border-zry-border-strong pb-1.5 font-bold text-zry-text-2">
            <span>Safra {data.label}</span>
            <span className="text-[10px] text-zry-text-2">
              {data.isCutoffReached ? `Corte ${data.cutoffLabel}` : `Corte em ${data.cutoffLabel}`}
            </span>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-zry-text-2">
              <span>Total de Indicações:</span>
              <span className="font-extrabold text-white">{data.totalReferrals}</span>
            </div>

            {chartMode === 'conversion_comparison' ? (
              <>
                <div className="flex items-center justify-between text-zry-warning">
                  <span>Fechadas no Corte (15 m+1):</span>
                  <span className="font-bold">{data.closedAtCutoff} ({data.conversionAtCutoff}%)</span>
                </div>
                <div className="flex items-center justify-between text-zry-positive">
                  <span>Fechadas Total (Atual):</span>
                  <span className="font-extrabold">{data.closedTotal} ({data.conversionCurrent}%)</span>
                </div>
                {data.closedPostCutoff > 0 && (
                  <div className="pt-1 border-t border-zry-border-strong flex items-center justify-between text-zry-info font-semibold">
                    <span>Vendas Pós-Corte:</span>
                    <span>+{data.closedPostCutoff} (+{data.postCutoffGainPercent}%)</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between text-zry-text-2">
                  <span>Fechadas no Mês 0 (mesmo mês):</span>
                  <span className="font-bold text-white">{data.m0}</span>
                </div>
                <div className="flex items-center justify-between text-zry-warning">
                  <span>Fechadas no Mês 1 (+30d):</span>
                  <span className="font-bold">{data.m1}</span>
                </div>
                <div className="flex items-center justify-between text-zry-info">
                  <span>Fechadas no Mês 2 (+60d):</span>
                  <span className="font-bold">{data.m2}</span>
                </div>
                {data.m3plus > 0 && (
                  <div className="flex items-center justify-between text-zry-info">
                    <span>Fechadas no Mês 3+ (+90d+):</span>
                    <span className="font-bold">{data.m3plus}</span>
                  </div>
                )}
                <div className="pt-1 border-t border-zry-border-strong flex items-center justify-between font-semibold text-zry-positive">
                  <span>Total Fechado:</span>
                  <span>{data.closedTotal} de {data.totalReferrals} ({data.conversionCurrent}%)</span>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Banner de Notificação & Alerta de Proximidade de Corte */}
      {activeSpotlight && activeSpotlight.isCutoffApproaching && (
        <div className="bg-gradient-to-r from-zry-warning-bg/10 via-zry-warning-bg/5 to-transparent border-l-4 border-zry-warning p-4 sm:p-5 rounded-2xl bg-zry-surface shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-zry-warning-bg text-zry-warning rounded-xl shrink-0 mt-0.5 md:mt-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-zry-warning-bg text-zry-warning text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider">
                  Alerta de Corte de Safra
                </span>
                <span className="text-xs font-bold text-zry-text">
                  Safra {activeSpotlight.label} encerra em {activeSpotlight.cutoffLabel}
                </span>
              </div>
              <p className="text-xs text-zry-text-2 mt-1">
                Faltam <strong className="text-zry-warning font-bold">{activeSpotlight.daysUntilCutoff} dias</strong> para o registro oficial do corte (15 do mês seguinte). 
                Existem <strong className="text-zry-text font-bold">{activeSpotlight.pipelineReferrals} indicação(ões)</strong> em negociação com <strong className="text-zry-positive font-bold">{formatCurrency(activeSpotlight.potentialMRR)}</strong> de MRR potencial para fechamento antes da trava da safra.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              type="button"
              onClick={() => setSelectedVintageId(activeSpotlight.vintageId)}
              className="px-3.5 py-1.5 bg-zry-warning hover:bg-zry-warning text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              Ver Indicações da Safra
            </button>
          </div>
        </div>
      )}

      {/* 2. Card de Destaque da Safra no Dashboard: Taxa no Corte vs Taxa Atual */}
      {activeSpotlight && (
        <div className="bg-zry-surface rounded-3xl p-6 sm:p-7 border border-zry-border/90 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zry-border pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-zry-lilas-30 text-zry-roxo rounded-2xl">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-zry-text">
                    Safra em Destaque: {activeSpotlight.label}
                  </h2>
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                    activeSpotlight.isCutoffReached 
                      ? 'bg-zry-lilas-30 text-zry-text-2' 
                      : 'bg-zry-warning-bg text-zry-warning animate-pulse'
                  }`}>
                    {activeSpotlight.isCutoffReached ? 'Corte Oficial Registrado' : `Corte em ${activeSpotlight.daysUntilCutoff} dias (${activeSpotlight.cutoffLabel})`}
                  </span>
                </div>
                <p className="text-xs text-zry-text-2 mt-0.5">
                  Indicações geradas entre {formatDateBR(activeSpotlight.startDate)} e {formatDateBR(activeSpotlight.endDate)}. Corte oficial: {activeSpotlight.cutoffLabel}.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInfo(!showInfo)}
              className="flex items-center gap-1.5 text-xs text-zry-text-2 hover:text-zry-text transition self-start sm:self-center"
            >
              <Info className="w-4 h-4 text-zry-text-2" />
              <span>Regra do Corte (D+15)</span>
            </button>
          </div>

          {showInfo && (
            <div className="bg-zry-lilas-30 border border-zry-border rounded-2xl p-4 text-xs text-zry-text-2 space-y-1.5 animate-in fade-in duration-150">
              <p className="font-semibold text-zry-text">
                📌 Como funciona a regra de corte de safras?
              </p>
              <p className="leading-relaxed">
                Toda indicação é alocada no mês em que foi gerada (a &quot;safra&quot;). No dia 15 do mês seguinte, o sistema consolida e grava a <strong>Taxa de Conversão do Corte</strong> (fechamentos ocorridos até o dia 15).
                Vendas fechadas após essa data continuam incrementando a <strong>Taxa de Conversão Atual</strong>, permitindo identificar com precisão as vendas tardias e o ciclo longo do canal.
              </p>
            </div>
          )}

          {/* Grid com os 4 Pilares da Safra */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Total de Indicações */}
            <div className="bg-zry-lilas-30 rounded-2xl p-4 border border-zry-border/80">
              <span className="text-[11px] font-semibold text-zry-text-2 uppercase tracking-wider block">
                Total da Safra
              </span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-black text-zry-text">
                  {activeSpotlight.totalReferrals}
                </span>
                <span className="text-xs text-zry-text-2">indicações</span>
              </div>
              <div className="mt-2 pt-2 border-t border-zry-border/60 flex items-center justify-between text-[11px] text-zry-text-2">
                <span>Em negociação:</span>
                <span className="font-bold text-zry-text">{activeSpotlight.pipelineReferrals}</span>
              </div>
            </div>

            {/* Taxa de Conversão no Corte (15 do mês seguinte) */}
            <div className="bg-zry-lilas-30 rounded-2xl p-4 border border-zry-border/80">
              <span className="text-[11px] font-semibold text-zry-text-2 uppercase tracking-wider block">
                Tx. Conversão no Corte ({activeSpotlight.cutoffLabel})
              </span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-black text-zry-warning">
                  {activeSpotlight.conversionAtCutoff}%
                </span>
                <span className="text-xs font-semibold text-zry-text-2">
                  ({activeSpotlight.closedAtCutoff} fechadas)
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-zry-border/60 flex items-center justify-between text-[11px] text-zry-text-2">
                <span>Receita no corte:</span>
                <span className="font-bold text-zry-text">{formatCurrency(activeSpotlight.wonVolumeAtCutoff)}</span>
              </div>
            </div>

            {/* Taxa de Conversão Atual (Acumulada) */}
            <div className="bg-zry-lilas-30 rounded-2xl p-4 border border-zry-border/80">
              <span className="text-[11px] font-semibold text-zry-text-2 uppercase tracking-wider block">
                Tx. Conversão Atual (Hoje)
              </span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-black text-zry-positive">
                  {activeSpotlight.conversionCurrent}%
                </span>
                <span className="text-xs font-semibold text-zry-text-2">
                  ({activeSpotlight.closedTotal} fechadas)
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-zry-border/60 flex items-center justify-between text-[11px] text-zry-text-2">
                <span>Receita ganha total:</span>
                <span className="font-bold text-zry-positive">{formatCurrency(activeSpotlight.wonVolumeTotal)}</span>
              </div>
            </div>

            {/* Vendas Pós-Corte */}
            <div className={`rounded-2xl p-4 border ${
              activeSpotlight.hasPostCutoffSales
                ? 'bg-zry-info-bg/60 border-zry-info/30 text-zry-info'
                : 'bg-zry-lilas-30 border-zry-border/80 text-zry-text-2'
            }`}>
              <span className="text-[11px] font-semibold text-zry-text-2 uppercase tracking-wider block">
                Vendas Pós-Corte
              </span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className={`text-2xl font-black ${activeSpotlight.hasPostCutoffSales ? 'text-zry-info' : 'text-zry-text-2'}`}>
                  +{activeSpotlight.closedPostCutoff}
                </span>
                <span className="text-xs font-semibold text-zry-text-2">
                  {activeSpotlight.hasPostCutoffSales ? `(+${activeSpotlight.postCutoffGainPercent}%)` : 'fechadas após 15'}
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-zry-border/60 flex items-center justify-between text-[11px]">
                <span className="text-zry-text-2">Status:</span>
                <span className="font-bold">
                  {activeSpotlight.hasPostCutoffSales ? (
                    <span className="text-zry-info flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Clientes maturados após corte
                    </span>
                  ) : (
                    <span className="text-zry-text-2">Sem vendas tardias</span>
                  )}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 3. Gráfico de Fechamentos das Indicações por Safra (Últimos 12 Meses) */}
      <div className="bg-zry-surface rounded-3xl p-6 sm:p-7 border border-zry-border/90 shadow-xs space-y-6">
        
        {/* Header com Modos de Gráfico e Exportação CSV */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zry-border pb-5">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 bg-zry-lilas-30 text-zry-roxo rounded-2xl shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zry-text tracking-tight">
                Evolução &amp; Fechamentos por Safra nos Últimos 12 Meses
              </h3>
              <p className="text-xs text-zry-text-2 mt-0.5">
                Acompanhe o fechamento das indicações de cada mês de entrada (M0 no mês da safra, M1 no mês seguinte, M2, M3...).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Toggle de Visualização do Gráfico */}
            <div className="flex items-center bg-zry-lilas-30 p-1 rounded-xl border border-zry-border/80 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setChartMode('conversion_comparison')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  chartMode === 'conversion_comparison'
                    ? 'bg-zry-surface text-zry-text shadow-2xs'
                    : 'text-zry-text-2 hover:text-zry-text'
                }`}
              >
                Corte vs Atual
              </button>
              <button
                type="button"
                onClick={() => setChartMode('monthly_closed')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  chartMode === 'monthly_closed'
                    ? 'bg-zry-surface text-zry-text shadow-2xs'
                    : 'text-zry-text-2 hover:text-zry-text'
                }`}
              >
                Fechamento Mês a Mês
              </button>
            </div>

            {/* Exportar CSV */}
            <button
              type="button"
              onClick={() => exportVintageReportCSV(vintages)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zry-lilas-30 hover:bg-zry-lilas text-zry-text-2 text-xs font-bold rounded-xl border border-zry-border transition"
              title="Exportar Relatório Completo de Safras em CSV"
            >
              <Download className="w-3.5 h-3.5 text-zry-text-2" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* Canvas do Gráfico Recharts */}
        <div className="w-full h-[380px] sm:h-[420px]">
          {chartData.some(d => d.totalReferrals > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFEBE4" />
                
                <XAxis
                  dataKey="shortLabel"
                  tickLine={false}
                  axisLine={{ stroke: '#EDE6F7' }}
                  tick={{ fill: '#8B84A0', fontSize: 12, fontWeight: 500 }}
                  dy={10}
                />
                
                {/* Left Y-Axis: Volume de Indicações / Fechamentos */}
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  tickLine={false}
                  axisLine={{ stroke: '#EDE6F7' }}
                  tick={{ fill: '#8B84A0', fontSize: 12 }}
                  domain={[0, 'auto']}
                  allowDecimals={false}
                />
                
                {/* Right Y-Axis: Taxa de Conversão % */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={{ stroke: '#EDE6F7' }}
                  tick={{ fill: '#2A1F45', fontSize: 12, fontWeight: 600 }}
                  domain={[0, 100]}
                  ticks={[0, 20, 40, 60, 80, 100]}
                  unit="%"
                />

                <Tooltip content={<CustomTooltip />} />

                {chartMode === 'conversion_comparison' ? (
                  <>
                    {/* Barras: Indicações Totais da Safra */}
                    <Bar
                      yAxisId="left"
                      dataKey="totalReferrals"
                      name="Indicações Totais"
                      fill="#EDE6F7"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />

                    {/* Barras: Fechadas no Corte (15 m+1) */}
                    <Bar
                      yAxisId="left"
                      dataKey="closedAtCutoff"
                      name="Fechadas no Corte (15 m+1)"
                      fill="#FDA17B"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />

                    {/* Barras: Fechadas Total */}
                    <Bar
                      yAxisId="left"
                      dataKey="closedTotal"
                      name="Fechadas Total (Atual)"
                      fill="#2E7D5B"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />

                    {/* Linha: Conversão no Corte (%) */}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="conversionAtCutoff"
                      name="Tx. no Corte (%)"
                      stroke="#F4855A"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: '#F4855A' }}
                    />

                    {/* Linha: Conversão Atual (%) */}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="conversionCurrent"
                      name="Tx. Atual (%)"
                      stroke="#2A1F45"
                      strokeWidth={3}
                      dot={{ r: 4.5, fill: '#2A1F45', stroke: '#FFFFFF', strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: '#3A2E5C' }}
                    />
                  </>
                ) : (
                  <>
                    {/* Modo Fechamento Mês a Mês (Stacked) */}
                    <Bar
                      yAxisId="left"
                      dataKey="m0"
                      name="Fechadas no Mês 0 (Safra)"
                      stackId="closed"
                      fill="#4B3F7A"
                      radius={[0, 0, 0, 0]}
                      maxBarSize={36}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="m1"
                      name="Fechadas no Mês 1 (+30d)"
                      stackId="closed"
                      fill="#FDA17B"
                      radius={[0, 0, 0, 0]}
                      maxBarSize={36}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="m2"
                      name="Fechadas no Mês 2 (+60d)"
                      stackId="closed"
                      fill="#2E7D5B"
                      radius={[0, 0, 0, 0]}
                      maxBarSize={36}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="m3plus"
                      name="Fechadas no Mês 3+ (+90d+)"
                      stackId="closed"
                      fill="#C9B8E8"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                    />

                    {/* Linha de Conversão Total Acumulada */}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="conversionCurrent"
                      name="Conversão Acumulada (%)"
                      stroke="#2A1F45"
                      strokeWidth={3}
                      dot={{ r: 4.5, fill: '#2A1F45', stroke: '#FFFFFF', strokeWidth: 2 }}
                    />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-zry-border rounded-2xl text-center space-y-3">
              <div className="p-3 bg-zry-lilas-30 text-zry-text-2 rounded-full">
                <Calendar className="w-8 h-8" />
              </div>
              <p className="text-xs text-zry-text-2">
                Nenhuma indicação cadastrada nos últimos 12 meses para cálculo de safras.
              </p>
            </div>
          )}
        </div>

        {/* Legenda Customizada */}
        <div className="flex items-center justify-center gap-5 pt-2 pb-1 border-t border-zry-border flex-wrap text-xs">
          {chartMode === 'conversion_comparison' ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-zry-lilas border border-zry-border"></span>
                <span className="text-zry-text-2">Total Indicações</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-zry-warning"></span>
                <span className="text-zry-text-2 font-medium">Fechadas no Corte (15 m+1)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-zry-positive"></span>
                <span className="text-zry-text-2 font-medium">Fechadas Total (Atual)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-zry-warning"></span>
                <span className="text-zry-warning font-semibold">% no Corte</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-1 bg-zry-roxo rounded-full"></span>
                <span className="text-zry-info font-bold">% Atual</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-zry-roxo"></span>
                <span className="text-zry-text-2 font-medium">Mês 0 (Safra)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-zry-warning"></span>
                <span className="text-zry-text-2 font-medium">Mês 1 (+30d)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-zry-positive"></span>
                <span className="text-zry-text-2 font-medium">Mês 2 (+60d)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-zry-roxo"></span>
                <span className="text-zry-text-2 font-medium">Mês 3+ (+90d+)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-1 bg-zry-roxo rounded-full"></span>
                <span className="text-zry-text font-bold">% Conversão Final</span>
              </div>
            </>
          )}
        </div>

      </div>

      {/* 4. Tabela & Relatório de Indicações por Safra */}
      <div className="bg-zry-surface rounded-3xl p-6 border border-zry-border/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zry-border pb-4">
          <div>
            <h3 className="text-base font-bold text-zry-text">
              Relatório de Indicações por Safra
            </h3>
            <p className="text-xs text-zry-text-2 mt-0.5">
              Clique em uma safra para abrir a lista individual de indicações e clientes.
            </p>
          </div>
          <span className="text-xs font-semibold text-zry-text-2">
            {vintages.length} safras analisadas
          </span>
        </div>

        {/* Tabela de Safras */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zry-text-2">
            <thead className="bg-zry-lilas-30 text-zry-text-2 font-semibold border-b border-zry-border uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3">Safra</th>
                <th className="py-3 px-3">Data de Corte</th>
                <th className="py-3 px-3 text-center">Indicações</th>
                <th className="py-3 px-3 text-center">No Corte (15 m+1)</th>
                <th className="py-3 px-3 text-center">% Corte</th>
                <th className="py-3 px-3 text-center">Fechadas Total</th>
                <th className="py-3 px-3 text-center">% Atual</th>
                <th className="py-3 px-3 text-center">Pós-Corte</th>
                <th className="py-3 px-3 text-right">MRR Ganho</th>
                <th className="py-3 px-3 text-right">Pipeline</th>
                <th className="py-3 px-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zry-border">
              {vintages.slice().reverse().map(v => {
                const isSelected = selectedVintageId === v.vintageId;
                return (
                  <React.Fragment key={v.vintageId}>
                    <tr className={`hover:bg-zry-lilas-30/80 transition cursor-pointer ${
                      isSelected ? 'bg-zry-info-bg/40 font-medium' : ''
                    }`}
                    onClick={() => setSelectedVintageId(isSelected ? null : v.vintageId)}
                    >
                      <td className="py-3 px-3 font-bold text-zry-text">
                        {v.label}
                      </td>
                      <td className="py-3 px-3 text-zry-text-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] ${
                          v.isCutoffReached 
                            ? 'bg-zry-lilas-30 text-zry-text-2 font-medium' 
                            : 'bg-zry-warning-bg text-zry-warning font-bold'
                        }`}>
                          {v.cutoffLabel}
                          {!v.isCutoffReached && ` (${v.daysUntilCutoff}d)`}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-zry-text">
                        {v.totalReferrals}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-zry-warning">
                        {v.closedAtCutoff}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-zry-warning">
                        {v.conversionAtCutoff}%
                      </td>
                      <td className="py-3 px-3 text-center font-extrabold text-zry-positive">
                        {v.closedTotal}
                      </td>
                      <td className="py-3 px-3 text-center font-black text-zry-positive">
                        {v.conversionCurrent}%
                      </td>
                      <td className="py-3 px-3 text-center">
                        {v.hasPostCutoffSales ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-zry-info-bg text-zry-info rounded-md font-bold text-[11px]">
                            +{v.closedPostCutoff} (+{v.postCutoffGainPercent}%)
                          </span>
                        ) : (
                          <span className="text-zry-text-2">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-zry-text">
                        {formatCurrency(v.wonVolumeTotal)}
                      </td>
                      <td className="py-3 px-3 text-right text-zry-text-2">
                        {v.pipelineReferrals > 0 ? (
                          <span className="text-zry-warning font-medium" title={`MRR Potencial: ${formatCurrency(v.potentialMRR)}`}>
                            {v.pipelineReferrals} ({formatCurrency(v.potentialMRR)})
                          </span>
                        ) : (
                          <span className="text-zry-text-2">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          className="text-zry-text-2 hover:text-zry-text-2 p-1"
                        >
                          {isSelected ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Linha Expandida com as Indicações da Safra */}
                    {isSelected && (
                      <tr>
                        <td colSpan={11} className="p-4 bg-zry-lilas-30/70 border-y border-zry-border">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-xs text-zry-text flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-zry-info" />
                                Indicações da Safra {v.label} ({v.referrals.length} registradas)
                              </h4>
                              <span className="text-[11px] text-zry-text-2">
                                Corte: <strong>{v.cutoffLabel}</strong>
                              </span>
                            </div>

                            {v.referrals.length > 0 ? (
                              <div className="bg-zry-surface rounded-xl border border-zry-border overflow-hidden">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-zry-lilas-30 text-zry-text-2 font-semibold text-[10px] uppercase">
                                    <tr>
                                      <th className="py-2 px-3">Cliente Indicado</th>
                                      <th className="py-2 px-3">Data Indicação</th>
                                      <th className="py-2 px-3">Status</th>
                                      <th className="py-2 px-3">Data Fechamento</th>
                                      <th className="py-2 px-3">Momento do Fechamento</th>
                                      <th className="py-2 px-3 text-right">Valor MRR</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zry-border">
                                    {v.referrals.map(r => {
                                      const isWon = r.dealStatus === 'ganho';
                                      const closeDateStr = (r.closeDate || '').slice(0, 10);
                                      const isClosedAtCutoff = isWon && closeDateStr && closeDateStr <= v.cutoffDate;
                                      const isClosedPostCutoff = isWon && closeDateStr && closeDateStr > v.cutoffDate;

                                      return (
                                        <tr
                                          key={r.id}
                                          className="hover:bg-zry-lilas-30 transition cursor-pointer"
                                          onClick={() => onSelectReferral && onSelectReferral(r.id)}
                                        >
                                          <td className="py-2 px-3 font-semibold text-zry-text">
                                            {r.clientName}
                                          </td>
                                          <td className="py-2 px-3 text-zry-text-2">
                                            {formatDateBR(r.referralDate)}
                                          </td>
                                          <td className="py-2 px-3">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                              isWon ? 'bg-zry-positive-bg text-zry-positive' :
                                              r.dealStatus === 'perdido' ? 'bg-zry-danger-bg text-zry-danger' :
                                              'bg-zry-warning-bg text-zry-warning'
                                            }`}>
                                              {r.dealStatus ? r.dealStatus.toUpperCase() : 'NOVO'}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-zry-text-2">
                                            {formatDateBR(r.closeDate) || '—'}
                                          </td>
                                          <td className="py-2 px-3">
                                            {isClosedAtCutoff && (
                                              <span className="inline-flex items-center gap-1 text-zry-warning font-medium text-[11px]">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-zry-warning" /> No Corte (até 15)
                                              </span>
                                            )}
                                            {isClosedPostCutoff && (
                                              <span className="inline-flex items-center gap-1 text-zry-info font-bold text-[11px]">
                                                <Sparkles className="w-3.5 h-3.5 text-zry-info" /> Pós-Corte (+venda tardia)
                                              </span>
                                            )}
                                            {!isWon && (
                                              <span className="text-zry-text-2 text-[11px]">Em aberto / não fechada</span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-right font-bold text-zry-text">
                                            {formatCurrency(r.dealValue)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-xs text-zry-text-2 italic">
                                Nenhuma indicação gravada para esta safra.
                              </p>
                            )}
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

    </div>
  );
}
