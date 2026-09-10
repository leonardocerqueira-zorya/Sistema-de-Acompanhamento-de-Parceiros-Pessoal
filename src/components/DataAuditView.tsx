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
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-zry-text leading-none">
            Auditoria &amp; Qualidade de Dados
          </h1>
          <p className="text-[13px] text-zry-text-2 mt-1.5">
            Campos nulos em cadastros importados ou incompletos — colunas vazias são tratadas como nulas, nunca como zero.
          </p>
        </div>

        {/* Action buttons for CSV template downloads */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={downloadPartnerImportTemplateCSV}
            className="flex items-center gap-1.5 border border-zry-border-strong text-zry-roxo font-semibold px-3.5 py-[7px] rounded-full text-[12px] hover:bg-zry-lilas-30 transition"
            title="Baixar modelo com cabeçalhos padrão para cadastro de parceiros"
          >
            <Download className="w-3.5 h-3.5" />
            Modelo Parceiros (.csv)
          </button>

          <button
            type="button"
            onClick={downloadReferralImportTemplateCSV}
            className="flex items-center gap-1.5 border border-zry-border-strong text-zry-roxo font-semibold px-3.5 py-[7px] rounded-full text-[12px] hover:bg-zry-lilas-30 transition"
            title="Baixar modelo com cabeçalhos padrão para cadastro de indicações"
          >
            <Download className="w-3.5 h-3.5" />
            Modelo Indicações (.csv)
          </button>
        </div>
      </div>

      {/* Informative rule block */}
      <div className="bg-zry-lilas-30 border border-zry-border rounded-zry-lg p-4 text-[12.5px] text-zry-text-2 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-zry-roxo shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Identificação de campos nulos em cadastros importados ou incompletos.
          Linhas ou colunas vazias são tratadas estritamente como <strong className="text-zry-text">nulas</strong> para evitar distorções nos indicadores de conversão e comissão.
        </p>
      </div>

      {/* Completeness Progress Bar Card */}
      <div className="bg-zry-surface border border-zry-border rounded-zry-lg shadow-sm">
        <div className="px-[22px] py-[18px] border-b border-zry-border flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-[15px] font-bold text-zry-text leading-none">
              Índice de Preenchimento Geral dos Cadastros
            </h3>
            <p className="text-[12.5px] text-zry-text-2 mt-1.5">
              {metrics.totalFieldsCompleted} de {metrics.totalFieldsAudited} campos obrigatórios e auditoriais estão preenchidos.
            </p>
          </div>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${metrics.completionPercentage >= 90 ? 'bg-zry-positive-bg text-zry-positive' : 'bg-zry-warning-bg text-zry-warning'}`}>
            {metrics.completionPercentage.toFixed(1)}% Completo
          </span>
        </div>

        <div className="p-[22px] space-y-4">
          {/* Visual Progress Bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-zry-lilas rounded-full h-2.5 overflow-hidden flex">
              <div
                className="bg-zry-roxo h-full transition-all duration-500 ease-out"
                style={{ width: `${metrics.completionPercentage}%` }}
              />
              <div
                className="bg-zry-coral h-full transition-all duration-500 ease-out"
                style={{ width: `${metrics.missingPercentage}%` }}
              />
            </div>
            <span className="text-[13px] font-bold text-zry-text shrink-0">
              {metrics.completionPercentage.toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center gap-5 text-[12px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-zry-roxo inline-block"></span>
              <span className="text-zry-text-2 font-medium">Preenchidos ({metrics.completionPercentage.toFixed(1)}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-zry-coral inline-block"></span>
              <span className="text-zry-text-2 font-semibold">Faltantes / Nulos ({metrics.missingPercentage.toFixed(1)}%)</span>
            </div>
          </div>

          {/* Diagnostic Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-zry-lilas-30 p-4 rounded-zry-lg border border-zry-border">
              <span className="text-[11px] font-semibold text-zry-text-2 uppercase tracking-wider block">Parceiros com Pendências</span>
              <div className="text-[22px] font-bold text-zry-text mt-1 flex items-baseline gap-1.5 leading-none">
                <span>{partnersWithMissing.length}</span>
                <span className="text-[12px] text-zry-text-2 font-medium">de {partners.length} parceiros</span>
              </div>
            </div>

            <div className="bg-zry-lilas-30 p-4 rounded-zry-lg border border-zry-border">
              <span className="text-[11px] font-semibold text-zry-text-2 uppercase tracking-wider block">Indicações com Pendências</span>
              <div className="text-[22px] font-bold text-zry-text mt-1 flex items-baseline gap-1.5 leading-none">
                <span>{referralsWithMissing.length}</span>
                <span className="text-[12px] text-zry-text-2 font-medium">de {referrals.length} indicações</span>
              </div>
            </div>

            <div className="bg-zry-warning-bg p-4 rounded-zry-lg border border-zry-warning/30">
              <span className="text-[11px] font-semibold text-zry-warning uppercase tracking-wider block">Total de Campos Nulos</span>
              <div className="text-[22px] font-bold text-zry-warning mt-1 leading-none">
                {metrics.totalFieldsMissing}
                <span className="text-[12px] font-medium ml-1.5">dados a preencher</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-full text-[12.5px] font-semibold transition ${filterType === 'all' ? 'bg-zry-roxo text-zry-creme border border-zry-roxo' : 'border border-zry-border bg-zry-surface text-zry-text-2 hover:bg-zry-lilas-30'}`}
          >
            Todos com Pendência ({totalPendingItems})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('partners')}
            className={`px-4 py-2 rounded-full text-[12.5px] font-semibold transition ${filterType === 'partners' ? 'bg-zry-roxo text-zry-creme border border-zry-roxo' : 'border border-zry-border bg-zry-surface text-zry-text-2 hover:bg-zry-lilas-30'}`}
          >
            Parceiros ({partnersWithMissing.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('referrals')}
            className={`px-4 py-2 rounded-full text-[12.5px] font-semibold transition ${filterType === 'referrals' ? 'bg-zry-roxo text-zry-creme border border-zry-roxo' : 'border border-zry-border bg-zry-surface text-zry-text-2 hover:bg-zry-lilas-30'}`}
          >
            Indicações ({referralsWithMissing.length})
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zry-text-2 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, ID Conexa ou responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zry-surface border border-zry-border rounded-full text-[12.5px] text-zry-text placeholder-zry-text-2 focus:outline-none focus:border-zry-border-strong"
          />
        </div>
      </div>

      {/* Content Lists */}
      {totalPendingItems === 0 ? (
        <div className="bg-zry-surface border border-zry-border rounded-zry-lg shadow-sm p-10 text-center space-y-3">
          <div className="inline-flex w-14 h-14 items-center justify-center bg-zry-positive-bg text-zry-positive rounded-full">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-[17px] font-bold text-zry-text">Base de Dados 100% Completa e Consistente!</h3>
          <p className="text-[12.5px] text-zry-text-2 max-w-md mx-auto leading-relaxed">
            Não há campos nulos ou pendências cadastrais pendentes de preenchimento.
            Todos os indicadores de ciclo de vendas, rankings e comissões estão calculados com precisão máxima.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending Partners Section */}
          {(filterType === 'all' || filterType === 'partners') && filteredPartners.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="w-7 h-7 rounded-full bg-zry-lilas-30 text-zry-roxo flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </span>
                <h4 className="text-[15px] font-bold text-zry-text">
                  Parceiros com Dados Faltantes ({filteredPartners.length})
                </h4>
                <span className="text-[12px] text-zry-text-2">
                  Clique no parceiro para abrir o formulário com os campos destacados
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredPartners.map(({ partner, missing }) => (
                  <div
                    key={partner.id}
                    onClick={() => onEditPartner(partner)}
                    className="group bg-zry-surface p-[18px] rounded-zry-lg border border-zry-border hover:border-zry-border-strong hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between gap-3.5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-zry-text text-[14px] flex items-center gap-1.5">
                            {partner.name}
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-zry-roxo" />
                          </span>
                          {partner.company && (
                            <span className="text-zry-text-2 font-medium block text-[12px] mt-0.5">
                              {partner.company}
                            </span>
                          )}
                        </div>

                        {partner.idConexa ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold font-mono bg-zry-lilas-30 text-zry-text-2 shrink-0">
                            {partner.idConexa}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-warning-bg text-zry-warning shrink-0">
                            Sem ID Conexa
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-zry-text-2">
                        <span>CNPJ/CPF: <strong className="text-zry-text font-semibold">{partner.document ? formatDocument(partner.document) : 'Pendente'}</strong></span>
                        <span className="text-zry-border-strong">•</span>
                        <span>Perfil: <strong className="text-zry-text font-semibold">{partner.profile || 'Pendente'}</strong></span>
                        <span className="text-zry-border-strong">•</span>
                        <span>Entrada: <strong className="text-zry-text font-semibold">{partner.joinedDate ? formatDateBR(partner.joinedDate) : 'Pendente'}</strong></span>
                        {partner.responsiblePerson && (
                          <>
                            <span className="text-zry-border-strong">•</span>
                            <span>Resp: <strong className="text-zry-text font-semibold">{partner.responsiblePerson}</strong></span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Missing badges */}
                    <div className="pt-3.5 border-t border-zry-border">
                      <span className="text-[11px] font-semibold text-zry-text-2 uppercase tracking-wider block mb-2">
                        Campos nulos a preencher:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {missing.map((field) => (
                          <span
                            key={field}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-warning-bg text-zry-warning"
                          >
                            {field}
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
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="w-7 h-7 rounded-full bg-zry-lilas-30 text-zry-roxo flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </span>
                <h4 className="text-[15px] font-bold text-zry-text">
                  Indicações com Dados Faltantes ({filteredReferrals.length})
                </h4>
                <span className="text-[12px] text-zry-text-2">
                  Clique na indicação para preencher os dados nulos e liberar o cálculo de comissão
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredReferrals.map(({ referral, missing }) => (
                  <div
                    key={referral.id}
                    onClick={() => onEditReferral(referral)}
                    className="group bg-zry-surface p-[18px] rounded-zry-lg border border-zry-border hover:border-zry-border-strong hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between gap-3.5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-zry-text text-[14px] flex items-center gap-1.5">
                            {referral.clientName}
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-zry-roxo" />
                          </span>
                          <span className="text-zry-text-2 font-medium block text-[12px] mt-0.5">
                            Indicado por: <strong className="text-zry-text font-semibold">{referral.partnerName}</strong>
                          </span>
                        </div>

                        {referral.idConexa ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold font-mono bg-zry-lilas-30 text-zry-text-2 shrink-0">
                            {referral.idConexa}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-warning-bg text-zry-warning shrink-0">
                            Sem ID Conexa
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-zry-text-2">
                        <span>CNPJ/CPF: <strong className="text-zry-text font-semibold">{referral.clientDocument ? formatDocument(referral.clientDocument) : 'Pendente'}</strong></span>
                        <span className="text-zry-border-strong">•</span>
                        <span>Data: <strong className="text-zry-text font-semibold">{referral.referralDate ? formatDateBR(referral.referralDate) : 'Pendente'}</strong></span>
                        <span className="text-zry-border-strong">•</span>
                        <span>Status: <strong className="text-zry-text font-semibold capitalize">{referral.dealStatus}</strong></span>
                        {referral.responsiblePerson && (
                          <>
                            <span className="text-zry-border-strong">•</span>
                            <span>Executivo: <strong className="text-zry-text font-semibold">{referral.responsiblePerson}</strong></span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Missing badges */}
                    <div className="pt-3.5 border-t border-zry-border">
                      <span className="text-[11px] font-semibold text-zry-text-2 uppercase tracking-wider block mb-2">
                        Campos nulos a preencher:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {missing.map((field) => (
                          <span
                            key={field}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-warning-bg text-zry-warning"
                          >
                            {field}
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
            <div className="bg-zry-lilas-30 border border-zry-border rounded-zry-lg p-6 text-center text-[12.5px] text-zry-text-2">
              Nenhum registro pendente encontrado para a busca "{searchTerm}".
            </div>
          )}
        </div>
      )}
    </div>
  );
}
