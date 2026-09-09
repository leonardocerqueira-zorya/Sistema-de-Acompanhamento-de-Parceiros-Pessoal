import React, { useState } from 'react';
import type { Partner, Referral } from '../types';
import { 
  calculateDataAuditMetrics, 
  evaluatePartnerMissingFields, 
  evaluateMissingFields 
} from '../services/sheetsService';
import { 
  downloadPartnerImportTemplateCSV, 
  downloadReferralImportTemplateCSV, 
  exportConsolidatedKPIsAndRankingsCSV 
} from '../utils/csvExportTemplates';
import { 
  AlertTriangle, 
  CheckCircle2, 
  FileSpreadsheet, 
  Download, 
  Users, 
  FileText, 
  Search, 
  ArrowUpRight, 
  Info,
  Layers,
  Sparkles,
  Filter
} from 'lucide-react';
import { formatDateBR, formatDocument } from '../utils/analytics';

interface DataAuditViewProps {
  partners: Partner[];
  referrals: Referral[];
  onEditPartner: (partner: Partner) => void;
  onEditReferral: (referral: Referral) => void;
  onOpenSpreadsheetImport?: () => void;
}

export default function DataAuditView({
  partners,
  referrals,
  onEditPartner,
  onEditReferral,
  onOpenSpreadsheetImport
}: DataAuditViewProps) {
  const [filterType, setFilterType] = useState<'all' | 'partners' | 'referrals'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Calculate audit metrics
  const metrics = calculateDataAuditMetrics(partners, referrals);

  // Compute pending partners and referrals
  const partnersWithMissing = partners.map(p => {
    const missing = evaluatePartnerMissingFields(p);
    return {
      partner: p,
      missing,
      hasMissing: missing.length > 0
    };
  }).filter(item => item.hasMissing);

  const referralsWithMissing = referrals.map(r => {
    const missing = evaluateMissingFields(r);
    return {
      referral: r,
      missing,
      hasMissing: missing.length > 0
    };
  }).filter(item => item.hasMissing);

  // Filtered lists based on search
  const filteredPartners = partnersWithMissing.filter(item => {
    const q = searchTerm.toLowerCase();
    const qDigits = searchTerm.replace(/\D/g, '');
    return (
      item.partner.name.toLowerCase().includes(q) ||
      (item.partner.company && item.partner.company.toLowerCase().includes(q)) ||
      (item.partner.idConexa && item.partner.idConexa.toLowerCase().includes(q)) ||
      (qDigits.length > 0 && !!item.partner.document && item.partner.document.includes(qDigits)) ||
      (item.partner.responsiblePerson && item.partner.responsiblePerson.toLowerCase().includes(q))
    );
  });

  const filteredReferrals = referralsWithMissing.filter(item => {
    const q = searchTerm.toLowerCase();
    const qDigits = searchTerm.replace(/\D/g, '');
    return (
      item.referral.clientName.toLowerCase().includes(q) ||
      item.referral.partnerName.toLowerCase().includes(q) ||
      (item.referral.idConexa && item.referral.idConexa.toLowerCase().includes(q)) ||
      (qDigits.length > 0 && !!item.referral.clientDocument && item.referral.clientDocument.includes(qDigits)) ||
      (item.referral.responsiblePerson && item.referral.responsiblePerson.toLowerCase().includes(q))
    );
  });

  const totalPendingItems = partnersWithMissing.length + referralsWithMissing.length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">Auditoria & Qualidade de Dados</h2>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Identificação de campos nulos em cadastros importados ou incompletos.
            Linhas ou colunas vazias são tratadas estritamente como <strong>nulas</strong> para evitar distorções nos indicadores de conversão e comissão.
          </p>
        </div>

        {/* Action buttons for CSV template downloads */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={downloadPartnerImportTemplateCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition border border-slate-200"
            title="Baixar modelo com cabeçalhos padrão para cadastro de parceiros"
          >
            <Download className="w-4 h-4 text-purple-600" />
            Modelo Parceiros (.csv)
          </button>

          <button
            type="button"
            onClick={downloadReferralImportTemplateCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition border border-slate-200"
            title="Baixar modelo com cabeçalhos padrão para cadastro de indicações"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Modelo Indicações (.csv)
          </button>
        </div>
      </div>

      {/* Completeness Progress Bar Card */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Índice de Preenchimento Geral dos Cadastros</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${metrics.completionPercentage >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {metrics.completionPercentage.toFixed(1)}% Completo
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {metrics.totalFieldsCompleted} de {metrics.totalFieldsAudited} campos obrigatórios e auditoriais estão preenchidos.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              <span className="text-slate-600 font-medium">Preenchidos ({metrics.completionPercentage.toFixed(1)}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
              <span className="text-slate-600 font-bold">Faltantes / Nulos ({metrics.missingPercentage.toFixed(1)}%)</span>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-4 p-0.5 border border-slate-200 overflow-hidden flex shadow-inner">
          <div 
            className="bg-emerald-500 h-full rounded-l-full transition-all duration-500 ease-out"
            style={{ width: `${metrics.completionPercentage}%` }}
          />
          <div 
            className="bg-amber-400 h-full rounded-r-full transition-all duration-500 ease-out"
            style={{ width: `${metrics.missingPercentage}%` }}
          />
        </div>

        {/* Diagnostic Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Parceiros com Pendências</span>
            <div className="text-lg font-black text-slate-900 mt-0.5 flex items-baseline gap-1">
              <span>{partnersWithMissing.length}</span>
              <span className="text-xs text-slate-400 font-normal">de {partners.length} parceiros</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Indicações com Pendências</span>
            <div className="text-lg font-black text-slate-900 mt-0.5 flex items-baseline gap-1">
              <span>{referralsWithMissing.length}</span>
              <span className="text-xs text-slate-400 font-normal">de {referrals.length} indicações</span>
            </div>
          </div>

          <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200/80">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Total de Campos Nulos</span>
            <div className="text-lg font-black text-amber-900 mt-0.5">
              {metrics.totalFieldsMissing} dados a preencher
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-2xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${filterType === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Todos com Pendência ({totalPendingItems})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('partners')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${filterType === 'partners' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Parceiros ({partnersWithMissing.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('referrals')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${filterType === 'referrals' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Indicações ({referralsWithMissing.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, ID Conexa ou responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
      </div>

      {/* Content Lists */}
      {totalPendingItems === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-10 text-center space-y-3">
          <div className="inline-flex p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-emerald-950">Base de Dados 100% Completa e Consistente!</h3>
          <p className="text-xs text-emerald-800 max-w-md mx-auto">
            Não há campos nulos ou pendências cadastrais pendentes de preenchimento. 
            Todos os indicadores de ciclo de vendas, rankings e comissões estão calculados com precisão máxima.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending Partners Section */}
          {(filterType === 'all' || filterType === 'partners') && filteredPartners.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                  <Users className="w-4 h-4" />
                </span>
                <h4 className="text-sm font-bold text-slate-900">
                  Parceiros com Dados Faltantes ({filteredPartners.length})
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">
                  Clique no parceiro para abrir o formulário com os campos destacados
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredPartners.map(({ partner, missing }) => (
                  <div
                    key={partner.id}
                    onClick={() => onEditPartner(partner)}
                    className="group bg-white p-4 rounded-2xl border border-amber-200/90 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 text-xs relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 transform translate-x-3 -translate-y-3 w-12 h-12 bg-amber-100/50 rounded-full pointer-events-none group-hover:scale-150 transition-transform duration-300" />
                    
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-900 text-sm group-hover:text-amber-700 transition flex items-center gap-1.5">
                            {partner.name}
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-amber-600" />
                          </span>
                          {partner.company && (
                            <span className="text-slate-500 font-medium block text-[11px]">
                              {partner.company}
                            </span>
                          )}
                        </div>

                        {partner.idConexa ? (
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold shrink-0">
                            {partner.idConexa}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md shrink-0">
                            Sem ID Conexa
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                        <span>CNPJ/CPF: <strong>{partner.document ? formatDocument(partner.document) : 'Pendente'}</strong></span>
                        <span>•</span>
                        <span>Perfil: <strong>{partner.profile || 'Pendente'}</strong></span>
                        <span>•</span>
                        <span>Entrada: <strong>{partner.joinedDate ? formatDateBR(partner.joinedDate) : 'Pendente'}</strong></span>
                        {partner.responsiblePerson && (
                          <>
                            <span>•</span>
                            <span>Resp: <strong>{partner.responsiblePerson}</strong></span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Missing badges */}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-1.5">
                        Campos nulos a preencher:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {missing.map((field) => (
                          <span 
                            key={field} 
                            className="bg-amber-100/90 text-amber-900 font-semibold px-2 py-0.5 rounded-md text-[10px] border border-amber-200"
                          >
                            ⚠️ {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Referrals Section */}
          {(filterType === 'all' || filterType === 'referrals') && filteredReferrals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                  <FileText className="w-4 h-4" />
                </span>
                <h4 className="text-sm font-bold text-slate-900">
                  Indicações com Dados Faltantes ({filteredReferrals.length})
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">
                  Clique na indicação para preencher os dados nulos e liberar o cálculo de comissão
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredReferrals.map(({ referral, missing }) => (
                  <div
                    key={referral.id}
                    onClick={() => onEditReferral(referral)}
                    className="group bg-white p-4 rounded-2xl border border-amber-200/90 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 text-xs relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 transform translate-x-3 -translate-y-3 w-12 h-12 bg-amber-100/50 rounded-full pointer-events-none group-hover:scale-150 transition-transform duration-300" />
                    
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-900 text-sm group-hover:text-amber-700 transition flex items-center gap-1.5">
                            {referral.clientName}
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-amber-600" />
                          </span>
                          <span className="text-slate-500 font-medium block text-[11px]">
                            Indicado por: <strong>{referral.partnerName}</strong>
                          </span>
                        </div>

                        {referral.idConexa ? (
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold shrink-0">
                            {referral.idConexa}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md shrink-0">
                            Sem ID Conexa
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                        <span>CNPJ/CPF: <strong>{referral.clientDocument ? formatDocument(referral.clientDocument) : 'Pendente'}</strong></span>
                        <span>•</span>
                        <span>Data: <strong>{referral.referralDate ? formatDateBR(referral.referralDate) : 'Pendente'}</strong></span>
                        <span>•</span>
                        <span>Status: <strong className="capitalize">{referral.dealStatus}</strong></span>
                        {referral.responsiblePerson && (
                          <>
                            <span>•</span>
                            <span>Executivo: <strong>{referral.responsiblePerson}</strong></span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Missing badges */}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-1.5">
                        Campos nulos a preencher:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {missing.map((field) => (
                          <span 
                            key={field} 
                            className="bg-amber-100/90 text-amber-900 font-semibold px-2 py-0.5 rounded-md text-[10px] border border-amber-200"
                          >
                            ⚠️ {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* If filtering returned 0 search matches */}
          {((filterType === 'partners' && filteredPartners.length === 0) ||
            (filterType === 'referrals' && filteredReferrals.length === 0) ||
            (filteredPartners.length === 0 && filteredReferrals.length === 0)) && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">
              Nenhum registro pendente encontrado para a busca "{searchTerm}".
            </div>
          )}
        </div>
      )}
    </div>
  );
}
