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
import { TrendingUp, Users, Filter, BarChart3, HelpCircle, Download } from 'lucide-react';

interface PartnerCohortChartProps {
  referrals: Referral[];
  partners: Partner[];
  selectedPartnerId?: string;
  onSelectPartner?: (partnerId: string) => void;
}

export default function PartnerCohortChart({
  referrals,
  partners,
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
      limitMonths: 12
    }
  );

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
      isFiltered ? 'Indicações' : viewMode === 'average' ? 'Média de Indicações/Parceiro' : 'Total de Indicações',
      isFiltered ? 'Fechamentos' : viewMode === 'average' ? 'Média de Fechamentos/Parceiro' : 'Total de Fechamentos',
      'Taxa de Conversão (%)',
      'Total Bruto Indicações',
      'Total Bruto Fechadas',
      'Parceiros no Cohort'
    ];

    const rows = metrics.map(m => [
      m.monthLabel,
      m.referrals,
      m.closedDeals,
      `${m.conversionRate.toFixed(1)}%`,
      m.totalReferralsRaw,
      m.totalClosedRaw,
      m.activePartnersInTenure
    ]);

    const csvContent = '\uFEFF' + [
      `Relatório de Maturação do Canal - ${partnerName}`,
      `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`,
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
        <div className="bg-slate-900 text-white rounded-xl p-3.5 shadow-xl border border-slate-700 text-xs space-y-2 min-w-[210px] pointer-events-none">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-bold text-slate-200">
            <span>{label} de Parceria</span>
            <span className="text-[10px] text-slate-400">
              {isFiltered ? 'Individual' : `${data.activePartnersInTenure} parceiro(s)`}
            </span>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 inline-block"></span>
                {isFiltered || viewMode === 'total' ? 'Indicações:' : 'Média Indicações:'}
              </span>
              <span className="font-extrabold text-white">
                {data.referrals} {isFiltered ? '' : viewMode === 'average' ? '/parceiro' : ''}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-amber-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block"></span>
                {isFiltered || viewMode === 'total' ? 'Fechadas:' : 'Média Fechadas:'}
              </span>
              <span className="font-extrabold text-amber-400">
                {data.closedDeals} {isFiltered ? '' : viewMode === 'average' ? '/parceiro' : ''}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800">
              <span className="flex items-center gap-1.5 text-blue-300 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                Taxa de Conversão:
              </span>
              <span className="font-black text-blue-400 text-sm">
                {data.conversionRate.toFixed(1)}%
              </span>
            </div>
          </div>

          {!isFiltered && viewMode === 'average' && (
            <div className="pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between">
              <span>Total no mês:</span>
              <span className="text-slate-300 font-medium">
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
    <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-2xl shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Conversão por Mês de Parceria (fechadas ÷ indicações)
              </h2>
              <button
                type="button"
                onClick={() => setShowInfo(!showInfo)}
                className="text-slate-400 hover:text-slate-600 transition"
                title="Entenda como funciona o cálculo por Mês 1, 2, 3..."
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Curva de maturação normalizada: <strong className="text-slate-700">Mês 1</strong> é o mês de entrada de cada parceiro, permitindo calcular a média consolidada independente de quando ele entrou.
            </p>
          </div>
        </div>

        {/* Filter & View Mode Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Partner Selector Dropdown */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={activePartnerId}
              onChange={(e) => handlePartnerChange(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-hidden cursor-pointer pr-1"
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
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('average')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  viewMode === 'average'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Média / Parceiro
              </button>
              <button
                type="button"
                onClick={() => setViewMode('total')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  viewMode === 'total'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition"
            title="Exportar dados do gráfico em CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">CSV</span>
          </button>

        </div>
      </div>

      {/* Optional Contextual Info Box */}
      {showInfo && (
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 text-xs text-blue-900 space-y-1.5 animate-in fade-in duration-200">
          <div className="font-bold flex items-center gap-1.5 text-blue-950">
            <TrendingUp className="w-4 h-4 text-blue-600" />
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
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
                tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                dy={10}
              />
              
              {/* Left Y-Axis: Counts of Referrals and Closed Deals */}
              <YAxis
                yAxisId="left"
                orientation="left"
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
                tick={{ fill: '#64748B', fontSize: 12 }}
                domain={[0, 'auto']}
                allowDecimals={!isFiltered && viewMode === 'average'}
              />
              
              {/* Right Y-Axis: Conversion Rate % */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
                tick={{ fill: '#2563EB', fontSize: 12, fontWeight: 600 }}
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
                fill="#E2E8F0"
                radius={[4, 4, 0, 0]}
                maxBarSize={38}
              />

              {/* Bar 2: Fechadas (Amber / warm orange as in user reference) */}
              <Bar
                yAxisId="left"
                dataKey="closedDeals"
                name="Fechadas"
                fill="#D97706"
                radius={[4, 4, 0, 0]}
                maxBarSize={38}
              />

              {/* Line: Conversão % (Blue line with circular dots as in user reference) */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="conversionRate"
                name="Conversão"
                stroke="#2563EB"
                strokeWidth={3}
                dot={{ r: 4.5, fill: '#2563EB', stroke: '#FFFFFF', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: '#1D4ED8', stroke: '#FFFFFF', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-3">
            <div className="p-3 bg-slate-100 text-slate-400 rounded-full">
              <BarChart3 className="w-8 h-8" />
            </div>
            <div className="max-w-md">
              <h3 className="text-sm font-bold text-slate-800">
                Sem dados de indicações para maturação
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isFiltered 
                  ? `O parceiro "${partnerName}" ainda não possui indicações ou fechamentos registrados com datas válidas.`
                  : 'Importe sua planilha de parceiros e indicações ou adicione novos registros para gerar o gráfico de maturação.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Legend Styled Exactly Like the User's Image */}
      <div className="flex items-center justify-center gap-6 pt-2 pb-1 border-t border-slate-100 flex-wrap text-xs">
        <div className="flex items-center gap-2">
          <span className="w-8 h-3 rounded-xs bg-blue-600 inline-block shadow-2xs"></span>
          <span className="font-semibold text-slate-700">Conversão</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-8 h-3 rounded-xs bg-amber-600 inline-block shadow-2xs"></span>
          <span className="font-semibold text-slate-700">Fechadas</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-8 h-3 rounded-xs bg-slate-200 inline-block border border-slate-300"></span>
          <span className="font-semibold text-slate-700">Indicações</span>
        </div>
      </div>

      {/* Highlights & Cohort Maturation Insights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
          <span className="text-[11px] font-medium text-slate-500 block">
            Pico de Conversão
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-extrabold text-blue-600">
              {highestConv.rate.toFixed(1)}%
            </span>
            <span className="text-xs font-semibold text-slate-600">
              em {highestConv.month}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Maior eficiência de fechamento na esteira de relacionamento.
          </span>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
          <span className="text-[11px] font-medium text-slate-500 block">
            {isFiltered ? 'Rampa Inicial (Mês 1 &rarr; Mês 3)' : 'Evolução Média (Mês 1 &rarr; Mês 3)'}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-extrabold text-slate-900">
              {month1 ? `${month1.conversionRate.toFixed(0)}%` : '0%'}
            </span>
            <span className="text-xs text-slate-400">&rarr;</span>
            <span className="text-xl font-extrabold text-emerald-600">
              {month3 ? `${month3.conversionRate.toFixed(0)}%` : '—'}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Taxa de conversão no primeiro trimestre de onboarding.
          </span>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
          <span className="text-[11px] font-medium text-slate-500 block">
            Escopo Analisado
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-extrabold text-slate-900 truncate max-w-[180px]">
              {isFiltered ? partnerName : `${activePartnersCount} parceiros`}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            {isFiltered 
              ? 'Exibindo a curva individualizada deste parceiro.' 
              : 'Média de todos os parceiros consolidada por ciclo de entrada.'}
          </span>
        </div>

      </div>

    </div>
  );
}
