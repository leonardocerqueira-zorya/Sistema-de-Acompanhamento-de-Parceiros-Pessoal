import { useState } from 'react';
import type { Referral, Partner, FilterState, DealStatus, CommissionStatus } from '../types';
import { filterReferrals, formatCurrency, formatDateBR } from '../utils/analytics';
import { 
  Search, 
  Filter, 
  AlertTriangle, 
  Edit3, 
  Trash2, 
  Plus, 
  ArrowUpDown, 
  Download, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ExternalLink,
  ShieldAlert,
  Info,
  Hash
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

  const baseList = filterReferrals(referrals, filter);
  const filteredList = showOnlyToComplete ? baseList.filter(r => r.isPlaceholder) : baseList;
  const placeholderCount = referrals.filter(r => r.isPlaceholder).length;

  const statusBadge = (status: DealStatus) => {
    switch (status) {
      case 'ganho':
        return <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Ganho / Fechado</span>;
      case 'negociacao':
        return <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[11px] font-semibold px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> Em Negociação</span>;
      case 'qualificado':
        return <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">Qualificado</span>;
      case 'contato':
        return <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">Primeiro Contato</span>;
      case 'novo':
        return <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">Novo Lead</span>;
      case 'perdido':
        return <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[11px] font-semibold px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Perdido</span>;
    }
  };

  const commissionBadge = (status: CommissionStatus, value?: number) => {
    switch (status) {
      case 'paga':
        return <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">Paga</span>;
      case 'a_pagar':
        return <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">A Pagar</span>;
      case 'pendente_fechamento':
        return <span className="text-slate-400 text-[11px]">Pendente Fechamento</span>;
      case 'cancelada':
        return <span className="text-rose-500 text-[11px] line-through">Cancelada</span>;
    }
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
    <div className="space-y-4">
      
      {/* Top Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar cliente, parceiro, empresa ou observação..."
              value={filter.searchQuery}
              onChange={(e) => onFilterChange({ ...filter, searchQuery: e.target.value })}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              title="Exportar dados filtrados para CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>

            {isMaster && onOpenBulk && (
              <button
                onClick={onOpenBulk}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                title="Registrar indicações apenas como número (sem empresa) — exclusivo do acesso master"
              >
                <Hash className="w-3.5 h-3.5 text-amber-300" />
                <span>Indicações em lote (sem empresa)</span>
              </button>
            )}

            <button
              onClick={onOpenNewReferral}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Indicação</span>
            </button>
          </div>
        </div>

        {/* Banner: indicações sem empresa a completar */}
        {placeholderCount > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900 text-slate-100 rounded-xl px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-amber-300 shrink-0" />
              <span>
                <strong className="text-amber-300">{placeholderCount}</strong> indicação(ões) registradas apenas como número aguardam
                vínculo de empresa. O executivo pode abrir cada uma e completar o cadastro.
              </span>
            </div>
            <button
              onClick={() => setShowOnlyToComplete(v => !v)}
              className={`shrink-0 px-3 py-1 rounded-lg font-semibold transition border ${
                showOnlyToComplete
                  ? 'bg-amber-400 text-slate-900 border-amber-400'
                  : 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {showOnlyToComplete ? 'Mostrar todas' : 'Ver só as pendentes de cadastro'}
            </button>
          </div>
        )}

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          
          {/* Partner Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Parceiro:</span>
            <select
              value={filter.partnerId}
              onChange={(e) => onFilterChange({ ...filter, partnerId: e.target.value })}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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

          {/* Deal Status Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Status Negócio:</span>
            <select
              value={filter.dealStatus}
              onChange={(e) => onFilterChange({ ...filter, dealStatus: e.target.value as DealStatus | 'all' })}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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

          {/* Commission Status Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Comissão:</span>
            <select
              value={filter.commissionStatus}
              onChange={(e) => onFilterChange({ ...filter, commissionStatus: e.target.value as CommissionStatus | 'all' })}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">Todas as comissões</option>
              <option value="a_pagar">A Pagar (Pendente)</option>
              <option value="paga">Paga (Liquidada)</option>
              <option value="pendente_fechamento">Aguardando Fechamento</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          {/* Toggle for Missing Data Only (Core user instruction) */}
          <label className="flex items-center gap-1.5 cursor-pointer ml-auto bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-lg">
            <input
              type="checkbox"
              checked={filter.onlyMissingData}
              onChange={(e) => onFilterChange({ ...filter, onlyMissingData: e.target.checked })}
              className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-semibold">Apenas com dados faltantes (Auditoria)</span>
          </label>

        </div>
      </div>

      {/* Referrals Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Registros de Indicações ({filteredList.length})
            </h3>
            <p className="text-xs text-slate-500">
              Gerencie indicações, atualize status comerciais e preencha dados faltantes manualmente.
            </p>
          </div>
          {filter.onlyMissingData && (
            <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-md">
              Filtro de auditoria ativo
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Cliente / Empresa</th>
                <th className="py-3 px-4">Parceiro Indicador</th>
                <th className="py-3 px-4">Data Indicação</th>
                <th className="py-3 px-4">Status Comercial</th>
                <th className="py-3 px-4 text-right">Valor Negócio</th>
                <th className="py-3 px-4">Data Fechamento</th>
                <th className="py-3 px-4 text-right">Comissão</th>
                <th className="py-3 px-4">Status Comissão</th>
                <th className="py-3 px-4 text-center">Auditoria</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Nenhuma indicação encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredList.map((ref) => {
                  return (
                    <tr 
                      key={ref.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${ref.hasMissingData ? 'bg-amber-50/30' : ''}`}
                    >
                      {/* Cliente */}
                      <td className="py-3 px-4">
                        {ref.isPlaceholder && (!ref.clientName || ref.clientName.trim() === '') ? (
                          <button
                            onClick={() => onEditReferral(ref)}
                            className="inline-flex items-center gap-1.5 text-slate-700 bg-slate-100 hover:bg-amber-100 hover:text-amber-800 border border-slate-200 hover:border-amber-300 rounded-lg px-2 py-1 font-semibold transition"
                            title="Indicação sem empresa — clique para completar o cadastro"
                          >
                            <Hash className="w-3 h-3 text-amber-500" />
                            Indicação sem empresa · completar cadastro
                          </button>
                        ) : (
                          <>
                            <div className="font-semibold text-slate-900">{ref.clientName}</div>
                            {ref.clientCompany && (
                              <div className="text-[11px] text-slate-500">{ref.clientCompany}</div>
                            )}
                            {ref.clientEmail && (
                              <div className="text-[10px] text-slate-400">{ref.clientEmail}</div>
                            )}
                          </>
                        )}
                      </td>

                      {/* Parceiro */}
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {ref.partnerName}
                      </td>

                      {/* Data Indicação */}
                      <td className="py-3 px-4">
                        {ref.referralDate ? (
                          formatDateBR(ref.referralDate)
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            Pendente
                          </span>
                        )}
                      </td>

                      {/* Status Negócio */}
                      <td className="py-3 px-4">
                        {statusBadge(ref.dealStatus)}
                      </td>

                      {/* Valor Negócio */}
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {ref.dealValue !== undefined ? (
                          formatCurrency(ref.dealValue)
                        ) : ref.dealStatus === 'ganho' ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            Não informado
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Data Fechamento */}
                      <td className="py-3 px-4">
                        {ref.closeDate ? (
                          formatDateBR(ref.closeDate)
                        ) : ref.dealStatus === 'ganho' ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            Não informada
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Comissão */}
                      <td className="py-3 px-4 text-right">
                        {ref.commissionValue !== undefined ? (
                          <div>
                            <div className="font-bold text-emerald-700">{formatCurrency(ref.commissionValue)}</div>
                            {ref.commissionPercent && (
                              <div className="text-[10px] text-slate-400">({ref.commissionPercent}%)</div>
                            )}
                          </div>
                        ) : ref.dealStatus === 'ganho' ? (
                          <span className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                            Fórmula s/ valor
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status Comissão */}
                      <td className="py-3 px-4">
                        {commissionBadge(ref.commissionStatus, ref.commissionValue)}
                        {ref.commissionPaidDate && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Pago em: {formatDateBR(ref.commissionPaidDate)}
                          </div>
                        )}
                      </td>

                      {/* Auditoria de Dados Faltantes */}
                      <td className="py-3 px-4 text-center">
                        {ref.hasMissingData && ref.missingFields && ref.missingFields.length > 0 ? (
                          <div className="inline-flex flex-col items-center">
                            <span 
                              className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-semibold text-[10px]"
                              title={`Campos pendentes: ${ref.missingFields.join(', ')}`}
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              {ref.missingFields.length} pendência(s)
                            </span>
                            <span className="text-[9px] text-amber-700 mt-0.5 max-w-[120px] truncate">
                              {ref.missingFields[0]}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px] font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            Completo
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onEditReferral(ref)}
                            className={`p-1.5 rounded-lg transition ${
                              ref.hasMissingData
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 font-semibold'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                            title={ref.hasMissingData ? 'Preencher dados faltantes' : 'Editar indicação'}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {deleteConfirmId === ref.id ? (
                            <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-lg border border-rose-200">
                              <span className="text-[10px] text-rose-700 font-medium">Confirmar?</span>
                              <button
                                onClick={() => {
                                  onDeleteReferral(ref.id);
                                  setDeleteConfirmId(null);
                                }}
                                className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold"
                              >
                                Sim
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-1 py-0.5 text-slate-500 text-[10px]"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(ref.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition"
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
  );
}
