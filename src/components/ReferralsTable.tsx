import { useState } from 'react';
import type { Referral, Partner, FilterState, DealStatus, CommissionStatus } from '../types';
import { filterReferrals, formatCurrency, formatDateBR } from '../utils/analytics';
import { monthKeyOf, monthLabelPt } from '../utils/dateLabels';
import {
  Search,
  AlertTriangle,
  Edit3,
  Trash2,
  Plus,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  Hash,
  RotateCcw
} from 'lucide-react';

interface ReferralsTableProps {
  referrals: Referral[];
  partners: Partner[];
  filter: FilterState;
  onFilterChange: (newFilter: FilterState) => void;
  onEditReferral: (referral: Referral) => void;
  onDeleteReferral: (id: string) => void;
  onOpenNewReferral: () => void;
  isMaster?: boolean;
  onOpenBulk?: () => void;
}

export default function ReferralsTable({
  referrals,
  partners,
  filter,
  onFilterChange,
  onEditReferral,
  onDeleteReferral,
  onOpenNewReferral,
  isMaster = true,
  onOpenBulk
}: ReferralsTableProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showOnlyToComplete, setShowOnlyToComplete] = useState(false);

  const baseList = filterReferrals(referrals, filter, partners);
  const filteredList = showOnlyToComplete ? baseList.filter(r => r.isPlaceholder) : baseList;
  const placeholderCount = referrals.filter(r => r.isPlaceholder).length;
  const filteredDealValue = filteredList.reduce((sum, referral) => sum + (referral.dealValue || 0), 0);
  const filteredMrr = filteredList.reduce(
    (sum, referral) => sum + (referral.mrrNet ?? referral.dealValue ?? 0),
    0
  );
  const filteredCommissionValue = filteredList.reduce((sum, referral) => sum + (referral.commissionValue || 0), 0);

  // Safras que existem nos dados carregados, da mais nova para a mais antiga.
  // A opção "sem data" só aparece quando há registro sem data — é um convite a
  // completar o cadastro, não uma opção fixa do seletor.
  const buildVintageOptions = (keys: (string | null)[]) => {
    const months = new Set<string>();
    let hasNone = false;
    keys.forEach(k => { if (k) months.add(k); else hasNone = true; });
    return { months: Array.from(months).sort((a, b) => b.localeCompare(a)), hasNone };
  };

  const partnerVintages = buildVintageOptions(partners.map(p => monthKeyOf(p.joinedDate)));
  const referralVintages = buildVintageOptions(referrals.map(r => monthKeyOf(r.referralDate || r.closeDate)));
  const closeMonths = buildVintageOptions(
    referrals.filter(r => r.dealStatus === 'ganho').map(r => monthKeyOf(r.closeDate))
  );

  const partnerVintage = filter.partnerVintage || 'all';
  const referralVintage = filter.referralVintage || 'all';
  const closeMonth = filter.closeMonth || 'all';
  const vintageLabel = (v: string) => (v === 'none' ? 'sem data' : monthLabelPt(v));

  const badgeBase = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold';

  const statusBadge = (status: DealStatus) => {
    switch (status) {
      case 'ganho':
        return <span className={`${badgeBase} bg-zry-positive-bg text-zry-positive`}><CheckCircle2 className="w-3 h-3" /> Ganho / Fechado</span>;
      case 'negociacao':
        return <span className={`${badgeBase} bg-zry-info-bg text-zry-info`}><Clock className="w-3 h-3" /> Em Negociação</span>;
      case 'qualificado':
        return <span className={`${badgeBase} bg-zry-info-bg text-zry-info`}>Qualificado</span>;
      case 'contato':
        return <span className={`${badgeBase} bg-zry-lilas text-zry-roxo`}>Primeiro Contato</span>;
      case 'novo':
        return <span className={`${badgeBase} bg-zry-warning-bg text-zry-warning`}>Novo Lead</span>;
      case 'perdido':
        return <span className={`${badgeBase} bg-zry-danger-bg text-zry-danger`}><XCircle className="w-3 h-3" /> Perdido</span>;
    }
  };

  const commissionBadge = (status: CommissionStatus, value?: number) => {
    switch (status) {
      case 'paga':
        return <span className={`${badgeBase} bg-zry-positive-bg text-zry-positive`}>Paga</span>;
      case 'a_pagar':
        return <span className={`${badgeBase} bg-zry-warning-bg text-zry-warning`}>A Pagar</span>;
      case 'pendente_fechamento':
        return <span className={`${badgeBase} bg-zry-lilas text-zry-roxo`}>Pendente Fechamento</span>;
      case 'cancelada':
        return <span className={`${badgeBase} bg-zry-danger-bg text-zry-danger`}>Cancelada</span>;
    }
  };

  const handleClearFilters = () => {
    onFilterChange({
      period: { preset: 'all' },
      partnerId: 'all',
      dealStatus: 'all',
      commissionStatus: 'all',
      onlyMissingData: false,
      searchQuery: '',
      churnFilter: 'all',
      partnerVintage: 'all',
      referralVintage: 'all',
      closeMonth: 'all'
    });
    setShowOnlyToComplete(false);
  };

  const handleExportCSV = () => {
    const headers = ['Parceiro', 'Cliente', 'Empresa', 'Data Indicação', 'Status Negócio', 'Valor Contrato (R$)', 'Data Fechamento', 'Comissão %', 'Comissão Valor (R$)', 'Status Comissão', 'Data Pago', 'Notas'];
    const rows = filteredList.map(r => [
      `"${r.partnerName || ''}"`,
      `"${r.clientName || ''}"`,
      `"${r.clientCompany || ''}"`,
      r.referralDate || '',
      r.dealStatus,
      r.dealValue || '',
      r.closeDate || '',
      r.commissionPercent || '',
      r.commissionValue || '',
      r.commissionStatus,
      r.commissionPaidDate || '',
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `indicacoes_parcerias_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>

      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-zry-text leading-none">
            Indicações
          </h1>
          <p className="text-[13px] text-zry-text-2 mt-1.5">
            Gerencie indicações, atualize status comerciais e preencha dados faltantes manualmente.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-transparent border border-zry-border-strong text-zry-roxo font-semibold px-3.5 py-[7px] rounded-full text-[12px] hover:bg-zry-lilas-30 transition"
            title="Exportar dados filtrados para CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          {isMaster && onOpenBulk && (
            <button
              onClick={onOpenBulk}
              className="flex items-center gap-2 bg-zry-roxo hover:bg-zry-roxo-hover text-zry-creme font-bold px-[18px] py-2.5 rounded-full text-[12.5px] transition"
              title="Registrar indicações apenas como número (sem empresa) — exclusivo do acesso master"
            >
              <Hash className="w-3.5 h-3.5" />
              <span>Indicações em lote (sem empresa)</span>
            </button>
          )}

          <button
            onClick={onOpenNewReferral}
            className="flex items-center gap-2 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-[18px] py-2.5 rounded-full text-[12.5px] transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Indicação</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">

        {/* Banner: indicações sem empresa a completar */}
        {placeholderCount > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zry-roxo text-zry-creme rounded-zry-lg px-[22px] py-4">
            <div className="flex items-center gap-2.5 text-[13px]">
              <Hash className="w-4 h-4 text-zry-coral shrink-0" />
              <span>
                <strong className="text-zry-coral">{placeholderCount}</strong> indicação(ões) registradas apenas como número aguardam
                vínculo de empresa. O executivo pode abrir cada uma e completar o cadastro.
              </span>
            </div>
            <button
              onClick={() => setShowOnlyToComplete(v => !v)}
              className={`shrink-0 px-4 py-2 rounded-full text-[12.5px] font-bold transition border ${
                showOnlyToComplete
                  ? 'bg-zry-coral text-zry-roxo border-zry-coral hover:bg-zry-coral-dark'
                  : 'bg-transparent text-zry-creme border-zry-creme/40 hover:bg-zry-roxo-hover'
              }`}
            >
              {showOnlyToComplete ? 'Mostrar todas' : 'Ver só as pendentes de cadastro'}
            </button>
          </div>
        )}

        {/* Search + Filters */}
        <div className="bg-zry-surface border border-zry-border rounded-zry-lg px-[22px] py-[18px] space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zry-text-2" />
            <input
              type="text"
              placeholder="Buscar cliente, parceiro, empresa ou observação..."
              value={filter.searchQuery}
              onChange={(e) => onFilterChange({ ...filter, searchQuery: e.target.value })}
              className="w-full bg-zry-lilas-30 border border-transparent rounded-full pl-10 pr-4 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">

            {/* Partner Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] text-zry-text-2 font-semibold">Parceiro:</span>
              <select
                value={filter.partnerId}
                onChange={(e) => onFilterChange({ ...filter, partnerId: e.target.value })}
                className="bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[12.5px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong"
              >
                <option value="all">Todos os parceiros</option>
                {partners
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                  .map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </div>

            {/* Safra do parceiro — mês de ENTRADA de quem indicou (joinedDate) */}
            <div className="flex items-center gap-2">
              <span
                className="text-[12.5px] text-zry-text-2 font-semibold"
                title="Mês de entrada do parceiro no programa. Mostra tudo o que a turma indicou, em qualquer data."
              >
                Safra do parceiro:
              </span>
              <select
                value={partnerVintage}
                onChange={(e) => onFilterChange({ ...filter, partnerVintage: e.target.value })}
                className="bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[12.5px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong"
              >
                <option value="all">Todas as safras</option>
                {partnerVintages.months.map(k => (
                  <option key={k} value={k}>{monthLabelPt(k)}</option>
                ))}
                {partnerVintages.hasNone && <option value="none">Parceiro sem data de entrada</option>}
              </select>
            </div>

            {/* Safra da indicação — mês em que a INDICAÇÃO foi feita (referralDate) */}
            <div className="flex items-center gap-2">
              <span
                className="text-[12.5px] text-zry-text-2 font-semibold"
                title="Mês em que a indicação foi feita, de qualquer parceiro. Combina com a safra do parceiro."
              >
                Safra da indicação:
              </span>
              <select
                value={referralVintage}
                onChange={(e) => onFilterChange({ ...filter, referralVintage: e.target.value })}
                className="bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[12.5px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong"
              >
                <option value="all">Todas as safras</option>
                {referralVintages.months.map(k => (
                  <option key={k} value={k}>{monthLabelPt(k)}</option>
                ))}
                {referralVintages.hasNone && <option value="none">Indicação sem data</option>}
              </select>
            </div>

            {/* Mês de fechamento — negócios ganhos pela data de fechamento */}
            <div className="flex items-center gap-2">
              <span
                className="text-[12.5px] text-zry-text-2 font-semibold"
                title="Mostra somente negócios ganhos cuja data de fechamento está no mês selecionado."
              >
                Fechadas no mês:
              </span>
              <select
                value={closeMonth}
                onChange={(e) => onFilterChange({
                  ...filter,
                  closeMonth: e.target.value,
                  dealStatus: e.target.value === 'all' ? filter.dealStatus : 'ganho'
                })}
                className="bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[12.5px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong"
              >
                <option value="all">Todos os meses</option>
                {closeMonths.months.map(k => (
                  <option key={k} value={k}>{monthLabelPt(k)}</option>
                ))}
              </select>
            </div>

            {/* Deal Status Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] text-zry-text-2 font-semibold">Status Negócio:</span>
              <select
                value={filter.dealStatus}
                onChange={(e) => onFilterChange({ ...filter, dealStatus: e.target.value as DealStatus | 'all' })}
                className="bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[12.5px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong"
              >
                <option value="all">Todos os status</option>
                <option value="novo">Novo Lead</option>
                <option value="contato">Primeiro Contato</option>
                <option value="qualificado">Qualificado</option>
                <option value="negociacao">Em Negociação</option>
                <option value="ganho">Ganho / Fechado</option>
                <option value="perdido">Perdido</option>
              </select>
            </div>

            {/* Churn Filter (só filtra dentro dos 'ganho') */}
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] text-zry-text-2 font-semibold">Ganhos:</span>
              <select
                value={filter.churnFilter || 'all'}
                onChange={(e) => onFilterChange({ ...filter, churnFilter: e.target.value as FilterState['churnFilter'] })}
                className="bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[12.5px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong"
              >
                <option value="all">Todos</option>
                <option value="active">Só ativos</option>
                <option value="churned">Só cancelados</option>
              </select>
            </div>

            {/* Commission Status Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] text-zry-text-2 font-semibold">Comissão:</span>
              <select
                value={filter.commissionStatus}
                onChange={(e) => onFilterChange({ ...filter, commissionStatus: e.target.value as CommissionStatus | 'all' })}
                className="bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[12.5px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong"
              >
                <option value="all">Todas as comissões</option>
                <option value="a_pagar">A Pagar (Pendente)</option>
                <option value="paga">Paga (Liquidada)</option>
                <option value="pendente_fechamento">Aguardando Fechamento</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>

            {/* Toggle for Missing Data Only (Core user instruction) */}
            <label
              className={`flex items-center gap-2 cursor-pointer ml-auto px-4 py-2 rounded-full text-[12.5px] font-semibold border transition ${
                filter.onlyMissingData
                  ? 'bg-zry-warning-bg text-zry-warning border-zry-warning/40'
                  : 'bg-zry-surface text-zry-text-2 border-zry-border hover:bg-zry-lilas-30'
              }`}
            >
              <input
                type="checkbox"
                checked={filter.onlyMissingData}
                onChange={(e) => onFilterChange({ ...filter, onlyMissingData: e.target.checked })}
                className="rounded border-zry-border-strong text-zry-warning focus:ring-zry-warning"
              />
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Apenas com dados faltantes (Auditoria)</span>
            </label>

            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12.5px] font-semibold border border-zry-border-strong text-zry-roxo bg-zry-surface hover:bg-zry-lilas-30 transition"
              title="Remover todos os filtros e mostrar todas as indicações"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar filtros</span>
            </button>

          </div>
        </div>

        {/* Referrals Data Table */}
        <div className="bg-zry-surface border border-zry-border rounded-zry-lg overflow-hidden">
          <div className="px-[22px] py-[18px] border-b border-zry-border flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-[15px] font-bold text-zry-text tracking-tight">
              Registros de Indicações ({filteredList.length})
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-zry-lilas-30 text-zry-roxo">
                <strong>{filteredList.length}</strong> {filteredList.length === 1 ? 'indicação' : 'indicações'}
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-zry-info-bg text-zry-info"
                title="Soma do MRR líquido das indicações exibidas; em registros antigos sem MRR, usa o valor do negócio."
              >
                MRR: <strong>{formatCurrency(filteredMrr)}</strong>
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-zry-lilas-30 text-zry-text"
                title="Soma do Valor do Negócio das indicações exibidas pelos filtros atuais"
              >
                Valor total: <strong>{formatCurrency(filteredDealValue)}</strong>
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-zry-positive-bg text-zry-positive"
                title="Soma das comissões das indicações exibidas pelos filtros atuais"
              >
                Comissão total: <strong>{formatCurrency(filteredCommissionValue)}</strong>
              </span>
              {partnerVintage !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-lilas text-zry-roxo">
                  Parceiros que entraram em {vintageLabel(partnerVintage)}
                </span>
              )}
              {referralVintage !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-info-bg text-zry-info">
                  Indicações feitas em {vintageLabel(referralVintage)}
                </span>
              )}
              {filter.onlyMissingData && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-warning-bg text-zry-warning">
                  Filtro de auditoria ativo
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">Cliente / Empresa</th>
                  <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Parceiro Indicador</th>
                  <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Data Indicação</th>
                  <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Status Comercial</th>
                  <th className="text-right text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Valor Negócio</th>
                  <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Data Fechamento</th>
                  <th className="text-right text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Comissão</th>
                  <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Status Comissão</th>
                  <th className="text-center text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Auditoria</th>
                  <th className="text-right text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr className="border-t border-zry-border">
                    <td colSpan={10} className="py-12 text-center text-[13px] text-zry-text-2">
                      Nenhuma indicação encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredList.map((ref) => {
                    return (
                      <tr
                        key={ref.id}
                        className={`border-t border-zry-border hover:bg-zry-lilas-30/60 transition ${ref.hasMissingData ? 'bg-zry-warning-bg/40' : ''}`}
                      >
                        {/* Cliente */}
                        <td className="py-3.5 px-[22px] text-[13px]">
                          {ref.isPlaceholder && (!ref.clientName || ref.clientName.trim() === '') ? (
                            <button
                              onClick={() => onEditReferral(ref)}
                              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-zry-warning bg-zry-warning-bg border border-zry-warning/30 hover:bg-zry-warning-bg/70 rounded-full px-3 py-1.5 transition"
                              title="Indicação sem empresa — clique para completar o cadastro"
                            >
                              <Hash className="w-3 h-3" />
                              Indicação sem empresa · completar cadastro
                            </button>
                          ) : (
                            <>
                              <div className="font-semibold text-zry-text">{ref.clientName}</div>
                              {ref.clientCompany && (
                                <div className="text-[12px] text-zry-text-2 mt-0.5">{ref.clientCompany}</div>
                              )}
                              {ref.clientEmail && (
                                <div className="text-[11px] text-zry-text-2">{ref.clientEmail}</div>
                              )}
                            </>
                          )}
                        </td>

                        {/* Parceiro */}
                        <td className="py-3.5 px-3 text-[13px] text-zry-text-2">
                          {ref.partnerName}
                        </td>

                        {/* Data Indicação */}
                        <td className="py-3.5 px-3 text-[13px] text-zry-text-2">
                          {ref.referralDate ? (
                            formatDateBR(ref.referralDate)
                          ) : (
                            <span className={`${badgeBase} bg-zry-warning-bg text-zry-warning`}>
                              <AlertTriangle className="w-3 h-3" />
                              Pendente
                            </span>
                          )}
                        </td>

                        {/* Status Negócio */}
                        <td className="py-3.5 px-3 text-[13px]">
                          <div className="flex flex-col items-start gap-1">
                            {statusBadge(ref.dealStatus)}
                            {ref.dealStatus === 'perdido' && ref.lossReason && (
                              <span
                                className="max-w-[180px] text-[10.5px] leading-snug text-zry-danger"
                                title={ref.lossReason}
                              >
                                Motivo: {ref.lossReason}
                              </span>
                            )}
                            {ref.dealStatus === 'ganho' && ref.churnedAt && (
                              <span className={`${badgeBase} bg-zry-danger-bg text-zry-danger`} title={ref.churnReason || undefined}>
                                <XCircle className="w-3 h-3" /> Cancelado em {formatDateBR(ref.churnedAt)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Valor Negócio */}
                        <td className="py-3.5 px-3 text-[13px] text-right font-semibold text-zry-text">
                          {ref.dealValue !== undefined ? (
                            formatCurrency(ref.dealValue)
                          ) : ref.dealStatus === 'ganho' ? (
                            <span className={`${badgeBase} bg-zry-warning-bg text-zry-warning`}>
                              <AlertTriangle className="w-3 h-3" />
                              Não informado
                            </span>
                          ) : (
                            <span className="text-zry-text-2 font-normal">—</span>
                          )}
                        </td>

                        {/* Data Fechamento */}
                        <td className="py-3.5 px-3 text-[13px] text-zry-text-2">
                          {ref.closeDate ? (
                            formatDateBR(ref.closeDate)
                          ) : ref.dealStatus === 'ganho' ? (
                            <span className={`${badgeBase} bg-zry-warning-bg text-zry-warning`}>
                              <AlertTriangle className="w-3 h-3" />
                              Não informada
                            </span>
                          ) : (
                            <span className="text-zry-text-2">—</span>
                          )}
                        </td>

                        {/* Comissão */}
                        <td className="py-3.5 px-3 text-[13px] text-right">
                          {ref.commissionValue !== undefined ? (
                            <div>
                              <div className="font-semibold text-zry-positive">{formatCurrency(ref.commissionValue)}</div>
                              {ref.commissionPercent && (
                                <div className="text-[11px] text-zry-text-2">({ref.commissionPercent}%)</div>
                              )}
                            </div>
                          ) : ref.dealStatus === 'ganho' ? (
                            <span className={`${badgeBase} bg-zry-warning-bg text-zry-warning`}>
                              Fórmula s/ valor
                            </span>
                          ) : (
                            <span className="text-zry-text-2">—</span>
                          )}
                        </td>

                        {/* Status Comissão */}
                        <td className="py-3.5 px-3 text-[13px]">
                          {commissionBadge(ref.commissionStatus, ref.commissionValue)}
                          {ref.commissionPaidDate && (
                            <div className="text-[11px] text-zry-text-2 mt-1">
                              Pago em: {formatDateBR(ref.commissionPaidDate)}
                            </div>
                          )}
                        </td>

                        {/* Auditoria de Dados Faltantes */}
                        <td className="py-3.5 px-3 text-[13px] text-center">
                          {ref.hasMissingData && ref.missingFields && ref.missingFields.length > 0 ? (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`${badgeBase} bg-zry-warning-bg text-zry-warning`}
                                title={`Campos pendentes: ${ref.missingFields.join(', ')}`}
                              >
                                <AlertTriangle className="w-3 h-3" />
                                {ref.missingFields.length} pendência(s)
                              </span>
                              <span className="text-[10px] text-zry-warning mt-1 max-w-[120px] truncate">
                                {ref.missingFields[0]}
                              </span>
                            </div>
                          ) : (
                            <span className={`${badgeBase} bg-zry-positive-bg text-zry-positive`}>
                              <CheckCircle2 className="w-3 h-3" />
                              Completo
                            </span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-[22px] text-[13px] text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onEditReferral(ref)}
                              className={`p-2 rounded-full transition ${
                                ref.hasMissingData
                                  ? 'bg-zry-warning-bg text-zry-warning hover:bg-zry-warning-bg/70'
                                  : 'text-zry-text-2 hover:text-zry-roxo hover:bg-zry-lilas-30'
                              }`}
                              title={ref.hasMissingData ? 'Preencher dados faltantes' : 'Editar indicação'}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {deleteConfirmId === ref.id ? (
                              <div className="inline-flex items-center gap-1.5 bg-zry-danger-bg border border-zry-danger/30 rounded-full px-2.5 py-1">
                                <span className="text-[11px] text-zry-danger font-semibold">Confirmar?</span>
                                <button
                                  onClick={() => {
                                    onDeleteReferral(ref.id);
                                    setDeleteConfirmId(null);
                                  }}
                                  className="px-2 py-0.5 bg-zry-danger text-zry-creme rounded-full text-[11px] font-bold"
                                >
                                  Sim
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-1.5 py-0.5 text-zry-text-2 text-[11px] font-semibold"
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(ref.id)}
                                className="p-2 text-zry-text-2 hover:text-zry-danger hover:bg-zry-lilas-30 rounded-full transition"
                                title="Excluir indicação"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
