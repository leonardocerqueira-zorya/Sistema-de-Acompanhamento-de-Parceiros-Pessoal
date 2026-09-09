import { useState } from 'react';
import type { Referral, Partner, FilterState, PeriodFilter, RankingSortKey } from '../types';
import { 
  calculateKPIs, 
  calculatePartnerRankings, 
  formatCurrency, 
  formatDateBR 
} from '../utils/analytics';
import { exportConsolidatedKPIsAndRankingsCSV } from '../utils/csvExportTemplates';
import { calculateDataAuditMetrics } from '../services/sheetsService';
import DataAuditView from './DataAuditView';
import PartnerCohortChart from './PartnerCohortChart';
import VintageCohortReport from './VintageCohortReport';
import PartnerLocationMap from './PartnerLocationMap';
import { 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Award, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  ArrowUpRight, 
  Users, 
  Filter, 
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  UserCheck,
  Zap,
  Target,
  FileSpreadsheet,
  Plus,
  Percent,
  Tag,
  Download,
  LayoutDashboard,
  Scale,
  Coins,
  Receipt,
  PiggyBank
} from 'lucide-react';

interface DashboardProps {
  referrals: Referral[];
  partners: Partner[];
  filter: FilterState;
  onFilterChange: (newFilter: FilterState) => void;
  onNavigateToReferrals: (onlyMissing?: boolean) => void;
  onNavigateToCommissions: () => void;
  onSelectPartner: (partnerId: string) => void;
  onOpenNewPartner?: () => void;
  onOpenNewReferral?: () => void;
  onNavigateToSheets?: () => void;
  onEditPartner?: (partner: Partner) => void;
  onEditReferral?: (referral: Referral) => void;
}

export default function Dashboard({
  referrals,
  partners,
  filter,
  onFilterChange,
  onNavigateToReferrals,
  onNavigateToCommissions,
  onSelectPartner,
  onOpenNewPartner,
  onOpenNewReferral,
  onNavigateToSheets,
  onEditPartner,
  onEditReferral
}: DashboardProps) {
  // Tab inside dashboard: Visão Geral de KPIs vs. Auditoria de Dados Faltantes
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'audit'>('overview');

  // Sorting state for the Partner Ranking (Explicit requirement: by referrals AND by closed deals)
  const [rankingSort, setRankingSort] = useState<RankingSortKey>('wonDeals');

  const kpis = calculateKPIs(referrals, partners);
  const auditMetrics = calculateDataAuditMetrics(partners, referrals);
  const rankings = calculatePartnerRankings(referrals, partners, rankingSort);

  const currentYear = new Date().getFullYear();
  const currentMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  // Period Preset Handlers
  const handlePeriodPreset = (preset: PeriodFilter['preset']) => {
    let update: Partial<PeriodFilter> = { preset };
    if (preset === 'mensal') {
      update.selectedMonth = filter.period.selectedMonth || currentMonth;
    } else if (preset === 'trimestral') {
      update.selectedQuarter = filter.period.selectedQuarter || (Math.floor(new Date().getMonth() / 3) + 1);
      update.selectedYear = filter.period.selectedYear || currentYear;
    } else if (preset === 'anual') {
      update.selectedYear = filter.period.selectedYear || currentYear;
    }
    onFilterChange({
      ...filter,
      period: {
        ...filter.period,
        ...update
      }
    });
  };

  const handleMonthChange = (monthStr: string) => {
    onFilterChange({
      ...filter,
      period: {
        ...filter.period,
        preset: 'mensal',
        selectedMonth: monthStr
      }
    });
  };

  const handleQuarterChange = (quarter: number) => {
    onFilterChange({
      ...filter,
      period: {
        ...filter.period,
        preset: 'trimestral',
        selectedQuarter: quarter,
        selectedYear: filter.period.selectedYear || currentYear
      }
    });
  };

  const handleYearChange = (year: number) => {
    onFilterChange({
      ...filter,
      period: {
        ...filter.period,
        preset: 'anual',
        selectedYear: year
      }
    });
  };

  const handleCustomDate = (field: 'startDate' | 'endDate', value: string) => {
    onFilterChange({
      ...filter,
      period: {
        ...filter.period,
        preset: 'custom',
        [field]: value
      }
    });
  };

  const hasZeroData = partners.length === 0 && referrals.length === 0;

  return (
    <div className="space-y-6">
      {/* Dashboard Mode Switcher & Export CSV Action Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-slate-100/90 p-1 rounded-2xl w-full sm:w-auto">
          <button
            type="button"
            id="btn-dash-tab-overview"
            onClick={() => setDashboardTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              dashboardTab === 'overview'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-indigo-600" />
            <span>Visão Geral & KPIs</span>
          </button>

          <button
            type="button"
            id="btn-dash-tab-audit"
            onClick={() => setDashboardTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              dashboardTab === 'audit'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Pendências & Auditoria</span>
            {auditMetrics.totalFieldsMissing > 0 && (
              <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[10px] font-black border border-amber-300">
                {auditMetrics.totalFieldsMissing} dados nulos
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            id="btn-export-kpis-csv"
            onClick={() => exportConsolidatedKPIsAndRankingsCSV(kpis, rankings, filter.period.preset)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-98"
            title="Exportar indicadores consolidados de conversão, ciclo de ativação e ranking de parceiros em arquivo CSV estruturado"
          >
            <Download className="w-4 h-4" />
            <span>Exportar KPIs & Rankings (CSV)</span>
          </button>
        </div>
      </div>

      {dashboardTab === 'audit' ? (
        <DataAuditView
          partners={partners}
          referrals={referrals}
          onEditPartner={onEditPartner || (() => {})}
          onEditReferral={onEditReferral || (() => {})}
          onOpenSpreadsheetImport={onNavigateToSheets}
        />
      ) : (
        <>
          {/* Dynamic Period Filter Toolbar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex items-center gap-2 text-slate-700">
            <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Filtros Dinâmicos</span>
              <span className="text-sm font-semibold text-slate-900">Período de Análise</span>
            </div>
          </div>

          {/* Primary Preset Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200">
            {[
              { id: 'all', label: 'Todo o Histórico' },
              { id: 'mensal', label: 'Mensal' },
              { id: 'trimestral', label: 'Trimestral' },
              { id: 'anual', label: 'Anual' },
              { id: 'last_30_days', label: 'Últimos 30 dias' },
              { id: 'custom', label: 'Personalizado' },
            ].map(item => (
              <button
                key={item.id}
                id={`filter-preset-${item.id}`}
                onClick={() => handlePeriodPreset(item.id as PeriodFilter['preset'])}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter.period.preset === item.id
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Sub-selectors for Mensal / Trimestral / Anual / Custom */}
          {filter.period.preset === 'mensal' && (
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">Mês:</span>
              <input
                type="month"
                value={filter.period.selectedMonth || currentMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 text-xs focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}

          {filter.period.preset === 'trimestral' && (
            <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">Trimestre:</span>
              {[1, 2, 3, 4].map(q => (
                <button
                  key={q}
                  onClick={() => handleQuarterChange(q)}
                  className={`px-2 py-1 rounded-md text-xs font-semibold ${
                    (filter.period.selectedQuarter || 1) === q
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  T{q}
                </button>
              ))}
              <span className="text-slate-400 ml-1">Ano:</span>
              <select
                value={filter.period.selectedYear || currentYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 text-xs"
              >
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {filter.period.preset === 'anual' && (
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">Ano Base:</span>
              <select
                value={filter.period.selectedYear || currentYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
              >
                {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {filter.period.preset === 'custom' && (
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-slate-400">De:</span>
                <input
                  type="date"
                  value={filter.period.startDate || ''}
                  onChange={(e) => handleCustomDate('startDate', e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-400">Até:</span>
                <input
                  type="date"
                  value={filter.period.endDate || ''}
                  onChange={(e) => handleCustomDate('endDate', e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Missing Data Alert Callout */}
      {kpis.incompleteDataCount > 0 && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                Atenção: {kpis.incompleteDataCount} registro(s) com campos pendentes de preenchimento manual
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                Conforme solicitado, nenhum dado foi inventado. Preencha os campos vazios no frontend para calibrar 100% os indicadores.
              </p>
            </div>
          </div>
          <button
            id="btn-audit-missing"
            onClick={() => onNavigateToReferrals(true)}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-2 rounded-xl shrink-0 transition shadow-xs"
          >
            <span>Auditar e Preencher</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Empty State Banner when no real data has been registered yet */}
      {hasZeroData && (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
            <Target className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-slate-900">Nenhum dado fictício ativo</h3>
            <p className="text-xs text-slate-500 mt-1">
              Todos os dados fictícios foram removidos. O sistema está pronto para você cadastrar seus parceiros reais, registrar indicações ou sincronizar sua planilha.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {onOpenNewPartner && (
              <button
                onClick={onOpenNewPartner}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Cadastrar 1º Parceiro</span>
              </button>
            )}
            {onOpenNewReferral && (
              <button
                onClick={onOpenNewReferral}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar 1ª Indicação</span>
              </button>
            )}
            {onNavigateToSheets && (
              <button
                onClick={onNavigateToSheets}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold px-4 py-2 rounded-xl transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Importar Planilha</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Primary KPI Grid (Explicitly Requested Core KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: Taxa de Conversão de Indicações em Negócios Fechados */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Taxa de Conversão do Canal</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {kpis.totalReferrals > 0 ? `${kpis.conversionRate.toFixed(1)}%` : '—'}
            </h3>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                {kpis.totalWonDeals} ganhos
              </span>
              <span className="text-slate-500">
                de {kpis.totalReferrals} indicações
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: Média de Tempo entre Entrada do Parceiro e a 1ª Indicação */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tempo de Ativação do Parceiro</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {kpis.avgDaysPartnerToFirstReferral !== null ? kpis.avgDaysPartnerToFirstReferral : '—'}
              </h3>
              {kpis.avgDaysPartnerToFirstReferral !== null && (
                <span className="text-xs font-bold text-slate-500">dias</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Média: entrada &rarr; 1ª indicação
            </p>
          </div>
        </div>

        {/* KPI 3: Volume Fechado no Canal */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Volume Total Fechado</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(kpis.totalWonVolume)}
            </h3>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                Pipeline: {formatCurrency(kpis.pipelineVolume)}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Descontos Aplicados (R$ e %) */}
        <div className="bg-white rounded-2xl p-5 border border-purple-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-900">Descontos Aplicados</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-purple-950 tracking-tight">
              {formatCurrency(kpis.totalDiscountVolume)}
            </h3>
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              <span className="font-semibold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md">
                {kpis.avgDiscountPercent.toFixed(1)}% médio
              </span>
              <span className="text-purple-600 text-[11px] truncate" title="10% padrão mensal / 15% anual">
                (10% mens / 15% an.)
              </span>
            </div>
          </div>
        </div>

        {/* KPI 5: Comissões a Pagar */}
        <div 
          onClick={onNavigateToCommissions}
          className="bg-white rounded-2xl p-5 border border-amber-200 shadow-xs relative overflow-hidden cursor-pointer hover:border-amber-400 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">Comissões a Pagar</span>
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-amber-900 tracking-tight">
              {formatCurrency(kpis.commissionsToPay)}
            </h3>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                {kpis.pendingCommissionCount} parcela(s)
              </span>
              <span className="text-amber-800 flex items-center text-[11px] font-medium group-hover:translate-x-0.5 transition-transform">
                Ver &rarr;
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Safras de Indicação: Corte D+15, Conversão e Fechamentos por Safra (Últimos 12 Meses) */}
      <VintageCohortReport
        referrals={referrals}
        onSelectReferral={(referralId) => {
          if (onEditReferral) {
            const found = referrals.find(r => r.id === referralId);
            if (found) onEditReferral(found);
          }
        }}
      />

      {/* Card de Performance Consolidada: Ticket Médio de Vendas vs Custo Médio de Comissão */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl shrink-0">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Performance Consolidada &amp; Rentabilidade do Canal
                </h2>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider">
                  Eficiência
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Comparativo financeiro entre o Ticket Médio de Vendas e o Custo Médio de Comissão para aferir a margem e o ROI do canal de parceiros.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {kpis.revenueMultiplier > 0 ? (
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs">
                <Coins className="w-3.5 h-3.5 text-emerald-600" />
                <span>Retorno: {kpis.revenueMultiplier.toFixed(1)}x por R$ em comissão</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-lg font-medium">
                Sem vendas ganhas no filtro
              </span>
            )}
          </div>
        </div>

        {/* Comparative Split Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Card A: Ticket Médio de Vendas */}
          <div className="bg-gradient-to-br from-slate-50 to-indigo-50/20 rounded-2xl p-5 border border-slate-200/80 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                  Receita do Canal
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {kpis.totalWonDeals} negócio(s) fechado(s)
                </span>
              </div>
              <div className="mt-3">
                <span className="text-xs text-slate-500 block font-medium">Ticket Médio de Vendas (MRR / Contrato)</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                    {formatCurrency(kpis.avgTicket)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    / venda
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block"></span>
                Volume Total Fechado: <strong className="text-slate-900">{formatCurrency(kpis.totalWonVolume)}</strong>
              </span>
              <span className="text-slate-400">
                Valor Bruto de Tabela: <strong className="text-slate-700">{formatCurrency(kpis.totalWonDeals > 0 ? kpis.grossWonVolume / kpis.totalWonDeals : 0)}</strong>
              </span>
            </div>
          </div>

          {/* Card B: Custo Médio de Comissão */}
          <div className="bg-gradient-to-br from-amber-50/40 to-orange-50/20 rounded-2xl p-5 border border-amber-200/80 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                  Custo de Parceria
                </span>
                <span className="text-xs font-semibold text-amber-700">
                  {kpis.commissionSharePercent > 0 ? `${kpis.commissionSharePercent.toFixed(1)}% do ticket médio` : '0%'}
                </span>
              </div>
              <div className="mt-3">
                <span className="text-xs text-amber-900 block font-medium">Custo Médio de Comissão por Fechamento</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl sm:text-4xl font-black text-amber-950 tracking-tight">
                    {formatCurrency(kpis.avgCommissionCost)}
                  </span>
                  <span className="text-xs font-semibold text-amber-800">
                    / comissão
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-amber-200/60 flex flex-wrap items-center justify-between text-xs text-amber-900 gap-2">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
                Comissões Geradas: <strong className="text-amber-950">{formatCurrency(kpis.totalCommissionsWon)}</strong>
              </span>
              <span className="text-amber-800">
                Quitadas: <strong>{formatCurrency(kpis.commissionsPaid)}</strong> | A Pagar: <strong>{formatCurrency(kpis.commissionsToPay)}</strong>
              </span>
            </div>
          </div>

        </div>

        {/* Visual Proportional Ratio Bar */}
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5">
            <span className="font-bold text-slate-700">
              Distribuição Proporcional do Ticket Médio por Venda
            </span>
            <span className="text-slate-500">
              {kpis.totalWonDeals > 0 
                ? `Base de cálculo: ${kpis.totalWonDeals} contrato(s) ganho(s)` 
                : 'Nenhum contrato ganho registrado no filtro selecionado'}
            </span>
          </div>

          {kpis.totalWonDeals > 0 && kpis.avgTicket > 0 ? (
            <div className="space-y-2">
              <div className="h-5 w-full bg-slate-200 rounded-xl overflow-hidden flex shadow-inner">
                {/* Net company retention */}
                <div 
                  style={{ width: `${Math.max(5, 100 - kpis.commissionSharePercent)}%` }}
                  className="bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center justify-start px-2.5 text-[10px] font-bold text-white truncate"
                  title={`Margem Líquida Retida: ${formatCurrency(kpis.netChannelMargin)} (${(100 - kpis.commissionSharePercent).toFixed(1)}%)`}
                >
                  {(100 - kpis.commissionSharePercent).toFixed(1)}% Margem Líquida
                </div>
                {/* Commission paid out */}
                <div 
                  style={{ width: `${Math.min(95, kpis.commissionSharePercent)}%` }}
                  className="bg-amber-500 hover:bg-amber-400 transition-colors flex items-center justify-end px-2.5 text-[10px] font-bold text-white truncate"
                  title={`Comissão do Parceiro: ${formatCurrency(kpis.avgCommissionCost)} (${kpis.commissionSharePercent.toFixed(1)}%)`}
                >
                  {kpis.commissionSharePercent.toFixed(1)}% Comissão
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 pt-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
                  <span>Margem Retida: <strong className="text-emerald-700">{formatCurrency(kpis.netChannelMargin)}</strong> por cliente</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                  <span>Custo de Comissão: <strong className="text-amber-800">{formatCurrency(kpis.avgCommissionCost)}</strong> por cliente</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500">
              Registre contratos fechados no sistema para visualizar a régua visual de rentabilidade do canal.
            </div>
          )}
        </div>

        {/* 4 Strategic Pillars of Channel Profitability */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          
          <div className="bg-white rounded-xl p-3.5 border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 block">Margem Líquida por Venda</span>
            <span className="text-lg font-bold text-slate-900 block mt-1">
              {formatCurrency(kpis.netChannelMargin)}
            </span>
            <span className="text-[11px] text-emerald-600 font-semibold block mt-0.5">
              {kpis.avgTicket > 0 ? `${(100 - kpis.commissionSharePercent).toFixed(1)}% retido` : '—'}
            </span>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 block">Take-Rate da Parceria</span>
            <span className="text-lg font-bold text-slate-900 block mt-1">
              {kpis.commissionSharePercent > 0 ? `${kpis.commissionSharePercent.toFixed(1)}%` : '0%'}
            </span>
            <span className="text-[11px] text-amber-700 font-medium block mt-0.5">
              Custo comissão s/ ticket
            </span>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 block">Múltiplo ROI do Canal</span>
            <span className="text-lg font-bold text-slate-900 block mt-1">
              {kpis.revenueMultiplier > 0 ? `${kpis.revenueMultiplier.toFixed(1)}x` : '—'}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Receita por R$ 1 em comissão
            </span>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 block">Volume Líquido Consolidado</span>
            <span className="text-lg font-bold text-slate-900 block mt-1">
              {formatCurrency(kpis.totalWonVolume - kpis.totalCommissionsWon)}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Receita total livre de comissão
            </span>
          </div>

        </div>

      </div>

      {/* Distribuição Geográfica dos Parceiros */}
      <PartnerLocationMap partners={partners} />

      {/* Relatório de Maturação e Conversão por Mês de Parceria (Mês 1, 2, 3...) */}
      <PartnerCohortChart
        referrals={referrals}
        partners={partners}
        selectedPartnerId={filter.partnerId}
        onSelectPartner={(partnerId) => {
          onFilterChange({
            ...filter,
            partnerId
          });
        }}
      />

      {/* Ciclo de Indicação do Programa Section */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md border border-slate-800 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <Zap className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">Ciclo de Indicação do Programa</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Indicadores de tempo e maturação comercial de ponta a ponta do canal.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-slate-400">Ativação do Canal:</span>
            <span className="font-bold text-emerald-400">{kpis.partnerActivationRate.toFixed(0)}% com indicações</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          
          {/* Card 1: Entrada -> 1ª Indicação */}
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Ativação de Parceiro</span>
              <span className="text-emerald-400 font-medium">Entrada &rarr; 1ª Indicação</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {kpis.avgDaysPartnerToFirstReferral !== null ? `${kpis.avgDaysPartnerToFirstReferral}` : '—'}
              </span>
              <span className="text-sm font-semibold text-slate-300">dias em média</span>
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Média entre a data de cadastro do parceiro e sua primeira indicação registrada no sistema.
            </p>
          </div>

          {/* Card 2: Indicação -> Fechamento Ganho */}
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Velocidade de Fechamento</span>
              <span className="text-blue-400 font-medium">Lead &rarr; Ganho</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {kpis.avgDaysReferralToClose !== null ? `${kpis.avgDaysReferralToClose}` : '—'}
              </span>
              <span className="text-sm font-semibold text-slate-300">dias em média</span>
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Tempo médio decorrido entre a indicação recebida e a assinatura/fechamento do contrato.
            </p>
          </div>

          {/* Card 3: Base Ativa vs Total */}
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Parceiros Ativos</span>
              <span className="text-purple-400 font-medium">Cadastrados</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {kpis.activePartnersCount}
              </span>
              <span className="text-sm font-semibold text-slate-300">de {partners.length} parceiros</span>
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Parceiros cadastrados com status ativo e aptos para novas indicações comerciais.
            </p>
          </div>

        </div>
      </div>

      {/* Ranking Interativo de Parceiros (Explicit Requirement: ranking por número de indicações e por negócios fechados) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-slate-900">Ranking Estratégico de Parceiros</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Classifique parceiros por número de indicações, negócios fechados, volume financeiro ou taxa de conversão.
            </p>
          </div>

          {/* Toggle de Classificação (Por Indicações vs Por Fechados vs Outros) */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium self-start md:self-auto">
            <span className="text-[11px] text-slate-400 px-2 font-semibold">Ordenar:</span>
            <button
              onClick={() => setRankingSort('wonDeals')}
              className={`px-2.5 py-1 rounded-lg transition ${
                rankingSort === 'wonDeals'
                  ? 'bg-white text-emerald-700 font-bold shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Negócios Fechados
            </button>
            <button
              onClick={() => setRankingSort('referrals')}
              className={`px-2.5 py-1 rounded-lg transition ${
                rankingSort === 'referrals'
                  ? 'bg-white text-blue-700 font-bold shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Nº de Indicações
            </button>
            <button
              onClick={() => setRankingSort('volume')}
              className={`px-2.5 py-1 rounded-lg transition ${
                rankingSort === 'volume'
                  ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Volume (R$)
            </button>
            <button
              onClick={() => setRankingSort('conversion')}
              className={`px-2.5 py-1 rounded-lg transition ${
                rankingSort === 'conversion'
                  ? 'bg-white text-purple-700 font-bold shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Conversão (%)
            </button>
            <button
              onClick={() => setRankingSort('speed')}
              className={`px-2.5 py-1 rounded-lg transition ${
                rankingSort === 'speed'
                  ? 'bg-white text-indigo-700 font-bold shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mais Rápidos
            </button>
          </div>
        </div>

        {/* Ranking Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Posição</th>
                <th className="py-3 px-4">Parceiro</th>
                <th className="py-3 px-4">Data Entrada</th>
                <th className={`py-3 px-4 text-center ${rankingSort === 'referrals' ? 'text-blue-700 bg-blue-50/50' : ''}`}>
                  Indicações
                </th>
                <th className={`py-3 px-4 text-center ${rankingSort === 'wonDeals' ? 'text-emerald-700 bg-emerald-50/50' : ''}`}>
                  Negócios Fechados
                </th>
                <th className={`py-3 px-4 text-right ${rankingSort === 'volume' ? 'text-slate-900 bg-slate-100/50' : ''}`}>
                  Volume Ganho
                </th>
                <th className="py-3 px-4 text-right">Comissões</th>
                <th className={`py-3 px-4 text-center ${rankingSort === 'conversion' ? 'text-purple-700 bg-purple-50/50' : ''}`}>
                  Conversão
                </th>
                <th className={`py-3 px-4 text-center ${rankingSort === 'speed' ? 'text-indigo-700 bg-indigo-50/50' : ''}`}>
                  Ciclo 1ª Indicação
                </th>
                <th className="py-3 px-4 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rankings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Nenhum parceiro cadastrado para o ranking.
                  </td>
                </tr>
              ) : (
                rankings.map((item, index) => {
                  const isTop3 = index < 3;
                  return (
                    <tr key={item.partnerId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center font-bold">
                        {index === 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-extrabold text-xs">
                            1º
                          </span>
                        ) : index === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-extrabold text-xs">
                            2º
                          </span>
                        ) : index === 2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-600/10 text-amber-800 font-extrabold text-xs">
                            3º
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold">{index + 1}º</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{item.partnerName}</span>
                          {isTop3 && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                              Top {index + 1}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-500">
                        {item.joinedDate ? (
                          formatDateBR(item.joinedDate)
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            <AlertTriangle className="w-3 h-3" />
                            Data pendente
                          </span>
                        )}
                      </td>

                      <td className={`py-3 px-4 text-center font-semibold ${
                        rankingSort === 'referrals' ? 'text-blue-700 font-bold bg-blue-50/30' : 'text-slate-700'
                      }`}>
                        {item.totalReferrals}
                      </td>

                      <td className={`py-3 px-4 text-center font-bold ${
                        rankingSort === 'wonDeals' ? 'text-emerald-700 bg-emerald-50/30' : 'text-emerald-600'
                      }`}>
                        {item.wonReferrals}
                      </td>

                      <td className={`py-3 px-4 text-right font-bold ${
                        rankingSort === 'volume' ? 'text-slate-900 bg-slate-50' : 'text-slate-800'
                      }`}>
                        {formatCurrency(item.wonVolume)}
                      </td>

                      <td className="py-3 px-4 text-right font-semibold text-purple-700">
                        {formatCurrency(item.totalCommissions)}
                      </td>

                      <td className={`py-3 px-4 text-center ${rankingSort === 'conversion' ? 'bg-purple-50/30' : ''}`}>
                        <span className={`inline-block px-2 py-0.5 rounded font-semibold text-[11px] ${
                          item.conversionRate >= 50
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.conversionRate > 0
                            ? 'bg-slate-100 text-slate-700'
                            : 'text-slate-400'
                        }`}>
                          {item.conversionRate.toFixed(0)}%
                        </span>
                      </td>

                      <td className={`py-3 px-4 text-center text-slate-600 ${rankingSort === 'speed' ? 'bg-indigo-50/30' : ''}`}>
                        {item.daysToFirstReferral !== null ? (
                          <span className="font-medium text-slate-800">
                            {item.daysToFirstReferral} {item.daysToFirstReferral === 1 ? 'dia' : 'dias'}
                          </span>
                        ) : item.totalReferrals > 0 ? (
                          <span className="text-amber-600 text-[11px]">Sem data entrada</span>
                        ) : (
                          <span className="text-slate-400">Sem indicação</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onSelectPartner(item.partnerId)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1"
                        >
                          Filtrar <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

    </div>
  );
}
