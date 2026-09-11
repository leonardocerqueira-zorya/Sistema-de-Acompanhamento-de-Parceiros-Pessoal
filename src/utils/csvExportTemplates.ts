import type { ChannelKPIs, PartnerRankingItem, FilterState, Partner, Referral, PartnerProfile, DealStatus, CommissionStatus } from '../types';
import { formatCurrency, formatDateBR, formatDocument } from './analytics';
import { evaluateMissingFields } from '../services/sheetsService';

// Trigger download of any text file as CSV with UTF-8 BOM
export function triggerCSVDownload(content: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Helper to escape CSV fields
function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (s.includes(';') || s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Requirement: Botão no dashboard para exportar os dados consolidados de KPIs
 * e desempenho dos parceiros em formato CSV
 */
export function exportConsolidatedKPIsAndPartnersCSV(
  kpis: ChannelKPIs,
  rankings: PartnerRankingItem[],
  filter: FilterState
): void {
  const dateNow = new Date();
  const dateStr = dateNow.toISOString().slice(0, 10);
  const timeStr = dateNow.toLocaleTimeString('pt-BR');

  const lines: string[] = [];

  // Section 1: Header / Context
  lines.push('RELATÓRIO CONSOLIDADO DE KPIS E DESEMPENHO DE PARCEIROS - ZORYA');
  lines.push(`Data de Extração;${dateStr} às ${timeStr}`);
  lines.push(`Filtro de Período;${filter.period.preset.toUpperCase()}${filter.period.selectedMonth ? ` (${filter.period.selectedMonth})` : ''}${filter.period.selectedYear ? ` (Ano ${filter.period.selectedYear})` : ''}`);
  lines.push('');

  // Section 2: Consolidated Channel KPIs
  lines.push('--- CONSOLIDADO DE KPIS DO CANAL ---');
  lines.push('Indicador;Valor Consolidado;Observação');
  const dayStat = (v: number | null): string => (v === null ? 'N/A' : `${Math.round(v)} dias`);
  const pctStat = (v: number | null): string => (v === null ? 'N/A' : `${v.toFixed(1)}%`);

  lines.push(`Taxa de Conversão do Canal (agregada);${kpis.totalReferrals > 0 ? kpis.conversionRate.toFixed(1) + '%' : '0%'};Negócios Ganhos / Total de Indicações`);
  lines.push(`Taxa de Conversão por Parceiro (média);${pctStat(kpis.conversionByPartner.mean)};Cada parceiro pesa 1, independentemente do volume que indicou`);
  lines.push(`Taxa de Conversão por Parceiro (mediana);${pctStat(kpis.conversionByPartner.median)};Conversão do parceiro típico — base: ${kpis.conversionByPartner.count} parceiro(s) com indicações`);
  lines.push(`Total de Indicações Recebidas;${kpis.totalReferrals};Total de leads encaminhados`);
  lines.push(`Negócios Fechados (Ganhos);${kpis.totalWonDeals};Contratos ativos fechados`);
  lines.push(`Contratos Vivos (base do cálculo);${kpis.activeWonDeals};Ganhos sem churn — base de rentabilidade`);
  lines.push(`Ticket Médio Recorrente (MRR);${kpis.avgTicket.toFixed(2)};MRR Ativo / Contratos Vivos`);
  lines.push(`Receita de 12 Meses por Contrato;${kpis.revenue12mPerDeal.toFixed(2)};Ticket Médio Recorrente x 12`);
  lines.push(`Custo de Aquisição por Contrato;${kpis.avgCommissionCost.toFixed(2)};Comissão total (todas as parcelas), custo único`);
  lines.push(`Payback da Comissão (meses);${kpis.paybackMonths !== null ? kpis.paybackMonths.toFixed(1) : 'N/A'};Mensalidades necessárias para cobrir a comissão`);
  lines.push(`Margem Líquida por Venda em 12m;${kpis.netChannelMargin.toFixed(2)};Receita de 12 meses (-) Custo de Aquisição`);
  lines.push(`Participação da Comissão na Receita de 12m;${kpis.commissionSharePercent.toFixed(1)}%;Take-rate do parceiro sobre 12 meses de MRR`);
  lines.push(`Retorno por R$ 1 em Comissão (12m);${kpis.revenueMultiplier > 0 ? kpis.revenueMultiplier.toFixed(2) + 'x' : 'N/A'};Receita de 12 meses por real de comissão`);
  lines.push(`Volume Líquido em 12m;${kpis.netVolume12m.toFixed(2)};MRR Ativo x 12 (-) Comissão da base viva`);
  lines.push(`Comissão Paga em Contratos Cancelados;${kpis.churnedCommissionPaid.toFixed(2)};Custo de aquisição que não retorna`);
  lines.push(`Comissão Cancelada por Churn;${kpis.churnedCommissionCancelled.toFixed(2)};Parcelas que deixaram de ser devidas`);
  lines.push(`Volume Ganho Líquido (MRR);${kpis.totalWonVolume.toFixed(2)};Receita recorrente negociada`);
  lines.push(`Volume Ganho Bruto (MRR);${kpis.grossWonVolume.toFixed(2)};Valor de tabela cheia`);
  lines.push(`Total Concedido em Descontos;${kpis.totalDiscountVolume.toFixed(2)};Economia concedida aos clientes`);
  lines.push(`Desconto Médio Concedido;${kpis.avgDiscountPercent.toFixed(1)}%;Política comercial`);
  lines.push(`Pipeline em Negociação;${kpis.pipelineVolume.toFixed(2)};Propostas e contatos em andamento`);
  lines.push(`Comissões a Pagar (Pendentes);${kpis.commissionsToPay.toFixed(2)};Aguardando liberação ou quitação`);
  lines.push(`Comissões Quitadas (Pagas);${kpis.commissionsPaid.toFixed(2)};Total já pago com comprovante`);
  lines.push(`Parceiros Ativos;${kpis.activePartnersCount};Parceiros aptos a indicar`);
  lines.push(`Taxa de Ativação do Canal;${kpis.partnerActivationRate.toFixed(1)}%;Parceiros com ao menos 1 indicação`);
  lines.push(`Ciclo Entrada -> 1ª Indicação (média);${dayStat(kpis.daysPartnerToFirstReferral.mean)};Velocidade de ativação — base: ${kpis.daysPartnerToFirstReferral.count} parceiro(s)`);
  lines.push(`Ciclo Entrada -> 1ª Indicação (mediana);${dayStat(kpis.daysPartnerToFirstReferral.median)};Metade dos parceiros ativou em até esse prazo`);
  lines.push(`Ciclo de Fechamento (média);${dayStat(kpis.daysReferralToClose.mean)};Tempo indicação até fechamento — base: ${kpis.daysReferralToClose.count} negócio(s)`);
  lines.push(`Ciclo de Fechamento (mediana);${dayStat(kpis.daysReferralToClose.median)};Metade dos negócios fechou em até esse prazo`);
  lines.push(`Registros com Pendências Cadastrais;${kpis.incompleteDataCount};Campos nulos aguardando preenchimento manual`);
  lines.push('');

  // Section 3: Detailed Partner Performance Ranking
  lines.push('--- RANKING E DESEMPENHO INDIVIDUAL DOS PARCEIROS ---');
  const partnerHeaders = [
    'Posição',
    'ID Parceiro',
    'ID Conexa',
    'CNPJ/CPF',
    'Nome do Parceiro',
    'Perfil do Parceiro',
    'Pessoa Responsável',
    'Status',
    'Data de Entrada',
    'Total Indicações',
    'Negócios Fechados',
    'Volume Ganho Líquido (R$)',
    'Comissões Geradas (R$)',
    'Taxa de Conversão (%)',
    'Ciclo 1ª Indicação (dias)'
  ];
  lines.push(partnerHeaders.join(';'));

  rankings.forEach((p, idx) => {
    const row = [
      idx + 1,
      escapeCSV(p.partnerId),
      escapeCSV(p.idConexa || 'NULO'),
      escapeCSV(p.document ? formatDocument(p.document) : 'NULO'),
      escapeCSV(p.partnerName),
      escapeCSV(p.profile || 'NULO'),
      escapeCSV(p.responsiblePerson || 'NULO'),
      escapeCSV(p.status || 'ativo'),
      escapeCSV(p.joinedDate ? formatDateBR(p.joinedDate) : 'NULO'),
      p.totalReferrals,
      p.wonReferrals,
      p.wonVolume.toFixed(2),
      p.totalCommissions.toFixed(2),
      p.conversionRate.toFixed(1) + '%',
      p.daysToFirstReferral !== null ? p.daysToFirstReferral : 'N/A'
    ];
    lines.push(row.join(';'));
  });

  const content = lines.join('\r\n');
  triggerCSVDownload(content, `zorya_kpis_desempenho_parceiros_${dateStr}.csv`);
}

/**
 * Requirement: Modelo de Planilha de Importação - Cadastro de Parceiros
 * Contendo: parceiro, data de entrada, perfil do parceiro, pessoa responsável, id do conexa
 * e quais campos mais houverem no sistema para completar o cadastro.
 * Linha ou coluna em branco não é 0 é nulo.
 */
export function downloadPartnerTemplateCSV(): void {
  const lines: string[] = [];
  
  // Header line — sem coluna de status: ele é calculado pela régua de saúde
  // (ver statusFromEngagement), então importar um valor à mão não teria efeito.
  // contrato_assinado aceita sim/não — em branco fica "não classificado" (nunca vira "não" por padrão).
  lines.push('id_conexa;nome_parceiro;cnpj_cpf;perfil_parceiro;pessoa_responsavel;data_entrada;empresa_razao_social;email;telefone;cidade;uf;contrato_assinado;observacoes');

  // Realistic sample rows
  lines.push('CX-PAR-001;Nexus Contabilidade;12.345.678/0001-90;Contabilidade;Mariana Ramos;15/01/2026;Nexus Soluções Contábeis LTDA;mariana@nexuscontabil.com.br;(11) 98765-4321;São Paulo;SP;sim;Parceiro estratégico focado em PMEs de SP');
  lines.push('CX-PAR-002;Prime RH & Benefícios;23.456.789/0001-01;BPO DP/RH;Carlos Eduardo;02/02/2026;Prime Gestão & BPO de Pessoal;carlos@primerh.com.br;(21) 99876-5432;Rio de Janeiro;RJ;sim;Atua com empresas de 50 a 300 vidas');
  lines.push('CX-PAR-003;SoftRev Distribuidora;34.567.890/0001-12;Representante de Softwares;Fernanda Lima;10/02/2026;SoftRev Tecnologia e Distribuição;fernanda@softrev.com.br;(31) 97654-3210;Belo Horizonte;MG;não;Representante comercial em MG, contrato ainda não assinado');
  lines.push('CX-PAR-004;João Alves Consultor;123.456.789-00;Consultor de Negócios;Roberto Alves;20/02/2026;João Alves Consultoria ME;roberto@vanguardab2b.com.br;(41) 98521-4789;Curitiba;PR;;Exemplo com CPF (pessoa física), contrato ainda não classificado');
  lines.push(';;;Contabilidade;;;;;;;;;Exemplo de linha com campos vazios (nulos) que o sistema sinalizará como pendência manual');

  const content = lines.join('\r\n');
  triggerCSVDownload(content, 'modelo_importacao_parceiros_zorya.csv');
}

/**
 * Requirement: Outra planilha para importação das indicações
 * Contendo: razão social, responsável, id conexa, estágio (se enviada, em negociação, fechada ou perdida tudo isso deve virar dado no dash)
 * Mesma dinâmica do parceiro para o cliente indicado.
 */
export function downloadReferralTemplateCSV(): void {
  const lines: string[] = [];
  
  // Header line
  lines.push('id_conexa;razao_social_cliente;cnpj_cpf_cliente;parceiro_indicador;pessoa_responsavel;estagio;data_indicacao;plano_zorya;recorrencia;mrr_bruto;desconto_percent;mrr_liquido;data_fechamento;dia_vencimento_fatura;valor_comissao;status_comissao;observacoes');

  // Realistic sample rows showing each stage
  // Stage 1: Fechada / Ganho
  lines.push('CX-IND-101;Varejo Brasil Supermercados;45.678.901/0001-23;Nexus Contabilidade;Leonardo Cerqueira;fechada;10/01/2026;Business (31 a 50 colab.);anual;449.90;15;382.42;20/01/2026;10;600.00;a_pagar;Contrato anual fechado com pagamento à vista');

  // Stage 2: Em Negociação
  lines.push('CX-IND-102;Logística Express Nordeste;56.789.012/0001-34;Prime RH & Benefícios;Mariana Ramos;em negociação;18/01/2026;Enterprise (51 a 100 colab.);mensal;619.90;10;557.91;;;15;800.00;pendente_fechamento;Proposta comercial apresentada aguardando diretoria');

  // Stage 3: Enviada (Novo)
  lines.push('CX-IND-103;Indústria Metalúrgica Forte;67.890.123/0001-45;SoftRev Distribuidora;Carlos Eduardo;enviada;02/02/2026;Scale (101 a 200 colab.);anual;969.90;15;824.42;;;10;1200.00;pendente_fechamento;Indicação recém-recebida, primeiro alinhamento agendado');

  // Stage 4: Perdida
  lines.push('CX-IND-104;Clínica Saúde Total;78.901.234/0001-56;João Alves Consultor;Leonardo Cerqueira;perdida;25/01/2026;Starter (01 a 14 colab.);mensal;149.90;10;134.91;;;10;300.00;cancelada;Optou por desenvolver planilha interna');

  // Example with missing/null data to be audited
  lines.push(';Restaurante Sabor Real;;Nexus Contabilidade;;enviada;15/02/2026;;mensal;;;;;;;pendente_fechamento;Exemplo com campos vazios (nulos) que cairão na auditoria de dados do dashboard');

  const content = lines.join('\r\n');
  triggerCSVDownload(content, 'modelo_importacao_indicacoes_zorya.csv');
}

// Aliases for explicit semantic imports
export const downloadPartnerImportTemplateCSV = downloadPartnerTemplateCSV;
export const downloadReferralImportTemplateCSV = downloadReferralTemplateCSV;

export function exportConsolidatedKPIsAndRankingsCSV(
  kpis: ChannelKPIs,
  rankings: PartnerRankingItem[],
  periodPreset?: string
): void {
  exportConsolidatedKPIsAndPartnersCSV(kpis, rankings, { 
    period: { preset: (periodPreset as any) || 'all' },
    partnerId: 'all',
    dealStatus: 'all',
    commissionStatus: 'all',
    onlyMissingData: false,
    searchQuery: ''
  });
}
