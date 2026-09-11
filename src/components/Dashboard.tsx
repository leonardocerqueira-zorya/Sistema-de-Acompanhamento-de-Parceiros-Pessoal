import { useState } from 'react';
import type { Referral, Partner, FilterState, PeriodFilter, RankingSortKey } from '../types';
import {
  calculateKPIs,
  calculatePartnerRankings,
  formatCurrency,
  formatDateBR,
  filterReferrals
} from '../utils/analytics';
import { exportConsolidatedKPIsAndRankingsCSV } from '../utils/csvExportTemplates';
import { calculateDataAuditMetrics } from '../services/sheetsService';
import { loadChannelCosts, loadNewMrrEntries } from '../services/channelMetricsService';
import { calculateChannelPeriodMetrics } from '../utils/channelMetrics';
import { calculateChannelHealth, ENGAGEMENT_RISK_THRESHOLD, ENGAGEMENT_ZERO_DAYS, ENGAGEMENT_REFERRAL_BOOST } from '../utils/partnerEngagement';
import { pickStatRounded, STAT_MODE_LABEL, type StatMode } from '../utils/statistics';
import EngagementBar from './EngagementBar';
import DataAuditView from './DataAuditView';
import PartnerCohortChart from './PartnerCohortChart';
import VintageCohortReport from './VintageCohortReport';
import PartnerVintageReport from './PartnerVintageReport';
import ChurnReport from './ChurnReport';
import PartnerLocationMap from './PartnerLocationMap';
import AmbassadorAnalysis from './AmbassadorAnalysis';
import RecentReferralsPopup from './RecentReferralsPopup';
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
  PiggyBank,
  Wallet,
  HelpCircle,
  HeartPulse,
  TrendingDown,
  Sigma
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
  isMaster?: boolean;
  onNavigateToChannelMetrics?: () => void;
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
  onEditReferral,
  isMaster = false,
  onNavigateToChannelMetrics
}: DashboardProps) {
  // Tab inside dashboard: Visão Geral de KPIs vs. Auditoria de Dados Faltantes
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'audit'>('overview');

  // Sorting state for the Partner Ranking (Explicit requirement: by referrals AND by closed deals)
  const [rankingSort, setRankingSort] = useState<RankingSortKey>('wonDeals');

  // Média ou mediana nos indicadores de conversão e de ciclo. Vale para os
  // cards, para a curva de maturação e para as safras de parceiro de uma vez:
  // ler metade da tela em média e metade em mediana confunde mais que ajuda.
  const [statMode, setStatMode] = useState<StatMode>('media');

  // Filtro do KPI de engajamento: 'all' = média do canal, ou um parceiro.
  // É independente do filtro de período — engajamento é sempre "hoje".
  const [engagementPartnerId, setEngagementPartnerId] = useState<string>('all');

  // "Visão Geral" (KPIs + Ranking) respeita o filtro de Período de Análise
  // exibido logo acima. Auditoria e os gráficos de safra/maturação abaixo
  // têm janela temporal própria e continuam vendo a base inteira de propósito.
  const periodReferrals =
    filter.period.preset === 'all'
      ? referrals
      : filterReferrals(referrals, { ...filter, partnerId: 'all', dealStatus: 'all', commissionStatus: 'all', onlyMissingData: false, searchQuery: '', partnerVintage: 'all', referralVintage: 'all' });

  const kpis = calculateKPIs(periodReferrals, partners);

  // Conversão na mediana é a do PARCEIRO TÍPICO (cada parceiro pesa 1), não a
  // agregada do canal (que é dominada por quem mais indica). São perguntas
  // diferentes, por isso o rodapé do card muda junto com o número.
  const isMedian = statMode === 'mediana';
  const displayConversion = isMedian
    ? kpis.conversionByPartner.median
    : kpis.totalReferrals > 0
      ? kpis.conversionRate
      : null;
  const displayActivationDays = pickStatRounded(kpis.daysPartnerToFirstReferral, statMode);
  const displayCloseDays = pickStatRounded(kpis.daysReferralToClose, statMode);
  const statSuffix = isMedian ? 'na mediana' : 'em média';
  const auditMetrics = calculateDataAuditMetrics(partners, referrals);
  const rankings = calculatePartnerRankings(periodReferrals, partners, rankingSort);

  const currentYear = new Date().getFullYear();
  const currentMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  // Custos & MRR do canal (mês corrente): indicadores visíveis pra todos, só o
  // PREENCHIMENTO do custo/MRR é master-only (gate fica na própria tela).
  // Usa a base inteira de indicações (não periodReferrals): o mês já delimita o
  // período aqui, igual à tela "Custos & MRR".
  const channelMetrics = calculateChannelPeriodMetrics(currentMonth, referrals, loadChannelCosts(), loadNewMrrEntries());

  // Saúde do canal: engajamento é estado de HOJE, não recorte de período —
  // usa a base inteira de propósito, igual ao decaimento que roda no relógio.
  const channelHealth = calculateChannelHealth(partners, referrals);
  const selectedEngagement =
    engagementPartnerId === 'all'
      ? null
      : channelHealth.byPartner.find(e => e.partnerId === engagementPartnerId) ?? null;

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
      <RecentReferralsPopup referrals={referrals} onOpenReferral={onEditReferral} />

      {/* Cabeçalho da página + alternância de modo + exportação */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-zry-text leading-none">
            Visão geral do canal
          </h1>
          <p className="text-[13px] text-zry-text-2 mt-1.5">
            {partners.length} parceiro(s) e {referrals.length} indicação(ões) no escopo atual
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 bg-zry-lilas-30 p-1 rounded-full">
            <button
              type="button"
              id="btn-dash-tab-overview"
              onClick={() => setDashboardTab('overview')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[12.5px] font-bold transition ${
                dashboardTab === 'overview'
                  ? 'bg-zry-roxo text-zry-creme'
                  : 'text-zry-text-2 hover:text-zry-roxo'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Visão geral</span>
            </button>

            <button
              type="button"
              id="btn-dash-tab-audit"
              onClick={() => setDashboardTab('audit')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[12.5px] font-bold transition ${
                dashboardTab === 'audit'
                  ? 'bg-zry-roxo text-zry-creme'
                  : 'text-zry-text-2 hover:text-zry-roxo'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Auditoria</span>
              {auditMetrics.totalFieldsMissing > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    dashboardTab === 'audit' ? 'bg-zry-coral text-zry-roxo' : 'bg-zry-warning-bg text-zry-warning'
                  }`}
                >
                  {auditMetrics.totalFieldsMissing}
                </span>
              )}
            </button>
          </div>

          {dashboardTab === 'overview' && (
            <div
              className="flex items-center gap-1 bg-zry-lilas-30 p-1 rounded-full border border-zry-border"
              title="Vale para todos os indicadores de conversão e de ciclo desta tela"
            >
              <span className="flex items-center gap-1 text-[11px] text-zry-text-2 px-2 font-semibold">
                <Sigma className="w-3.5 h-3.5" />
                Estatística:
              </span>
              {(['media', 'mediana'] as StatMode[]).map(mode => (
                <button
                  key={mode}
                  type="button"
                  id={`btn-stat-${mode}`}
                  onClick={() => setStatMode(mode)}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold transition ${
                    statMode === mode
                      ? 'bg-zry-roxo text-zry-creme'
                      : 'text-zry-text-2 hover:text-zry-roxo'
                  }`}
                >
                  {STAT_MODE_LABEL[mode]}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            id="btn-export-kpis-csv"
            onClick={() => exportConsolidatedKPIsAndRankingsCSV(kpis, rankings, filter.period.preset)}
            className="flex items-center gap-2 px-[18px] py-2.5 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo text-[12.5px] font-bold rounded-full transition"
            title="Exportar indicadores consolidados de conversão, ciclo de ativação e ranking de parceiros em arquivo CSV estruturado"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar KPIs (CSV)</span>
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
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">

          {/* Primary Preset Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'Tudo' },
              { id: 'mensal', label: 'Este mês' },
              { id: 'trimestral', label: 'Trimestre' },
              { id: 'anual', label: 'Este ano' },
              { id: 'last_30_days', label: 'Últimos 30 dias' },
              { id: 'custom', label: 'Personalizado' },
            ].map(item => (
              <button
                key={item.id}
                id={`filter-preset-${item.id}`}
                onClick={() => handlePeriodPreset(item.id as PeriodFilter['preset'])}
                className={`px-4 py-2 rounded-full text-[12.5px] font-semibold border transition ${
                  filter.period.preset === item.id
                    ? 'bg-zry-roxo text-zry-creme border-zry-roxo'
                    : 'bg-zry-surface text-zry-text-2 border-zry-border hover:text-zry-roxo hover:border-zry-border-strong'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Sub-selectors for Mensal / Trimestral / Anual / Custom */}
          {filter.period.preset === 'mensal' && (
            <div className="flex items-center gap-2 bg-zry-lilas-30 p-1.5 rounded-xl border border-zry-border text-xs">
              <span className="text-zry-text-2 font-medium">Mês:</span>
              <input
                type="month"
                value={filter.period.selectedMonth || currentMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="bg-zry-surface border border-zry-border rounded-lg px-2.5 py-1 text-zry-text text-xs focus:ring-1 focus:ring-zry-roxo"
              />
            </div>
          )}

          {filter.period.preset === 'trimestral' && (
            <div className="flex items-center gap-1.5 bg-zry-lilas-30 p-1.5 rounded-xl border border-zry-border text-xs">
              <span className="text-zry-text-2 font-medium">Trimestre:</span>
              {[1, 2, 3, 4].map(q => (
                <button
                  key={q}
                  onClick={() => handleQuarterChange(q)}
                  className={`px-2 py-1 rounded-md text-xs font-semibold ${
                    (filter.period.selectedQuarter || 1) === q
                      ? 'bg-zry-roxo text-white'
                      : 'bg-zry-surface text-zry-text-2 hover:bg-zry-lilas-30 border border-zry-border'
                  }`}
                >
                  T{q}
                </button>
              ))}
              <span className="text-zry-text-2 ml-1">Ano:</span>
              <select
                value={filter.period.selectedYear || currentYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                className="bg-zry-surface border border-zry-border rounded px-2 py-1 text-zry-text text-xs"
              >
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {filter.period.preset === 'anual' && (
            <div className="flex items-center gap-2 bg-zry-lilas-30 p-1.5 rounded-xl border border-zry-border text-xs">
              <span className="text-zry-text-2 font-medium">Ano Base:</span>
              <select
                value={filter.period.selectedYear || currentYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                className="bg-zry-surface border border-zry-border rounded-lg px-2.5 py-1 text-zry-text text-xs font-semibold focus:ring-1 focus:ring-zry-roxo"
              >
                {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {filter.period.preset === 'custom' && (
            <div className="flex items-center gap-2 bg-zry-lilas-30 p-1.5 rounded-xl border border-zry-border text-xs">
              <div className="flex items-center gap-1">
                <span className="text-zry-text-2">De:</span>
                <input
                  type="date"
                  value={filter.period.startDate || ''}
                  onChange={(e) => handleCustomDate('startDate', e.target.value)}
                  className="bg-zry-surface border border-zry-border rounded px-2 py-1 text-zry-text text-xs focus:ring-1 focus:ring-zry-roxo"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-zry-text-2">Até:</span>
                <input
                  type="date"
                  value={filter.period.endDate || ''}
                  onChange={(e) => handleCustomDate('endDate', e.target.value)}
                  className="bg-zry-surface border border-zry-border rounded px-2 py-1 text-zry-text text-xs focus:ring-1 focus:ring-zry-roxo"
                />
              </div>
            </div>
          )}

          </div>

      {/* Missing Data Alert Callout */}
      {kpis.incompleteDataCount > 0 && (
        <div className="bg-zry-warning-bg/90 border border-zry-warning/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 bg-zry-warning-bg rounded-xl text-zry-warning shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zry-warning">
                Atenção: {kpis.incompleteDataCount} registro(s) com campos pendentes de preenchimento manual
              </h4>
              <p className="text-xs text-zry-warning mt-0.5">
                Conforme solicitado, nenhum dado foi inventado. Preencha os campos vazios no frontend para calibrar 100% os indicadores.
              </p>
            </div>
          </div>
          <button
            id="btn-audit-missing"
            onClick={() => onNavigateToReferrals(true)}
            className="flex items-center gap-1.5 bg-zry-roxo hover:bg-zry-roxo-hover text-zry-creme text-[12.5px] font-bold px-4 py-2.5 rounded-full shrink-0 transition"
          >
            <span>Auditar e Preencher</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Empty State Banner when no real data has been registered yet */}
      {hasZeroData && (
        <div className="bg-zry-surface rounded-zry-lg p-8 border border-zry-border text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-zry-positive-bg text-zry-positive mx-auto flex items-center justify-center">
            <Target className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-zry-text">Nenhum dado fictício ativo</h3>
            <p className="text-xs text-zry-text-2 mt-1">
              Todos os dados fictícios foram removidos. O sistema está pronto para você cadastrar seus parceiros reais, registrar indicações ou sincronizar sua planilha.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {onOpenNewPartner && (
              <button
                onClick={onOpenNewPartner}
                className="flex items-center gap-1.5 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo text-[12.5px] font-bold px-[18px] py-2.5 rounded-full transition"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Cadastrar 1º Parceiro</span>
              </button>
            )}
            {onOpenNewReferral && (
              <button
                onClick={onOpenNewReferral}
                className="flex items-center gap-1.5 bg-zry-roxo hover:bg-zry-roxo-hover text-zry-creme text-[12.5px] font-bold px-[18px] py-2.5 rounded-full transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar 1ª Indicação</span>
              </button>
            )}
            {onNavigateToSheets && (
              <button
                onClick={onNavigateToSheets}
                className="flex items-center gap-1.5 bg-zry-surface hover:bg-zry-lilas-30 text-zry-text-2 border border-zry-border text-xs font-semibold px-4 py-2 rounded-xl transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-zry-positive" />
                <span>Importar Planilha</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Primary KPI Grid (Explicitly Requested Core KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: Taxa de Conversão de Indicações em Negócios Fechados */}
        <div className="bg-zry-surface rounded-zry-lg p-5 border border-zry-border">
          <div className="w-[38px] h-[38px] rounded-xl bg-zry-roxo flex items-center justify-center mb-3.5">
            <CheckCircle2 className="w-[18px] h-[18px] text-zry-creme" />
          </div>
          <div className="text-[26px] font-bold tracking-tight text-zry-text leading-none">
            {displayConversion !== null ? `${displayConversion.toFixed(1)}%` : '—'}
          </div>
          <div className="text-[12.5px] text-zry-text-2 mt-1.5">
            {isMedian ? 'Conversão do parceiro típico' : 'Taxa de conversão do canal'}
          </div>
          <div className="text-[11.5px] text-zry-text-2 mt-2 pt-2 border-t border-zry-border">
            {isMedian ? (
              <>
                Mediana entre{' '}
                <span className="font-semibold text-zry-text">{kpis.conversionByPartner.count} parceiros</span> que indicaram
              </>
            ) : (
              <>
                <span className="font-semibold text-zry-text">{kpis.totalWonDeals} ganhos</span> de {kpis.totalReferrals} indicações
              </>
            )}
          </div>
        </div>

        {/* KPI 2: Média de Tempo entre Entrada do Parceiro e a 1ª Indicação */}
        <div className="bg-zry-surface rounded-zry-lg p-5 border border-zry-border">
          <div className="w-[38px] h-[38px] rounded-xl bg-zry-roxo flex items-center justify-center mb-3.5">
            <Clock className="w-[18px] h-[18px] text-zry-creme" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold tracking-tight text-zry-text leading-none">
              {displayActivationDays !== null ? displayActivationDays : '—'}
            </span>
            {displayActivationDays !== null && (
              <span className="text-[12px] font-semibold text-zry-text-2">dias</span>
            )}
          </div>
          <div className="text-[12.5px] text-zry-text-2 mt-1.5">Tempo de ativação do parceiro</div>
          <div className="text-[11.5px] text-zry-text-2 mt-2 pt-2 border-t border-zry-border">
            {STAT_MODE_LABEL[statMode]}: entrada &rarr; 1ª indicação
            {kpis.daysPartnerToFirstReferral.count > 0 && ` (${kpis.daysPartnerToFirstReferral.count} parceiros)`}
          </div>
        </div>

        {/* KPI 3: Volume Fechado no Canal */}
        <div className="bg-zry-surface rounded-zry-lg p-5 border border-zry-border">
          <div className="w-[38px] h-[38px] rounded-xl bg-zry-roxo flex items-center justify-center mb-3.5">
            <DollarSign className="w-[18px] h-[18px] text-zry-creme" />
          </div>
          <div className="text-[22px] font-bold tracking-tight text-zry-text leading-none">
            {formatCurrency(kpis.totalWonVolume)}
          </div>
          <div className="text-[12.5px] text-zry-text-2 mt-1.5">Volume ganho (líquido)</div>
          <div className="text-[11.5px] text-zry-text-2 mt-2 pt-2 border-t border-zry-border">
            Pipeline: <span className="font-semibold text-zry-text">{formatCurrency(kpis.pipelineVolume)}</span>
          </div>
        </div>

        {/* KPI 3b: MRR Ativo (exclui cancelados) */}
        <div className="bg-zry-surface rounded-zry-lg p-5 border border-zry-border">
          <div className="w-[38px] h-[38px] rounded-xl bg-zry-roxo flex items-center justify-center mb-3.5">
            <DollarSign className="w-[18px] h-[18px] text-zry-creme" />
          </div>
          <div className="text-[22px] font-bold tracking-tight text-zry-text leading-none">
            {formatCurrency(kpis.activeWonVolume)}
          </div>
          <div className="text-[12.5px] text-zry-text-2 mt-1.5">MRR ativo hoje</div>
          <div className="text-[11.5px] text-zry-text-2 mt-2 pt-2 border-t border-zry-border">
            Cancelado: <span className="font-semibold text-zry-danger">{formatCurrency(kpis.churnedVolume)}</span>
          </div>
        </div>

        {/* KPI 3c: Taxa de Churn */}
        <div className="bg-zry-surface rounded-zry-lg p-5 border border-zry-border">
          <div className="w-[38px] h-[38px] rounded-xl bg-zry-roxo flex items-center justify-center mb-3.5">
            <TrendingDown className="w-[18px] h-[18px] text-zry-creme" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold tracking-tight text-zry-text leading-none">
              {kpis.churnRate.toFixed(1)}
            </span>
            <span className="text-[12px] font-semibold text-zry-text-2">%</span>
          </div>
          <div className="text-[12.5px] text-zry-text-2 mt-1.5">Taxa de churn</div>
          <div className="text-[11.5px] text-zry-text-2 mt-2 pt-2 border-t border-zry-border">
            {kpis.churnedCount} de {kpis.totalWonDeals} fechados
          </div>
        </div>

        {/* KPI 4: Descontos Aplicados (R$ e %) */}
        <div className="bg-zry-surface rounded-zry-lg p-5 border border-zry-border">
          <div className="w-[38px] h-[38px] rounded-xl bg-zry-roxo flex items-center justify-center mb-3.5">
            <Percent className="w-[18px] h-[18px] text-zry-creme" />
          </div>
          <div className="text-[22px] font-bold tracking-tight text-zry-text leading-none">
            {formatCurrency(kpis.totalDiscountVolume)}
          </div>
          <div className="text-[12.5px] text-zry-text-2 mt-1.5">Descontos aplicados</div>
          <div
            className="text-[11.5px] text-zry-text-2 mt-2 pt-2 border-t border-zry-border"
            title="10% padrão mensal / 15% anual"
          >
            <span className="font-semibold text-zry-text">{kpis.avgDiscountPercent.toFixed(1)}% médio</span> (10% mens / 15% an.)
          </div>
        </div>

        {/* KPI 5: Comissões a Pagar */}
        <div
          onClick={onNavigateToCommissions}
          className="bg-zry-surface rounded-zry-lg p-5 border border-zry-border cursor-pointer hover:border-zry-coral transition group"
        >
          <div className="w-[38px] h-[38px] rounded-xl bg-zry-coral flex items-center justify-center mb-3.5">
            <AlertTriangle className="w-[18px] h-[18px] text-zry-roxo" />
          </div>
          <div className="text-[22px] font-bold tracking-tight text-zry-text leading-none">
            {formatCurrency(kpis.commissionsToPay)}
          </div>
          <div className="text-[12.5px] text-zry-text-2 mt-1.5">Comissões a pagar</div>
          <div className="flex items-center justify-between text-[11.5px] text-zry-text-2 mt-2 pt-2 border-t border-zry-border">
            <span>
              <span className="font-semibold text-zry-text">{kpis.pendingCommissionCount}</span> parcela(s)
            </span>
            <span className="font-semibold text-zry-roxo group-hover:translate-x-0.5 transition-transform">Ver &rarr;</span>
          </div>
        </div>

      </div>

      {/* Saúde / Engajamento do Canal. Entra com 100%, decai até zerar em
          ENGAGEMENT_ZERO_DAYS dias sem indicar, e cada indicação recupera
          ENGAGEMENT_REFERRAL_BOOST pp. Sempre "hoje": não segue o filtro de período. */}
      <div className="bg-zry-surface rounded-zry-lg p-6 border border-zry-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zry-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zry-lilas-30 text-zry-roxo flex items-center justify-center shrink-0">
              <HeartPulse className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-zry-text">Saúde do Canal</h3>
              <p className="text-[11.5px] text-zry-text-2 mt-0.5">
                Engajamento hoje — 100% na entrada, zera em {ENGAGEMENT_ZERO_DAYS} dias sem indicar, +{ENGAGEMENT_REFERRAL_BOOST}pp por indicação
              </p>
            </div>
          </div>

          <select
            value={engagementPartnerId}
            onChange={(e) => setEngagementPartnerId(e.target.value)}
            className="shrink-0 text-[12px] font-semibold text-zry-text bg-zry-lilas-30 border border-zry-border rounded-full px-3.5 py-2 focus:bg-zry-surface focus:border-zry-roxo focus:ring-1 focus:ring-zry-roxo"
          >
            <option value="all">Média do canal ({channelHealth.scoredCount} parceiro(s))</option>
            {channelHealth.byPartner
              .slice()
              .sort((a, b) => a.partnerName.localeCompare(b.partnerName))
              .map(e => (
                <option key={e.partnerId} value={e.partnerId}>
                  {e.partnerName}
                </option>
              ))}
          </select>
        </div>

        {selectedEngagement ? (
          /* Um parceiro específico */
          <div className="mt-5">
            <div className="flex items-end justify-between gap-4 mb-2.5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zry-text-2 block">
                  Engajamento de {selectedEngagement.partnerName}
                </span>
                <span className="text-[30px] font-bold text-zry-text leading-none">
                  {selectedEngagement.score === null ? '—' : `${Math.round(selectedEngagement.score)}%`}
                </span>
              </div>
              <button
                onClick={() => onSelectPartner(selectedEngagement.partnerId)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-zry-roxo hover:opacity-80 shrink-0"
              >
                <span>Ver indicações</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <EngagementBar score={selectedEngagement.score} level={selectedEngagement.level} showLabel={false} />

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="bg-zry-lilas-30 rounded-zry-lg p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zry-text-2 block">Indicações</span>
                <span className="text-[17px] font-bold text-zry-text">{selectedEngagement.referralCount}</span>
              </div>
              <div className="bg-zry-lilas-30 rounded-zry-lg p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zry-text-2 block">Última indicação</span>
                <span className="text-[17px] font-bold text-zry-text">
                  {selectedEngagement.daysSinceLastReferral === null
                    ? 'Nunca'
                    : `${selectedEngagement.daysSinceLastReferral}d atrás`}
                </span>
              </div>
              <div className="bg-zry-lilas-30 rounded-zry-lg p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zry-text-2 block">Entrada</span>
                <span className="text-[17px] font-bold text-zry-text">
                  {selectedEngagement.anchorDate ? formatDateBR(selectedEngagement.anchorDate) : '—'}
                </span>
              </div>
              <div className="bg-zry-lilas-30 rounded-zry-lg p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zry-text-2 block">Situação</span>
                <span
                  className={`text-[17px] font-bold ${
                    selectedEngagement.level === 'saudavel'
                      ? 'text-zry-positive'
                      : selectedEngagement.level === 'risco'
                        ? 'text-zry-warning'
                        : selectedEngagement.level === 'inativo'
                          ? 'text-zry-danger'
                          : 'text-zry-text-2'
                  }`}
                >
                  {selectedEngagement.level === 'saudavel'
                    ? 'Saudável'
                    : selectedEngagement.level === 'risco'
                      ? 'Em risco'
                      : selectedEngagement.level === 'inativo'
                        ? 'Inativo'
                        : 'Sem dados'}
                </span>
              </div>
            </div>

            {selectedEngagement.score === null && (
              <div className="mt-4 bg-zry-lilas-30 rounded-xl p-4 text-[12.5px] text-zry-text-2 flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-zry-roxo shrink-0 mt-0.5" />
                <span>
                  Sem <strong className="text-zry-text">Data de Entrada</strong> no cadastro deste parceiro não há de quando
                  contar o decaimento. Preencha para o engajamento passar a ser calculado.
                </span>
              </div>
            )}
          </div>
        ) : (
          /* Média do canal */
          <div className="mt-5">
            <div className="flex items-end justify-between gap-4 mb-2.5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zry-text-2 block">
                  Engajamento médio do canal
                </span>
                <span className="text-[30px] font-bold text-zry-text leading-none">
                  {channelHealth.average === null ? '—' : `${Math.round(channelHealth.average)}%`}
                </span>
              </div>
              <span className="text-[11.5px] text-zry-text-2 shrink-0 text-right">
                Risco a partir de {ENGAGEMENT_RISK_THRESHOLD}%
              </span>
            </div>

            <EngagementBar
              score={channelHealth.average}
              level={
                channelHealth.average === null
                  ? 'sem-dados'
                  : channelHealth.average <= 0
                    ? 'inativo'
                    : channelHealth.average <= ENGAGEMENT_RISK_THRESHOLD
                      ? 'risco'
                      : 'saudavel'
              }
              showLabel={false}
            />

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="bg-zry-positive-bg rounded-zry-lg p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zry-text-2 block">Saudáveis</span>
                <span className="text-[17px] font-bold text-zry-positive">{channelHealth.healthyCount}</span>
              </div>
              <div className="bg-zry-warning-bg rounded-zry-lg p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zry-text-2 block">Em risco</span>
                <span className="text-[17px] font-bold text-zry-warning">{channelHealth.riskCount}</span>
              </div>
              <div className="bg-zry-danger-bg rounded-zry-lg p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zry-text-2 block">Inativos</span>
                <span className="text-[17px] font-bold text-zry-danger">{channelHealth.inactiveCount}</span>
              </div>
              <div className="bg-zry-lilas-30 rounded-zry-lg p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zry-text-2 block">Sem data</span>
                <span className="text-[17px] font-bold text-zry-text-2">{channelHealth.missingDataCount}</span>
              </div>
            </div>

            {channelHealth.missingDataCount > 0 && (
              <div className="mt-4 bg-zry-warning-bg/70 border border-zry-warning/30 rounded-xl p-4 text-[12.5px] text-zry-warning flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>{channelHealth.missingDataCount} parceiro(s) sem Data de Entrada</strong> ficam fora da média e não
                  são inativados automaticamente — sem essa data não há de quando contar o decaimento.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custos & MRR do Canal (mês corrente) — indicadores visíveis pra todos;
          só o preenchimento do custo/MRR (dado do financeiro) é master-only. */}
      {channelMetrics && (
        <div className="bg-zry-surface rounded-zry-lg p-6 border border-zry-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zry-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zry-lilas-30 text-zry-roxo flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-zry-text">Custos & MRR do Canal</h3>
                <p className="text-[11.5px] text-zry-text-2 mt-0.5">
                  Mês corrente — dados informados pelo financeiro
                </p>
              </div>
            </div>
            {onNavigateToChannelMetrics && (
              <button
                onClick={onNavigateToChannelMetrics}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-zry-roxo hover:opacity-80 shrink-0"
              >
                <span>{isMaster ? 'Ver detalhes & preencher' : 'Ver detalhes'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {channelMetrics.cost === null && channelMetrics.companyTotalNewMrr === null ? (
            <div className="mt-4 bg-zry-lilas-30 rounded-xl p-4 text-[12.5px] text-zry-text-2 flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-zry-roxo shrink-0 mt-0.5" />
              <span>
                Nenhum custo do canal ou novo MRR informado para este mês ainda.{' '}
                {isMaster
                  ? 'Preencha em "Custos & MRR" para ver CAC, CAP e comparação com a empresa aqui.'
                  : 'Aguardando o Master preencher em "Custos & MRR" para ver CAC, CAP e comparação com a empresa aqui.'}
              </span>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <div className="bg-zry-lilas-30 rounded-zry-lg p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zry-text-2 block">Custo do Canal</span>
                <div className="text-[18px] font-bold text-zry-roxo tracking-tight mt-1">
                  {channelMetrics.cost !== null ? formatCurrency(channelMetrics.cost) : '—'}
                </div>
              </div>
              <div className="bg-zry-lilas-30 rounded-zry-lg p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zry-text-2 block">CAC / Cliente</span>
                <div className="text-[18px] font-bold text-zry-roxo tracking-tight mt-1">
                  {channelMetrics.cacPorCliente !== null ? formatCurrency(channelMetrics.cacPorCliente) : '—'}
                </div>
              </div>
              <div className="bg-zry-lilas-30 rounded-zry-lg p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zry-text-2 block">CAP</span>
                <div className="text-[18px] font-bold text-zry-roxo tracking-tight mt-1">
                  {channelMetrics.cap !== null ? formatCurrency(channelMetrics.cap) : '—'}
                </div>
              </div>
              <div className="bg-zry-lilas-30 rounded-zry-lg p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zry-text-2 block">Relevância no MRR</span>
                <div className="text-[18px] font-bold text-zry-roxo tracking-tight mt-1">
                  {channelMetrics.channelRelevancePercent !== null ? `${channelMetrics.channelRelevancePercent.toFixed(1)}%` : '—'}
                </div>
              </div>
              <div className="bg-zry-lilas-30 rounded-zry-lg p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zry-text-2 block">Ticket Canal vs Total</span>
                <div
                  className={`text-[18px] font-bold tracking-tight mt-1 ${
                    channelMetrics.ticketMedioComparisonPercent === null
                      ? 'text-zry-roxo'
                      : channelMetrics.ticketMedioComparisonPercent >= 0
                      ? 'text-zry-positive'
                      : 'text-zry-danger'
                  }`}
                >
                  {channelMetrics.ticketMedioComparisonPercent !== null
                    ? `${channelMetrics.ticketMedioComparisonPercent >= 0 ? '+' : ''}${channelMetrics.ticketMedioComparisonPercent.toFixed(1)}%`
                    : '—'}
                </div>
              </div>
            </div>
          )}

          {channelMetrics.discrepancy.hasEntry && channelMetrics.discrepancy.hasDiscrepancy && (
            <div className="mt-3.5 bg-zry-warning-bg border border-zry-warning/30 rounded-xl p-3 text-[12px] text-zry-warning flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                O MRR do canal informado não bate com as indicações fechadas no sistema — diferença de{' '}
                {formatCurrency(Math.abs(channelMetrics.discrepancy.diff || 0))}.
              </span>
            </div>
          )}
        </div>
      )}

      <AmbassadorAnalysis
        partners={partners}
        referrals={referrals}
        onSelectPartner={onSelectPartner}
      />

      {/* Safras de Parceiro: agrupadas pelo mês de ENTRADA do parceiro (sem corte).
          Vem antes das safras de indicação de propósito: primeiro quem entrou,
          depois o que essa entrada gerou. */}
      <PartnerVintageReport
        partners={partners}
        referrals={referrals}
        statMode={statMode}
        onSelectPartner={onSelectPartner}
      />

      {/* Safras de Indicação: Corte D+15, Conversão e Fechamentos por Safra (Últimos 12 Meses) */}
      <VintageCohortReport
        referrals={referrals}
        statMode={statMode}
        onSelectReferral={(referralId) => {
          if (onEditReferral) {
            const found = referrals.find(r => r.id === referralId);
            if (found) onEditReferral(found);
          }
        }}
      />

      {/* Cancelamentos por Mês (churn) */}
      <ChurnReport
        referrals={referrals}
        onSelectReferral={(referralId) => {
          if (onEditReferral) {
            const found = referrals.find(r => r.id === referralId);
            if (found) onEditReferral(found);
          }
        }}
      />

      {/* Card de Performance Consolidada: Ticket Médio de Vendas vs Custo Médio de Comissão */}
      <div className="bg-zry-surface rounded-zry-lg p-6 sm:p-7 border border-zry-border/90 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zry-border pb-5">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 bg-zry-lilas-30 text-zry-roxo rounded-2xl shrink-0">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zry-text tracking-tight">
                  Performance Consolidada &amp; Rentabilidade do Canal
                </h2>
                <span className="bg-zry-lilas text-zry-roxo text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider">
                  Eficiência
                </span>
              </div>
              <p className="text-xs text-zry-text-2 mt-1">
                A receita do canal é recorrente (MRR) e a comissão é um custo único de aquisição. Por isso a margem e o ROI comparam a comissão contra <strong className="text-zry-text-2">12 meses</strong> de mensalidade, e o payback aparece em meses. Base: contratos vivos.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {kpis.paybackMonths !== null && (
              <div className="flex items-center gap-1.5 bg-zry-lilas text-zry-roxo border border-zry-roxo/30 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-zry-roxo" />
                <span>Payback: {kpis.paybackMonths.toFixed(1)} {kpis.paybackMonths === 1 ? 'mês' : 'meses'} de MRR</span>
              </div>
            )}
            {kpis.revenueMultiplier > 0 ? (
              <div className="flex items-center gap-1.5 bg-zry-positive-bg text-zry-positive border border-zry-positive/80 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs">
                <Coins className="w-3.5 h-3.5 text-zry-positive" />
                <span>ROI 12m: {kpis.revenueMultiplier.toFixed(1)}x por R$ em comissão</span>
              </div>
            ) : (
              <span className="text-xs text-zry-text-2 bg-zry-lilas-30 px-3 py-1 rounded-lg font-medium">
                Sem contratos vivos no filtro
              </span>
            )}
          </div>
        </div>

        {/* Comparative Split Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Card A: Ticket Médio de Vendas */}
          <div className="bg-zry-lilas-30 rounded-zry-lg p-5 border border-zry-border flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zry-roxo bg-zry-lilas px-2 py-0.5 rounded-md">
                  Receita do Canal
                </span>
                <span className="text-xs text-zry-text-2 font-medium">
                  {kpis.activeWonDeals} contrato(s) vivo(s)
                </span>
              </div>
              <div className="mt-3">
                <span className="text-xs text-zry-text-2 block font-medium">Ticket Médio Recorrente (MRR / contrato vivo)</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl sm:text-4xl font-black text-zry-text tracking-tight">
                    {formatCurrency(kpis.avgTicket)}
                  </span>
                  <span className="text-xs font-semibold text-zry-text-2">
                    / mês
                  </span>
                </div>
                <span className="text-[11px] text-zry-roxo font-semibold block mt-1.5">
                  {formatCurrency(kpis.revenue12mPerDeal)} em 12 meses por contrato
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-zry-border/60 flex flex-wrap items-center justify-between text-xs text-zry-text-2 gap-2">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-zry-roxo inline-block"></span>
                MRR Ativo do Canal: <strong className="text-zry-text">{formatCurrency(kpis.activeWonVolume)}</strong>
              </span>
              <span className="text-zry-text-2">
                {kpis.churnedCount > 0 ? (
                  <>Fora da conta: <strong className="text-zry-danger">{formatCurrency(kpis.churnedVolume)}</strong> em {kpis.churnedCount} churn</>
                ) : (
                  <>Valor Bruto de Tabela: <strong className="text-zry-text-2">{formatCurrency(kpis.totalWonDeals > 0 ? kpis.grossWonVolume / kpis.totalWonDeals : 0)}</strong></>
                )}
              </span>
            </div>
          </div>

          {/* Card B: Custo Médio de Comissão */}
          <div className="bg-zry-creme rounded-zry-lg p-5 border border-zry-coral/40 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zry-warning bg-zry-warning-bg px-2 py-0.5 rounded-md">
                  Custo de Parceria
                </span>
                <span className="text-xs font-semibold text-zry-warning">
                  {kpis.commissionSharePercent > 0 ? `${kpis.commissionSharePercent.toFixed(1)}% da receita de 12m` : '0%'}
                </span>
              </div>
              <div className="mt-3">
                <span className="text-xs text-zry-warning block font-medium">Custo de Aquisição por Contrato (comissão total)</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl sm:text-4xl font-black text-zry-warning tracking-tight">
                    {formatCurrency(kpis.avgCommissionCost)}
                  </span>
                  <span className="text-xs font-semibold text-zry-warning">
                    uma vez
                  </span>
                </div>
                <span className="text-[11px] text-zry-warning font-semibold block mt-1.5">
                  Todas as parcelas somadas — não se repete a cada mês
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-zry-warning/60 flex flex-wrap items-center justify-between text-xs text-zry-warning gap-2">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-zry-warning inline-block"></span>
                Comissão da Base Viva: <strong className="text-zry-warning">{formatCurrency(kpis.activeCommissionCost)}</strong>
              </span>
              <span className="text-zry-warning">
                Quitadas: <strong>{formatCurrency(kpis.activeCommissionPaid)}</strong> | A Pagar: <strong>{formatCurrency(kpis.activeCommissionOwed)}</strong>
              </span>
            </div>
          </div>

        </div>

        {/* Visual Proportional Ratio Bar */}
        <div className="bg-zry-lilas-30 rounded-2xl p-5 border border-zry-border/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5">
            <span className="font-bold text-zry-text-2">
              Distribuição da Receita de 12 Meses por Contrato
            </span>
            <span className="text-zry-text-2">
              {kpis.activeWonDeals > 0
                ? `Base de cálculo: ${kpis.activeWonDeals} contrato(s) vivo(s) · ${formatCurrency(kpis.revenue12mPerDeal)} em 12m`
                : 'Nenhum contrato vivo registrado no filtro selecionado'}
            </span>
          </div>

          {kpis.activeWonDeals > 0 && kpis.avgTicket > 0 ? (
            <div className="space-y-2">
              <div className="h-5 w-full bg-zry-lilas rounded-xl overflow-hidden flex shadow-inner">
                {/* Net company retention */}
                <div 
                  style={{ width: `${Math.max(5, 100 - kpis.commissionSharePercent)}%` }}
                  className="bg-zry-roxo hover:bg-zry-roxo-hover transition-colors flex items-center justify-start px-2.5 text-[10px] font-bold text-white truncate"
                  title={`Margem Líquida em 12 meses: ${formatCurrency(kpis.netChannelMargin)} (${(100 - kpis.commissionSharePercent).toFixed(1)}%)`}
                >
                  {(100 - kpis.commissionSharePercent).toFixed(1)}% Margem Líquida
                </div>
                {/* Commission paid out */}
                <div 
                  style={{ width: `${Math.min(95, kpis.commissionSharePercent)}%` }}
                  className="bg-zry-warning hover:bg-zry-warning transition-colors flex items-center justify-end px-2.5 text-[10px] font-bold text-white truncate"
                  title={`Comissão do Parceiro: ${formatCurrency(kpis.avgCommissionCost)} (${kpis.commissionSharePercent.toFixed(1)}%)`}
                >
                  {kpis.commissionSharePercent.toFixed(1)}% Comissão
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between text-[11px] text-zry-text-2 pt-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-zry-positive inline-block"></span>
                  <span>Margem Retida em 12m: <strong className="text-zry-positive">{formatCurrency(kpis.netChannelMargin)}</strong> por cliente</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-zry-warning inline-block"></span>
                  <span>Custo de Comissão: <strong className="text-zry-warning">{formatCurrency(kpis.avgCommissionCost)}</strong> por cliente</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-zry-surface rounded-xl border border-zry-border text-center text-xs text-zry-text-2">
              Registre contratos fechados no sistema para visualizar a régua visual de rentabilidade do canal.
            </div>
          )}
        </div>

        {/* 5 Strategic Pillars of Channel Profitability */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">

          <div className="bg-zry-surface rounded-xl p-3.5 border border-zry-border">
            <span className="text-[11px] font-medium text-zry-text-2 block">Payback da Comissão</span>
            <span className="text-lg font-bold text-zry-text block mt-1">
              {kpis.paybackMonths !== null ? `${kpis.paybackMonths.toFixed(1)} ${kpis.paybackMonths === 1 ? 'mês' : 'meses'}` : '—'}
            </span>
            <span className="text-[11px] text-zry-text-2 block mt-0.5">
              Mensalidades até se pagar
            </span>
          </div>

          <div className="bg-zry-surface rounded-xl p-3.5 border border-zry-border">
            <span className="text-[11px] font-medium text-zry-text-2 block">Margem Líquida em 12m</span>
            <span className="text-lg font-bold text-zry-text block mt-1">
              {formatCurrency(kpis.netChannelMargin)}
            </span>
            <span className="text-[11px] text-zry-positive font-semibold block mt-0.5">
              {kpis.avgTicket > 0 ? `${(100 - kpis.commissionSharePercent).toFixed(1)}% retido` : '—'}
            </span>
          </div>

          <div className="bg-zry-surface rounded-xl p-3.5 border border-zry-border">
            <span className="text-[11px] font-medium text-zry-text-2 block">Take-Rate da Parceria</span>
            <span className="text-lg font-bold text-zry-text block mt-1">
              {kpis.commissionSharePercent > 0 ? `${kpis.commissionSharePercent.toFixed(1)}%` : '0%'}
            </span>
            <span className="text-[11px] text-zry-warning font-medium block mt-0.5">
              Comissão s/ receita de 12m
            </span>
          </div>

          <div className="bg-zry-surface rounded-xl p-3.5 border border-zry-border">
            <span className="text-[11px] font-medium text-zry-text-2 block">Múltiplo ROI (12m)</span>
            <span className="text-lg font-bold text-zry-text block mt-1">
              {kpis.revenueMultiplier > 0 ? `${kpis.revenueMultiplier.toFixed(1)}x` : '—'}
            </span>
            <span className="text-[11px] text-zry-text-2 block mt-0.5">
              Receita 12m por R$ 1 de comissão
            </span>
          </div>

          <div className="bg-zry-surface rounded-xl p-3.5 border border-zry-border">
            <span className="text-[11px] font-medium text-zry-text-2 block">Volume Líquido em 12m</span>
            <span className="text-lg font-bold text-zry-text block mt-1">
              {formatCurrency(kpis.netVolume12m)}
            </span>
            <span className="text-[11px] text-zry-text-2 block mt-0.5">
              Base viva livre de comissão
            </span>
          </div>

        </div>

        {/* Churn: o que saiu da conta acima, declarado em vez de escondido */}
        {kpis.churnedCount > 0 && (
          <div className="bg-zry-danger-bg/40 rounded-2xl p-4 border border-zry-danger/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <TrendingDown className="w-4 h-4 text-zry-danger shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-zry-danger block">
                  {kpis.churnedCount} contrato(s) cancelado(s) — fora dos cálculos acima
                </span>
                <span className="text-[11px] text-zry-text-2 block mt-0.5">
                  A receita saiu da base e as parcelas que restavam deixaram de ser devidas.
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] shrink-0">
              <span className="text-zry-text-2">
                MRR perdido: <strong className="text-zry-danger">{formatCurrency(kpis.churnedVolume)}</strong>
              </span>
              <span className="text-zry-text-2">
                Comissão paga sem retorno: <strong className="text-zry-danger">{formatCurrency(kpis.churnedCommissionPaid)}</strong>
              </span>
              <span className="text-zry-text-2">
                Parcelas canceladas: <strong className="text-zry-positive">{formatCurrency(kpis.churnedCommissionCancelled)}</strong>
              </span>
            </div>
          </div>
        )}

      </div>

      {/* Distribuição Geográfica dos Parceiros */}
      <PartnerLocationMap partners={partners} />

      {/* Relatório de Maturação e Conversão por Mês de Parceria (Mês 1, 2, 3...) */}
      <PartnerCohortChart
        referrals={referrals}
        partners={partners}
        statMode={statMode}
        selectedPartnerId={filter.partnerId}
        onSelectPartner={(partnerId) => {
          onFilterChange({
            ...filter,
            partnerId
          });
        }}
      />

      {/* Ciclo de Indicação do Programa Section */}
      <div className="bg-zry-roxo text-zry-creme rounded-zry-lg p-6 border border-white/10 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-zry-coral/20 text-zry-coral rounded-lg">
                <Zap className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-zry-creme tracking-tight">Ciclo de Indicação do Programa</h2>
            </div>
            <p className="text-xs text-zry-creme/60 mt-1">
              Indicadores de tempo e maturação comercial de ponta a ponta do canal, calculados por{' '}
              <strong className="text-zry-coral">{STAT_MODE_LABEL[statMode].toLowerCase()}</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs bg-zry-surface/10 px-3 py-1.5 rounded-xl border border-white/15">
            <span className="text-zry-creme/60">Ativação do Canal:</span>
            <span className="font-bold text-zry-coral">{kpis.partnerActivationRate.toFixed(0)}% com indicações</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">

          {/* Card 1: Entrada -> 1ª Indicação */}
          <div className="bg-zry-surface/10 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between text-xs text-zry-creme/60">
              <span>Ativação de Parceiro</span>
              <span className="text-zry-coral font-medium">Entrada &rarr; 1ª Indicação</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-zry-creme tracking-tight">
                {displayActivationDays !== null ? `${displayActivationDays}` : '—'}
              </span>
              <span className="text-sm font-semibold text-zry-creme/80">dias {statSuffix}</span>
            </div>
            <p className="text-xs text-zry-creme/60 mt-2 leading-relaxed">
              {STAT_MODE_LABEL[statMode]} entre a data de cadastro do parceiro e sua primeira indicação registrada.
              {kpis.daysPartnerToFirstReferral.count > 0 &&
                ` Base: ${kpis.daysPartnerToFirstReferral.count} parceiro(s) que já indicaram.`}
            </p>
          </div>

          {/* Card 2: Indicação -> Fechamento Ganho */}
          <div className="bg-zry-surface/10 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between text-xs text-zry-creme/60">
              <span>Velocidade de Fechamento</span>
              <span className="text-zry-coral font-medium">Lead &rarr; Ganho</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-zry-creme tracking-tight">
                {displayCloseDays !== null ? `${displayCloseDays}` : '—'}
              </span>
              <span className="text-sm font-semibold text-zry-creme/80">dias {statSuffix}</span>
            </div>
            <p className="text-xs text-zry-creme/60 mt-2 leading-relaxed">
              Tempo decorrido entre a indicação recebida e a assinatura do contrato, {statSuffix}.
              {kpis.daysReferralToClose.count > 0 &&
                ` Base: ${kpis.daysReferralToClose.count} negócio(s) fechado(s).`}
            </p>
          </div>

          {/* Card 3: Base Ativa vs Total */}
          <div className="bg-zry-surface/10 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between text-xs text-zry-creme/60">
              <span>Parceiros Ativos</span>
              <span className="text-zry-coral font-medium">Cadastrados</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-zry-creme tracking-tight">
                {kpis.activePartnersCount}
              </span>
              <span className="text-sm font-semibold text-zry-creme/80">de {partners.length} parceiros</span>
            </div>
            <p className="text-xs text-zry-creme/60 mt-2 leading-relaxed">
              Parceiros aptos para novas indicações comerciais — inclui os em risco, exclui onboarding e inativos.
            </p>
          </div>

        </div>
      </div>

      {/* Ranking Interativo de Parceiros (Explicit Requirement: ranking por número de indicações e por negócios fechados) */}
      <div className="bg-zry-surface rounded-zry-lg p-6 border border-zry-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zry-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-zry-warning" />
              <h3 className="text-base font-bold text-zry-text">Ranking Estratégico de Parceiros</h3>
            </div>
            <p className="text-xs text-zry-text-2 mt-0.5">
              Classifique parceiros por número de indicações, negócios fechados, volume financeiro ou taxa de conversão.
            </p>
          </div>

          {/* Toggle de Classificação (Por Indicações vs Por Fechados vs Outros) */}
          <div className="flex flex-wrap items-center gap-1 bg-zry-lilas-30 p-1 rounded-full text-xs font-medium self-start md:self-auto">
            <span className="text-[11px] text-zry-text-2 px-2 font-semibold">Ordenar:</span>
            <button
              onClick={() => setRankingSort('wonDeals')}
              className={`px-3 py-1.5 rounded-full transition ${
                rankingSort === 'wonDeals'
                  ? 'bg-zry-roxo text-zry-creme font-bold'
                  : 'text-zry-text-2 hover:text-zry-text'
              }`}
            >
              Negócios Fechados
            </button>
            <button
              onClick={() => setRankingSort('referrals')}
              className={`px-3 py-1.5 rounded-full transition ${
                rankingSort === 'referrals'
                  ? 'bg-zry-roxo text-zry-creme font-bold'
                  : 'text-zry-text-2 hover:text-zry-text'
              }`}
            >
              Nº de Indicações
            </button>
            <button
              onClick={() => setRankingSort('volume')}
              className={`px-3 py-1.5 rounded-full transition ${
                rankingSort === 'volume'
                  ? 'bg-zry-roxo text-zry-creme font-bold'
                  : 'text-zry-text-2 hover:text-zry-text'
              }`}
            >
              Volume (R$)
            </button>
            <button
              onClick={() => setRankingSort('conversion')}
              className={`px-3 py-1.5 rounded-full transition ${
                rankingSort === 'conversion'
                  ? 'bg-zry-roxo text-zry-creme font-bold'
                  : 'text-zry-text-2 hover:text-zry-text'
              }`}
            >
              Conversão (%)
            </button>
            <button
              onClick={() => setRankingSort('speed')}
              className={`px-3 py-1.5 rounded-full transition ${
                rankingSort === 'speed'
                  ? 'bg-zry-roxo text-zry-creme font-bold'
                  : 'text-zry-text-2 hover:text-zry-text'
              }`}
            >
              Mais Rápidos
            </button>
          </div>
        </div>

        {/* Ranking Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[13px] text-zry-text-2">
            <thead className="text-[11px] text-zry-text-2 uppercase tracking-wider font-semibold border-b border-zry-border">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Posição</th>
                <th className="py-3 px-4">Parceiro</th>
                <th className="py-3 px-4">Data Entrada</th>
                <th className={`py-3 px-4 text-center ${rankingSort === 'referrals' ? 'text-zry-roxo bg-zry-lilas-30' : ''}`}>
                  Indicações
                </th>
                <th className={`py-3 px-4 text-center ${rankingSort === 'wonDeals' ? 'text-zry-roxo bg-zry-lilas-30' : ''}`}>
                  Negócios Fechados
                </th>
                <th className={`py-3 px-4 text-right ${rankingSort === 'volume' ? 'text-zry-roxo bg-zry-lilas-30' : ''}`}>
                  Volume Ganho
                </th>
                <th className="py-3 px-4 text-right">Comissões</th>
                <th className={`py-3 px-4 text-center ${rankingSort === 'conversion' ? 'text-zry-roxo bg-zry-lilas-30' : ''}`}>
                  Conversão
                </th>
                <th className={`py-3 px-4 text-center ${rankingSort === 'speed' ? 'text-zry-roxo bg-zry-lilas-30' : ''}`}>
                  Ciclo 1ª Indicação
                </th>
                <th className="py-3 px-4 text-center">Ação</th>
              </tr>
            </thead>
            <tbody>
              {rankings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-zry-text-2">
                    Nenhum parceiro cadastrado para o ranking.
                  </td>
                </tr>
              ) : (
                rankings.map((item, index) => {
                  const isTop3 = index < 3;
                  return (
                    <tr key={item.partnerId} className="border-t border-zry-border hover:bg-zry-lilas-30/60 transition-colors">
                      <td className="py-3 px-4 text-center font-bold">
                        {index === 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zry-coral text-zry-roxo font-extrabold text-xs">
                            1º
                          </span>
                        ) : index === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zry-lilas text-zry-text-2 font-extrabold text-xs">
                            2º
                          </span>
                        ) : index === 2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zry-warning/10 text-zry-warning font-extrabold text-xs">
                            3º
                          </span>
                        ) : (
                          <span className="text-zry-text-2 font-semibold">{index + 1}º</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-semibold text-zry-text">
                        <div className="flex items-center gap-2">
                          <span>{item.partnerName}</span>
                          {isTop3 && (
                            <span className="text-[10px] bg-zry-warning-bg text-zry-warning border border-zry-warning/30 px-1.5 py-0.2 rounded font-medium">
                              Top {index + 1}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-zry-text-2">
                        {item.joinedDate ? (
                          formatDateBR(item.joinedDate)
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-zry-warning bg-zry-warning-bg px-1.5 py-0.5 rounded border border-zry-warning/30">
                            <AlertTriangle className="w-3 h-3" />
                            Data pendente
                          </span>
                        )}
                      </td>

                      <td className={`py-3 px-4 text-center font-semibold ${
                        rankingSort === 'referrals' ? 'text-zry-info font-bold bg-zry-info-bg/30' : 'text-zry-text-2'
                      }`}>
                        {item.totalReferrals}
                      </td>

                      <td className={`py-3 px-4 text-center font-bold ${
                        rankingSort === 'wonDeals' ? 'text-zry-positive bg-zry-positive-bg/30' : 'text-zry-positive'
                      }`}>
                        {item.wonReferrals}
                      </td>

                      <td className={`py-3 px-4 text-right font-bold ${
                        rankingSort === 'volume' ? 'text-zry-text bg-zry-lilas-30' : 'text-zry-text'
                      }`}>
                        {formatCurrency(item.wonVolume)}
                      </td>

                      <td className="py-3 px-4 text-right font-semibold text-zry-info">
                        {formatCurrency(item.totalCommissions)}
                      </td>

                      <td className={`py-3 px-4 text-center ${rankingSort === 'conversion' ? 'bg-zry-info-bg/30' : ''}`}>
                        <span className={`inline-block px-2 py-0.5 rounded font-semibold text-[11px] ${
                          item.conversionRate >= 50
                            ? 'bg-zry-positive-bg text-zry-positive border border-zry-positive/30'
                            : item.conversionRate > 0
                            ? 'bg-zry-lilas-30 text-zry-text-2'
                            : 'text-zry-text-2'
                        }`}>
                          {item.conversionRate.toFixed(0)}%
                        </span>
                      </td>

                      <td className={`py-3 px-4 text-center text-zry-text-2 ${rankingSort === 'speed' ? 'bg-zry-info-bg/30' : ''}`}>
                        {item.daysToFirstReferral !== null ? (
                          <span className="font-medium text-zry-text">
                            {item.daysToFirstReferral} {item.daysToFirstReferral === 1 ? 'dia' : 'dias'}
                          </span>
                        ) : item.totalReferrals > 0 ? (
                          <span className="text-zry-warning text-[11px]">Sem data entrada</span>
                        ) : (
                          <span className="text-zry-text-2">Sem indicação</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onSelectPartner(item.partnerId)}
                          className="text-xs font-semibold text-zry-info hover:text-zry-info hover:underline inline-flex items-center gap-1"
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
