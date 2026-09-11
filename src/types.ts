import type { StatSummary } from './utils/statistics';

export type PartnerStatus = 'ativo' | 'onboarding' | 'risco' | 'inativo';

export type PartnerProfile = 
  | 'Contabilidade' 
  | 'BPO DP/RH' 
  | 'Representante de Softwares' 
  | 'Consultor de Negócios';

export interface Partner {
  id: string;
  idConexa?: string; // ID Conexa (ERP)
  document?: string; // CNPJ ou CPF do parceiro (somente dígitos armazenados internamente)
  name: string;
  profile?: PartnerProfile; // Perfil do parceiro
  tier?: string; // Tier do parceiro no programa (ex: Parceiro Zorya, Growth, Estratégico, Embaixador Zorya) — ver tiersData.ts
  ambassadorId?: string; // ID do parceiro (tier Embaixador) que trouxe este parceiro pro programa — dispara comissão de embaixador nas indicações dele
  responsiblePerson?: string; // Contato dentro do parceiro (ex: DP, contador) — NÃO é o executivo interno
  accountOwner?: string; // Executivo interno da Zorya/QRPoint dono do relacionamento (define a carteira)
  email?: string;
  phone?: string;
  company?: string;
  city?: string; // Cidade do parceiro — lista de municípios do IBGE, filtrada por state
  state?: string; // UF (ex: SP, RJ, BA)
  joinedDate?: string; // YYYY-MM-DD or missing
  status: PartnerStatus;
  hasSignedContract?: boolean; // Contrato assinado (backfill em lote: importados sem contrato ainda ficam undefined, não false)
  notes?: string;

  // Audit flags for missing data
  hasMissingData?: boolean;
  missingFields?: string[];
}

export type DealStatus = 
  | 'novo'
  | 'contato'
  | 'qualificado'
  | 'negociacao'
  | 'ganho'
  | 'perdido';

export type CommissionStatus = 
  | 'pendente_fechamento'
  | 'a_pagar'
  | 'paga'
  | 'cancelada';

export type InstallmentStatus =
  | 'a_liberar'      // Elegível para liberação conforme vencimento da mensalidade do cliente (aguarda notificar parceiro e emitir NF)
  | 'solicitada'     // Notificado / aguardando emissão da NF
  | 'agendada'       // NF anexada, com data de pagamento agendada
  | 'paga'           // Comprovante anexado, comissão quitada
  | 'cancelada';

export interface AttachedDocument {
  name: string;
  url?: string;             // Link direto para visualização imediata sem buscar na pasta
  driveFolderId?: string;    // ID da pasta Google Drive
  driveFolderName?: string;  // Nome amigável da pasta no Drive
  uploadedAt: string;        // Data do anexo
  fileData?: string;         // Base64 para download/preview local se arquivo físico foi carregado
  fileType?: string;         // 'application/pdf', 'image/png', etc.
}

export interface CommissionInstallment {
  id: string;
  referralId: string;
  partnerId: string;
  partnerName: string;
  kind?: 'parceiro' | 'embaixador'; // Quem recebe: o parceiro indicador (padrão) ou o embaixador que trouxe o parceiro
  clientName: string;
  installmentNumber: number; // 1, 2, 3
  totalInstallments: number; // 1, 2, 3
  triggerDescription: string; // "1ª mensalidade", "3ª mensalidade", "5ª mensalidade", "À vista anual", "1ª parcela anual", etc.
  value: number; // R$ valor da comissão desta parcela
  releaseDate: string; // YYYY-MM-DD (vencimento da fatura do cliente)
  status: InstallmentStatus;
  partnerNotified?: boolean;
  partnerNotifiedDate?: string;
  invoiceDoc?: AttachedDocument;
  scheduledPaymentDate?: string; // Data agendada para quitação
  receiptDoc?: AttachedDocument;
  paidDate?: string; // Data efetiva do pagamento
  paymentMethod?: string;
  notes?: string;
}

export interface Referral {
  id: string;
  idConexa?: string; // ID Conexa (Cliente / Contrato)
  partnerId: string;
  partnerName: string;
  clientName: string;
  clientDocument?: string; // CNPJ ou CPF do cliente indicado (somente dígitos armazenados internamente)
  responsiblePerson?: string; // Pessoa responsável / Executivo comercial
  clientCompany?: string;
  clientEmail?: string;
  clientPhone?: string;
  referralDate?: string; // YYYY-MM-DD or missing
  dealStatus: DealStatus;
  
  // Pricing plan & contract financial details
  planId?: string;
  planRecurrence?: 'mensal' | 'anual';
  planInstallments?: '1x' | '2x' | '3x';
  mrrGross?: number; // R$ MRR cheio de tabela
  discountPercent?: number; // % desconto (default: 10% mensal, 15% anual)
  discountValue?: number; // R$ desconto aplicado
  mrrNet?: number; // R$ MRR líquido negociado
  dealValue?: number; // R$ valor total do contrato (12x para anual, 1x mensal)
  grossDealValue?: number; // R$ valor bruto total sem desconto
  
  closeDate?: string; // YYYY-MM-DD (data de fechamento)
  invoiceDueDay?: number; // Dia de vencimento da fatura do cliente (1 a 31)
  firstInvoiceDueDate?: string; // YYYY-MM-DD da 1ª fatura

  // Churn: cliente fechou (dealStatus continua 'ganho', não reescrevemos o
  // histórico) e depois cancelou. Preenchido = parou de contar como MRR ativo.
  churnedAt?: string; // YYYY-MM-DD
  churnReason?: string;
  
  commissionPercent?: number; // % referencial se aplicável
  commissionValue?: number; // R$ comissão total fixa por plano
  commissionStatus: CommissionStatus;
  commissionPaidDate?: string; // YYYY-MM-DD (quando totalmente quitada)
  paymentMethod?: string;
  notes?: string;
  
  // Installments generated upon deal closure
  commissionInstallments?: CommissionInstallment[];

  // Comissão de embaixador: gerada quando o parceiro indicador (partnerId) tem um
  // accountOwner... na verdade um Partner.ambassadorId preenchido. Snapshot do
  // embaixador no momento da geração (não muda retroativamente se o vínculo do
  // parceiro mudar depois, para preservar o histórico).
  ambassadorId?: string;
  ambassadorName?: string;
  ambassadorCommissionStatus?: CommissionStatus;
  ambassadorCommissionInstallments?: CommissionInstallment[];

  // Indicação registrada apenas como número (sem empresa/cliente vinculado).
  // Criada em lote pelo acesso master para preservar taxa de conversão e contagem de perdidos.
  // Deve ser exibida para o executivo completar o cadastro da empresa depois.
  isPlaceholder?: boolean;

  // Audit flags for spreadsheet imported items with missing data
  hasMissingData?: boolean;
  missingFields?: string[];
}

// Acesso: login real via Supabase Auth. O papel e o executivo vêm do profile
// autenticado (ver authService.ts), não de uma escolha livre na UI.
export type UserRole = 'master' | 'executivo';

export interface AccessState {
  role: UserRole;
  executive: string | null; // Nome do executivo (Partner.accountOwner) quando role === 'executivo'
}

// Linha da tabela `profiles` no Supabase: papel e carteira de um usuário logado.
export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  executiveName: string | null;
  createdAt: string;
}

// Convite pendente (tabela `pending_invites`): criado pelo master, "reivindicado"
// (vira profiles) no primeiro login da pessoa convidada.
export interface PendingInvite {
  email: string;
  role: UserRole;
  executiveName: string | null;
  invitedBy: string | null;
  createdAt: string;
}

export type PeriodPreset =
  | 'all' 
  | 'mensal' 
  | 'trimestral' 
  | 'anual' 
  | 'custom'
  | 'today' 
  | 'last_7_days' 
  | 'last_30_days' 
  | 'this_month' 
  | 'this_quarter' 
  | 'this_year';

export interface PeriodFilter {
  preset: PeriodPreset;
  selectedMonth?: string; // e.g. "2026-03" (YYYY-MM)
  selectedQuarter?: number; // 1, 2, 3, 4
  selectedYear?: number; // e.g. 2026
  startDate?: string;
  endDate?: string;
}

export interface FilterState {
  period: PeriodFilter;
  partnerId: string;
  dealStatus: DealStatus | 'all';
  commissionStatus: CommissionStatus | 'all';
  onlyMissingData: boolean;
  searchQuery: string;
  churnFilter?: 'all' | 'active' | 'churned'; // Só se aplica a indicações 'ganho'
  // Safras. São dois recortes diferentes e combináveis:
  // partnerVintage = mês de ENTRADA do parceiro (joinedDate);
  // referralVintage = mês em que a INDICAÇÃO foi feita (referralDate).
  // 'all' ou ausente = sem filtro; 'none' = sem data para posicionar na safra.
  partnerVintage?: string;
  referralVintage?: string;
}

export type RankingSortKey = 'wonDeals' | 'referrals' | 'volume' | 'conversion' | 'speed';

export type NotificationType = 
  | 'nova_indicacao' 
  | 'mudanca_status' 
  | 'comissao_a_pagar' 
  | 'comissao_paga'
  | 'comissao_liberada_hoje'
  | 'comissao_vencendo_hoje'
  | 'corte_safra_alerta';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string; // ISO string
  read: boolean;
  referralId?: string;
  installmentId?: string;
  partnerId?: string;
  partnerName?: string;
  dealValue?: number;
  commissionValue?: number;
  emailSent?: boolean;
  emailRecipient?: string;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  emailAddress: string;
  notifyNewReferral: boolean;
  notifyStatusChange: boolean;
  notifyCommissionToPay: boolean;
}

export interface ChannelKPIs {
  totalReferrals: number;
  totalWonDeals: number;
  conversionRate: number; // percentage
  totalWonVolume: number; // R$ líquido
  grossWonVolume: number; // R$ bruto
  totalDiscountVolume: number; // R$ concedido em descontos
  avgDiscountPercent: number; // % médio de desconto concedido
  pipelineVolume: number; // R$ in progress
  commissionsToPay: number; // R$ pendente
  commissionsPaid: number; // R$ pago
  pendingCommissionCount: number;

  // Performance Consolidada & Rentabilidade do Canal.
  // Atenção à unidade: avgTicket é MRR (mensal, recorrente) e avgCommissionCost
  // é custo único de aquisição (soma das parcelas). Margem, take-rate e ROI
  // comparam a comissão contra 12 meses de MRR — nunca contra um mês só.
  // Base = contratos vivos (churn fora dos dois lados).
  avgTicket: number; // MRR médio por contrato vivo (activeWonVolume / activeWonDeals)
  avgCommissionCost: number; // Custo de aquisição médio por contrato vivo (pago + ainda devido)
  paybackMonths: number | null; // Meses de MRR para cobrir a comissão (avgCommissionCost / avgTicket)
  revenue12mPerDeal: number; // Receita de 12 meses por contrato vivo (avgTicket * 12)
  totalCommissionsWon: number; // Total histórico de comissões geradas por negócios fechados
  netChannelMargin: number; // Margem líquida por venda em 12 meses (revenue12mPerDeal - avgCommissionCost)
  commissionSharePercent: number; // % da receita de 12m consumida por comissão
  revenueMultiplier: number; // ROI 12m: receita de 12 meses por R$ 1 de comissão
  netVolume12m: number; // Volume líquido consolidado em 12 meses da base viva
  activeWonDeals: number; // Contratos ganhos ainda ativos (base de cálculo do card)
  activeCommissionCost: number; // Comissão total (paga + devida) dos contratos vivos
  activeCommissionPaid: number; // Parte de activeCommissionCost já quitada
  activeCommissionOwed: number; // Parte de activeCommissionCost ainda devida
  churnedCommissionPaid: number; // Comissão já paga em contratos que cancelaram (perda)
  churnedCommissionCancelled: number; // Parcelas que deixaram de ser devidas por churn

  // Cycle KPIs:
  avgDaysPartnerToFirstReferral: number | null; // Média tempo entrada parceiro -> indicação
  avgDaysReferralToClose: number | null; // Média tempo indicação -> fechamento

  // Os mesmos indicadores de conversão e ciclo, com a distribuição inteira,
  // para a tela alternar entre média e mediana. Ciclo é assimétrico (um lead
  // que demorou 400 dias desloca a média e não desloca a mediana), então os
  // dois números contam histórias diferentes e ambos precisam estar à mão.
  daysPartnerToFirstReferral: StatSummary; // dias entrada -> 1ª indicação, por parceiro
  daysReferralToClose: StatSummary; // dias indicação -> fechamento, por negócio ganho
  // Taxa de conversão INDIVIDUAL de cada parceiro com ao menos 1 indicação.
  // Atenção: conversionRate acima é a taxa agregada do canal (ganhos ÷ total),
  // dominada por quem mais indica. Esta é a distribuição parceiro a parceiro —
  // é dela que sai a mediana, ou seja, a conversão do parceiro típico.
  conversionByPartner: StatSummary;
  activePartnersCount: number;
  partnerActivationRate: number; // % partners that referred at least once
  incompleteDataCount: number;

  // Churn: totalWonVolume/totalWonDeals acima continuam históricos (nunca
  // encolhem retroativamente); estes refletem o estado atual.
  churnedCount: number; // Quantidade de 'ganho' com churnedAt preenchido
  churnedVolume: number; // R$ dealValue somado dos cancelados
  activeWonVolume: number; // totalWonVolume - churnedVolume ("MRR ativo" hoje)
  churnRate: number; // % churnedCount / totalWonDeals
}

export interface PartnerRankingItem {
  partnerId: string;
  idConexa?: string;
  document?: string;
  partnerName: string;
  profile?: string;
  responsiblePerson?: string;
  status?: PartnerStatus;
  joinedDate?: string;
  totalReferrals: number;
  wonReferrals: number;
  wonVolume: number;
  totalCommissions: number;
  conversionRate: number;
  daysToFirstReferral: number | null;
}

export interface DataAuditMetrics {
  totalRecords: number;
  totalFieldsAudited: number;
  totalFieldsCompleted: number;
  totalFieldsMissing: number;
  completionPercentage: number;
  missingPercentage: number;
  partnersWithMissingCount: number;
  referralsWithMissingCount: number;
}

export interface PartnerTenureCohortMetric {
  monthIndex: number; // 1, 2, 3...
  monthLabel: string; // "Mês 1", "Mês 2", etc.
  referrals: number; // Indicações já resolvidas pelo viewMode + statMode escolhidos
  closedDeals: number; // Fechamentos já resolvidos pelo viewMode + statMode escolhidos
  conversionRate: number; // Taxa de conversão % já resolvida pelo statMode escolhido
  totalReferralsRaw: number; // Total absoluto de indicações
  totalClosedRaw: number; // Total absoluto de fechadas
  activePartnersInTenure: number; // Quantidade de parceiros considerados neste mês de maturação

  // As duas leituras, sempre calculadas, para o tooltip mostrar ambas e a tela
  // alternar sem recalcular nada.
  conversionRateAggregate: number; // fechadas ÷ indicações do mês (agregada do canal)
  conversionRateMean: number | null; // média das taxas individuais dos parceiros
  conversionRateMedian: number | null; // mediana das taxas individuais dos parceiros
  partnersWithReferralsInMonth: number; // base da média/mediana de conversão
  referralsPerPartnerMean: number; // indicações por parceiro (média)
  referralsPerPartnerMedian: number; // indicações por parceiro (mediana)
  closedPerPartnerMean: number;
  closedPerPartnerMedian: number;
}

export interface MonthlyClosedBreakdown {
  monthKey: string; // '2026-01', '2026-02', etc.
  monthLabel: string; // 'Jan/26', 'Fev/26', etc.
  relativeMonthIndex: number; // 0 = mesmo mês da safra (M0), 1 = M+1, 2 = M+2, etc.
  closedCount: number;
  wonVolume: number;
}

export interface ReferralVintage {
  vintageId: string; // '2026-08'
  year: number; // 2026
  month: number; // 8 (1-indexed)
  label: string; // 'Agosto/2026'
  shortLabel: string; // 'Ago/26'
  startDate: string; // '2026-08-01'
  endDate: string; // '2026-08-31'
  cutoffDate: string; // '2026-09-15'
  cutoffLabel: string; // '15/09/2026'
  isCutoffReached: boolean; // se data atual >= cutoffDate
  daysUntilCutoff: number; // quantos dias faltam para o corte (ou negativo se já passou)
  isCutoffApproaching: boolean; // se faltam entre 0 e 7 dias para o corte
  
  // Métricas de Indicações da Safra
  totalReferrals: number; // Indicações totais recebidas entre dia 01 e último dia do mês
  pipelineReferrals: number; // Indicações ainda em negociação/abertas
  potentialMRR: number; // MRR total em negociação (pipeline)
  
  // Métricas de Fechamento no Corte (D+15 pós-mês)
  closedAtCutoff: number; // Negócios fechados até o dia 15 do mês seguinte
  conversionAtCutoff: number; // (closedAtCutoff / totalReferrals) * 100
  wonVolumeAtCutoff: number; // MRR dos fechados até o corte
  
  // Métricas Atuais (Acumulado até hoje)
  closedTotal: number; // Total de negócios fechados da safra até hoje
  conversionCurrent: number; // (closedTotal / totalReferrals) * 100
  wonVolumeTotal: number; // MRR total ganho
  
  // Conversão e ciclo da safra vistos parceiro a parceiro, para a tela poder
  // trocar média por mediana. conversionAtCutoff/conversionCurrent acima são
  // agregadas (fechadas ÷ indicações da safra) e pesam mais quem mais indicou;
  // estas distribuem por parceiro, então a mediana responde "como foi a safra
  // para o parceiro típico".
  conversionAtCutoffByPartner: StatSummary;
  conversionCurrentByPartner: StatSummary;
  /** Dias entre a indicação e o fechamento, por negócio ganho da safra. */
  daysToClose: StatSummary;

  // Desempenho Pós-Corte
  closedPostCutoff: number; // Fechadas após a data de corte (closeDate > cutoffDate)
  postCutoffGainPercent: number; // conversionCurrent - conversionAtCutoff
  hasPostCutoffSales: boolean; // closedPostCutoff > 0
  
  // Fechamentos mês a mês ao longo dos meses subsequentes (M0, M1, M2...)
  monthlyBreakdown: MonthlyClosedBreakdown[];

  // Lista de referências desta safra
  referrals: Referral[];
}

// ---------------------------------------------------------------------------
// Custos do Canal & Novo MRR (preenchimento manual, mês a mês, pelo financeiro).
// Alimenta CAC/CAP e a checagem de relevância do canal de parceiros no MRR novo
// da empresa — ver utils/channelMetrics.ts.
// ---------------------------------------------------------------------------

// Custo total do canal de parceiros num mês, informado pelo financeiro.
// NÃO é só comissão: inclui time interno, ferramentas etc. — é o número
// definitivo que o financeiro fecha para aquele mês.
export interface ChannelCostEntry {
  id: string;
  period: string; // YYYY-MM
  totalCost: number; // R$ custo total do canal no mês, segundo o financeiro
  notes?: string;
  updatedAt: string; // ISO
}

// Um canal de aquisição de MRR que não é o Canal de Parceiros (ex: Outbound,
// Inbound, Ads...), com o valor de novo MRR trazido por ele no mês.
export interface MrrChannelBreakdownItem {
  channel: string;
  value: number; // R$
}

// Novo MRR total da empresa num mês + de quais canais (exceto Parceiros) veio.
// O MRR do Canal de Parceiros é sempre a DIFERENÇA (totalNewMrr - soma dos
// outros canais) — nunca digitado diretamente, para forçar a conta a fechar.
export interface NewMrrEntry {
  id: string;
  period: string; // YYYY-MM
  totalNewMrr: number; // R$ novo MRR total da empresa no mês (todos os canais)
  totalNewDealsCount?: number; // nº total de negócios fechados na empresa no mês (todos os canais) — para o Ticket Médio Total
  otherChannels: MrrChannelBreakdownItem[]; // outros canais e seus valores
  notes?: string;
  updatedAt: string; // ISO
}

// ---------------------------------------------------------------------------
// Safra de PARCEIRO (por mês de entrada no programa).
//
// Não confundir com ReferralVintage acima, que é safra de INDICAÇÃO: aquela
// agrupa leads pela data em que foram gerados e tem corte no dia 15 do mês
// seguinte. Esta agrupa PARCEIROS pela data de entrada (joinedDate) e NÃO tem
// corte — a safra de março é simplesmente quem entrou entre 01/03 e 31/03, e
// ela continua viva e sendo medida para sempre.
//
// Serve para responder duas perguntas: quais safras mais indicaram e quais
// safras continuam saudáveis. Como safra nova teve menos tempo de vida que
// safra velha, a comparação justa usa a janela (windowDays): só conta o que
// cada parceiro produziu nos seus primeiros N dias de programa.
// ---------------------------------------------------------------------------

/** Nível de engajamento de hoje, espelhando EngagementLevel de partnerEngagement.ts. */
export interface PartnerVintageMember {
  partnerId: string;
  partnerName: string;
  joinedDate: string;
  status: PartnerStatus;
  accountOwner?: string;
  profile?: string;
  referrals: number; // indicações dentro da janela avaliada
  wonDeals: number;
  conversionRate: number | null; // null quando não indicou (não é 0%)
  wonVolume: number;
  activeWonVolume: number;
  daysToFirstReferral: number | null;
  engagementScore: number | null; // null = sem data de entrada não acontece aqui, mas o tipo respeita a régua
  engagementLevel: 'saudavel' | 'risco' | 'inativo' | 'sem-dados';
}

export interface PartnerVintage {
  vintageId: string; // '2026-03'
  year: number;
  month: number; // 1-indexed
  label: string; // 'Março/2026'
  shortLabel: string; // 'Mar/26'
  startDate: string; // '2026-03-01'
  endDate: string; // '2026-03-31'
  /** Idade da safra em meses corridos (1 = safra do mês corrente). */
  monthsSinceEntry: number;
  /** A safra é jovem demais para preencher a janela escolhida? */
  isWindowIncomplete: boolean;

  partnerCount: number;

  // Ativação: quem da safra saiu do zero
  partnersWithReferral: number;
  activationRate: number; // % da safra que indicou ao menos uma vez
  daysToFirstReferral: StatSummary; // média e mediana do ciclo de ativação da safra

  // Produção de indicações
  totalReferrals: number;
  referralsPerPartner: StatSummary; // inclui quem indicou zero — é a produção real da safra

  // Conversão
  wonDeals: number;
  conversionRate: number; // agregada da safra: ganhos ÷ indicações
  conversionByPartner: StatSummary; // distribuição individual (só quem indicou)

  // Receita gerada pela safra
  wonVolume: number;
  activeWonVolume: number;
  churnedVolume: number;

  // Saúde de HOJE (engajamento não respeita a janela: é estado atual)
  healthyCount: number;
  riskCount: number;
  inactiveCount: number;
  onboardingCount: number;
  healthRate: number; // % saudáveis entre os que têm score
  engagement: StatSummary; // média e mediana do score de engajamento da safra

  members: PartnerVintageMember[];
}

export interface PartnerVintageReport {
  vintages: PartnerVintage[];
  /** null = sem janela, conta a vida inteira de cada parceiro. */
  windowDays: number | null;
  /** Parceiros sem joinedDate ficam fora de qualquer safra — precisa aparecer. */
  partnersWithoutJoinedDate: number;
  totalPartnersInVintages: number;
}

export type PartnerVintageWindow = 30 | 60 | 90 | 180 | null;
