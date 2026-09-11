import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { RankingSortKey } from '../../src/types';
import { calculateKPIs, calculatePartnerRankings, calculatePartnerTenureCohortMetrics } from '../../src/utils/analytics';
import { calculateMonthlyChurn } from '../../src/utils/churnAnalytics';
import { calculateChannelPeriodMetrics } from '../../src/utils/channelMetrics';
import { calculatePartnerVintages, rankPartnerVintages } from '../../src/utils/partnerVintageAnalytics';
import { calculateReferralVintages } from '../../src/utils/vintageAnalytics';

import type { Dataset } from './data';
import { n1, n2, stat } from './format';
import { aplicarRecorte } from './scope';

// ---------------------------------------------------------------------------
// Ferramentas do agente.
//
// Regra que vale para o arquivo inteiro: NENHUM número é calculado aqui. Cada
// ferramenta chama a mesma função que a tela do app chama e só reembala o
// resultado. É isso que garante que o agente e o dashboard nunca discordem —
// e que mudar uma regra de negócio (comissão, régua de engajamento, janela de
// inativação) continue sendo uma mudança em um lugar só.
//
// As listas pesadas (ReferralVintage.referrals, PartnerVintage.members) ficam
// de fora por padrão: elas existem para a tela desenhar o drill-down e aqui só
// gastariam contexto — além de convidar o modelo a recontar à mão o que a
// função já contou.
// ---------------------------------------------------------------------------

type GetDataset = (opts?: { forcarAtualizacao?: boolean }) => Promise<Dataset>;

const PERIOD_PRESETS = [
  'all', 'mensal', 'trimestral', 'anual', 'custom',
  'today', 'last_7_days', 'last_30_days', 'this_month', 'this_quarter', 'this_year'
] as const;

const escopoSchema = {
  periodo: z.enum(PERIOD_PRESETS).optional()
    .describe("Recorte de tempo pela data da INDICAÇÃO. Padrão: 'all' (histórico inteiro)."),
  mes: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("Mês YYYY-MM. Use com periodo='mensal'."),
  trimestre: z.number().int().min(1).max(4).optional().describe("Trimestre 1-4. Use com periodo='trimestral'."),
  ano: z.number().int().min(2000).max(2100).optional().describe("Ano. Use com periodo='trimestral' ou 'anual'."),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial. Use com periodo='custom'."),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final. Use com periodo='custom'."),
  parceiro_id: z.string().optional().describe('Restringe a um parceiro. Use buscar_parceiro para achar o id.'),
  executivo: z.string().optional().describe('Restringe à carteira de um executivo (campo accountOwner).')
};

function texto(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}

export function registrarFerramentas(server: McpServer, getDataset: GetDataset): void {
  // -------------------------------------------------------------------------
  server.registerTool(
    'visao_geral',
    {
      title: 'Visão geral da base',
      description:
        'Ponto de partida. Diz quantos parceiros e indicações existem, qual intervalo de datas a base cobre, ' +
        'quais meses têm custo do canal e MRR novo informados, e quem são os executivos. ' +
        'Chame esta ferramenta primeiro quando não souber quais períodos ou nomes usar nas outras.',
      inputSchema: {}
    },
    async () => {
      const d = await getDataset();
      const datasInd = (d.referrals.map(r => r.referralDate).filter(Boolean) as string[]).sort();
      const datasFech = (d.referrals.map(r => r.closeDate).filter(Boolean) as string[]).sort();

      const porStatus: Record<string, number> = {};
      for (const r of d.referrals) porStatus[r.dealStatus] = (porStatus[r.dealStatus] ?? 0) + 1;

      const porStatusParceiro: Record<string, number> = {};
      for (const p of d.partners) porStatusParceiro[p.status] = (porStatusParceiro[p.status] ?? 0) + 1;

      return texto({
        lido_em: d.fetchedAt.toISOString(),
        parceiros: {
          total: d.partners.length,
          por_status: porStatusParceiro,
          sem_data_de_entrada: d.partners.filter(p => !p.joinedDate).length,
          executivos: [...new Set(d.partners.map(p => p.accountOwner).filter(Boolean))].sort()
        },
        indicacoes: {
          total: d.referrals.length,
          por_status: porStatus,
          canceladas: d.referrals.filter(r => r.churnedAt).length,
          primeira_indicacao: datasInd[0] ?? null,
          ultima_indicacao: datasInd[datasInd.length - 1] ?? null,
          primeiro_fechamento: datasFech[0] ?? null,
          ultimo_fechamento: datasFech[datasFech.length - 1] ?? null
        },
        meses_com_custo_informado: d.channelCosts.map(c => c.period).sort(),
        meses_com_mrr_novo_informado: d.newMrrEntries.map(m => m.period).sort()
      });
    }
  );

  // -------------------------------------------------------------------------
  server.registerTool(
    'kpis_do_canal',
    {
      title: 'KPIs e rentabilidade do canal',
      description:
        'Indicadores consolidados: conversão, volume ganho, pipeline, comissões, ciclo e RENTABILIDADE ' +
        '(payback, margem e ROI 12m). É a ferramenta para "qual o ROI", "qual a taxa de conversão", ' +
        '"quanto o canal gerou". Aceita recorte por período, parceiro e executivo.',
      inputSchema: escopoSchema
    },
    async args => {
      const d = await getDataset();
      const { partners, referrals, descricao } = aplicarRecorte(d, args);
      const k = calculateKPIs(referrals, partners);

      return texto({
        recorte: descricao,
        base: { indicacoes: k.totalReferrals, parceiros: partners.length },

        conversao: {
          negocios_ganhos: k.totalWonDeals,
          taxa_agregada_percent: n1(k.conversionRate),
          taxa_por_parceiro: stat(k.conversionByPartner),
          _nota: 'taxa_agregada é ganhos ÷ indicações do canal inteiro (pesa mais quem mais indica). ' +
                 'taxa_por_parceiro distribui parceiro a parceiro — a mediana é a conversão do parceiro típico.'
        },

        volume: {
          mrr_ganho_historico: n2(k.totalWonVolume),
          mrr_ativo_hoje: n2(k.activeWonVolume),
          mrr_cancelado: n2(k.churnedVolume),
          pipeline_em_negociacao: n2(k.pipelineVolume),
          desconto_concedido: n2(k.totalDiscountVolume),
          desconto_medio_percent: n1(k.avgDiscountPercent)
        },

        rentabilidade: {
          ticket_medio_mrr_mensal: n2(k.avgTicket),
          custo_de_aquisicao_medio: n2(k.avgCommissionCost),
          payback_meses: n1(k.paybackMonths),
          receita_12m_por_contrato: n2(k.revenue12mPerDeal),
          margem_liquida_12m: n2(k.netChannelMargin),
          comissao_sobre_receita_12m_percent: n1(k.commissionSharePercent),
          roi_12m: n2(k.revenueMultiplier),
          volume_liquido_12m: n2(k.netVolume12m),
          contratos_vivos: k.activeWonDeals,
          comissao_dos_contratos_vivos: n2(k.activeCommissionCost),
          _nota: 'UNIDADES DIFERENTES: ticket é MRR mensal recorrente, custo de aquisição é gasto ÚNICO. ' +
                 'Por isso ROI e margem comparam a comissão contra 12 MESES de MRR, nunca contra um mês. ' +
                 'roi_12m = reais de receita em 12 meses por R$ 1 de comissão. Base: só contratos vivos.'
        },

        comissoes: {
          a_pagar: n2(k.commissionsToPay),
          pagas: n2(k.commissionsPaid),
          parcelas_pendentes: k.pendingCommissionCount,
          total_gerado_historico: n2(k.totalCommissionsWon),
          pagas_em_contratos_cancelados: n2(k.churnedCommissionPaid),
          canceladas_por_churn: n2(k.churnedCommissionCancelled)
        },

        churn: {
          contratos_cancelados: k.churnedCount,
          taxa_percent: n1(k.churnRate),
          volume_perdido: n2(k.churnedVolume)
        },

        ciclo: {
          dias_entrada_ate_1a_indicacao: stat(k.daysPartnerToFirstReferral),
          dias_indicacao_ate_fechamento: stat(k.daysReferralToClose),
          _nota: 'Ciclo é assimétrico: prefira a mediana para descrever o caso típico.'
        },

        ativacao: {
          parceiros_que_indicaram: k.activePartnersCount,
          taxa_de_ativacao_percent: n1(k.partnerActivationRate),
          cadastros_incompletos: k.incompleteDataCount
        }
      });
    }
  );

  // -------------------------------------------------------------------------
  server.registerTool(
    'safras_de_indicacoes',
    {
      title: 'Safras (vintages) de indicações',
      description:
        'Agrupa indicações pelo MÊS EM QUE FORAM FEITAS e acompanha quanto cada safra converteu — ' +
        'no corte D+15 do mês seguinte e acumulado até hoje. Responde "a safra de março converteu melhor ' +
        'que a de abril?" e "quanto ainda fecha depois do corte?". Para safras de PARCEIROS (por mês de ' +
        'entrada do parceiro), use safras_de_parceiros.',
      inputSchema: {
        meses: z.number().int().min(1).max(36).optional()
          .describe('Quantas safras mensais, contando para trás a partir do mês atual. Padrão: 12.'),
        incluir_evolucao_mensal: z.boolean().optional()
          .describe('Inclui o fechamento mês a mês (M0, M1, M2...) de cada safra. Padrão: false.')
      }
    },
    async ({ meses, incluir_evolucao_mensal }) => {
      const d = await getDataset();
      const vintages = calculateReferralVintages(d.referrals, new Date(), meses ?? 12);

      return texto({
        safras: vintages.map(v => ({
          safra: v.vintageId,
          rotulo: v.label,
          corte: v.cutoffLabel,
          corte_atingido: v.isCutoffReached,
          indicacoes: v.totalReferrals,
          em_negociacao: v.pipelineReferrals,
          mrr_potencial_pipeline: n2(v.potentialMRR),
          fechadas_ate_o_corte: v.closedAtCutoff,
          conversao_no_corte_percent: n1(v.conversionAtCutoff),
          mrr_ganho_ate_o_corte: n2(v.wonVolumeAtCutoff),
          fechadas_ate_hoje: v.closedTotal,
          conversao_atual_percent: n1(v.conversionCurrent),
          mrr_ganho_total: n2(v.wonVolumeTotal),
          fechadas_apos_o_corte: v.closedPostCutoff,
          ganho_pos_corte_pp: n1(v.postCutoffGainPercent),
          conversao_no_corte_por_parceiro: stat(v.conversionAtCutoffByPartner),
          conversao_atual_por_parceiro: stat(v.conversionCurrentByPartner),
          dias_ate_fechar: stat(v.daysToClose),
          ...(incluir_evolucao_mensal
            ? {
                evolucao_mensal: v.monthlyBreakdown.map(m => ({
                  mes: m.monthLabel,
                  m: m.relativeMonthIndex,
                  fechadas: m.closedCount,
                  mrr: n2(m.wonVolume)
                }))
              }
            : {})
        })),
        _nota: 'Safra jovem ainda não teve tempo de converter: compare safras de idades parecidas, ou use ' +
               'conversao_no_corte_percent, que mede todas na mesma régua (D+15 após o fim do mês).'
      });
    }
  );

  // -------------------------------------------------------------------------
  server.registerTool(
    'safras_de_parceiros',
    {
      title: 'Safras (vintages) de parceiros',
      description:
        'Agrupa parceiros pelo MÊS DE ENTRADA no programa e compara o desempenho de cada turma: ativação, ' +
        'produção de indicações, conversão, receita e saúde atual. Responde "qual safra de parceiros rendeu ' +
        'mais" e "os parceiros que entraram em março ativaram mais rápido?". A janela permite comparar todas ' +
        'as safras pelos primeiros N dias de programa — sem isso, safra antiga sempre parece melhor só por ' +
        'ter tido mais tempo.',
      inputSchema: {
        janela_dias: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(180)]).nullable().optional()
          .describe('Compara só os primeiros N dias de cada parceiro no programa. null = vida inteira. Padrão: null.'),
        incluir_membros: z.boolean().optional().describe('Lista os parceiros de cada safra, um a um. Padrão: false.'),
        ordenar_por: z.enum(['conversao', 'ativacao', 'receita', 'indicacoes', 'saude']).optional()
          .describe('Por qual métrica apontar a melhor e a pior safra. Padrão: conversao.')
      }
    },
    async ({ janela_dias, incluir_membros, ordenar_por }) => {
      const d = await getDataset();
      const report = calculatePartnerVintages(d.partners, d.referrals, { windowDays: janela_dias ?? null });

      type Safra = (typeof report.vintages)[number];
      const metricas: Record<string, (v: Safra) => number | null> = {
        conversao: v => v.conversionRate,
        ativacao: v => v.activationRate,
        receita: v => v.activeWonVolume,
        indicacoes: v => v.totalReferrals,
        saude: v => v.healthRate
      };
      const chave = ordenar_por ?? 'conversao';
      const { best, worst } = rankPartnerVintages(report.vintages, metricas[chave]);

      return texto({
        janela_dias: report.windowDays,
        parceiros_nas_safras: report.totalPartnersInVintages,
        parceiros_sem_data_de_entrada: report.partnersWithoutJoinedDate,
        ranking: {
          metrica: chave,
          melhor_safra: best?.vintageId ?? null,
          pior_safra: worst?.vintageId ?? null,
          _nota: 'Só entram safras com pelo menos 2 parceiros — com 1 só, a safra é um parceiro, não uma turma.'
        },
        safras: report.vintages.map(v => ({
          safra: v.vintageId,
          rotulo: v.label,
          idade_meses: v.monthsSinceEntry,
          janela_incompleta: v.isWindowIncomplete,
          parceiros: v.partnerCount,
          ativaram: v.partnersWithReferral,
          taxa_de_ativacao_percent: n1(v.activationRate),
          dias_ate_1a_indicacao: stat(v.daysToFirstReferral),
          indicacoes: v.totalReferrals,
          indicacoes_por_parceiro: stat(v.referralsPerPartner),
          negocios_ganhos: v.wonDeals,
          conversao_percent: n1(v.conversionRate),
          conversao_por_parceiro: stat(v.conversionByPartner),
          mrr_ganho: n2(v.wonVolume),
          mrr_ativo: n2(v.activeWonVolume),
          mrr_cancelado: n2(v.churnedVolume),
          saudaveis: v.healthyCount,
          em_risco: v.riskCount,
          inativos: v.inactiveCount,
          em_onboarding: v.onboardingCount,
          taxa_de_saude_percent: n1(v.healthRate),
          engajamento: stat(v.engagement),
          ...(incluir_membros
            ? {
                membros: v.members.map(m => ({
                  id: m.partnerId,
                  nome: m.partnerName,
                  entrada: m.joinedDate,
                  status: m.status,
                  executivo: m.accountOwner,
                  indicacoes: m.referrals,
                  ganhos: m.wonDeals,
                  conversao_percent: n1(m.conversionRate),
                  mrr_ativo: n2(m.activeWonVolume),
                  dias_ate_1a_indicacao: m.daysToFirstReferral,
                  engajamento: n1(m.engagementScore),
                  nivel: m.engagementLevel
                }))
              }
            : {})
        })),
        _nota: 'janela_incompleta = a safra é jovem demais para ter preenchido a janela escolhida; os números ' +
               'dela ainda vão subir e não são comparáveis com os das safras maduras. A saúde ' +
               '(saudaveis/em_risco/inativos) é sempre o estado de HOJE, não o da janela.'
      });
    }
  );

  // -------------------------------------------------------------------------
  server.registerTool(
    'metricas_do_periodo',
    {
      title: 'CAC, CAP e relevância do canal por mês',
      description:
        'Cruza o custo do canal informado pelo financeiro com o que fechou em cada mês: CAC por cliente, ' +
        'CAC por real de MRR, CAP (custo por parceiro ativo), ticket médio do canal contra o da empresa e ' +
        'quanto o canal representou do MRR novo total. É a ferramenta para "qual investimento rendeu mais" ' +
        'mês a mês. Só funciona para meses com custo informado — veja visao_geral.',
      inputSchema: {
        periodos: z.array(z.string().regex(/^\d{4}-\d{2}$/)).optional()
          .describe('Meses YYYY-MM. Se omitido, usa todos os meses que têm custo ou MRR novo informado.')
      }
    },
    async ({ periodos }) => {
      const d = await getDataset();
      const alvo = periodos?.length
        ? periodos
        : [...new Set([...d.channelCosts.map(c => c.period), ...d.newMrrEntries.map(m => m.period)])].sort();

      return texto({
        meses: alvo.map(p => {
          const m = calculateChannelPeriodMetrics(p, d.referrals, d.channelCosts, d.newMrrEntries);
          return {
            mes: m.period,
            custo_do_canal: n2(m.cost),
            negocios_fechados: m.closedDealsCount,
            parceiros_ativos: m.activePartnersCount,
            mrr_novo_do_canal: n2(m.channelMrrFromReferrals),
            cac_por_cliente: n2(m.cacPorCliente),
            cac_por_real_de_mrr: n2(m.cacPorMrr),
            cap_custo_por_parceiro_ativo: n2(m.cap),
            mrr_novo_da_empresa: n2(m.companyTotalNewMrr),
            relevancia_do_canal_percent: n1(m.channelRelevancePercent),
            ticket_medio_canal: n2(m.ticketMedioCanal),
            ticket_medio_empresa: n2(m.ticketMedioTotal),
            diferenca_de_ticket_percent: n1(m.ticketMedioComparisonPercent),
            conferencia_mrr: m.discrepancy
          };
        }),
        _nota: 'custo_do_canal é o total fechado pelo financeiro (time, ferramentas, comissão) — não é só ' +
               'comissão. CAC compara esse custo único contra MRR mensal: para retorno, use payback_meses ' +
               'ou roi_12m em kpis_do_canal. Mês sem custo informado devolve null, e null não é zero.'
      });
    }
  );

  // -------------------------------------------------------------------------
  server.registerTool(
    'churn_mensal',
    {
      title: 'Cancelamentos mês a mês',
      description: 'Contratos cancelados por mês de cancelamento (churnedAt) e o MRR perdido em cada um.',
      inputSchema: {
        meses: z.number().int().min(1).max(36).optional().describe('Quantos meses para trás. Padrão: 12.')
      }
    },
    async ({ meses }) => {
      const d = await getDataset();
      const churn = calculateMonthlyChurn(d.referrals, new Date(), meses ?? 12);
      return texto({
        meses: churn.map(m => ({
          mes: m.monthKey,
          rotulo: m.monthLabel,
          cancelados: m.churnedCount,
          mrr_perdido: n2(m.churnedVolume)
        }))
      });
    }
  );

  // -------------------------------------------------------------------------
  server.registerTool(
    'ranking_de_parceiros',
    {
      title: 'Ranking de parceiros',
      description: 'Ordena parceiros por negócios ganhos, indicações, volume, conversão ou velocidade de fechamento.',
      inputSchema: {
        ordenar_por: z.enum(['wonDeals', 'referrals', 'volume', 'conversion', 'speed']).optional()
          .describe('Padrão: wonDeals.'),
        limite: z.number().int().min(1).max(200).optional().describe('Quantos parceiros devolver. Padrão: 20.'),
        executivo: z.string().optional().describe('Restringe à carteira de um executivo.'),
        incluir_sem_indicacao: z.boolean().optional()
          .describe('Inclui parceiros que nunca indicaram. Padrão: false.')
      }
    },
    async ({ ordenar_por, limite, executivo, incluir_sem_indicacao }) => {
      const d = await getDataset();
      const { partners, referrals } = aplicarRecorte(d, { executivo });
      const ranking = calculatePartnerRankings(referrals, partners, (ordenar_por ?? 'wonDeals') as RankingSortKey);
      const visivel = incluir_sem_indicacao ? ranking : ranking.filter(r => r.totalReferrals > 0);

      return texto({
        ordenado_por: ordenar_por ?? 'wonDeals',
        parceiros_no_recorte: ranking.length,
        parceiros_que_indicaram: ranking.filter(r => r.totalReferrals > 0).length,
        parceiros: visivel.slice(0, limite ?? 20).map(r => ({
          id: r.partnerId,
          nome: r.partnerName,
          perfil: r.profile,
          status: r.status,
          entrada: r.joinedDate,
          indicacoes: r.totalReferrals,
          ganhos: r.wonReferrals,
          conversao_percent: n1(r.conversionRate),
          mrr_ganho: n2(r.wonVolume),
          comissoes_geradas: n2(r.totalCommissions),
          dias_ate_1a_indicacao: r.daysToFirstReferral
        }))
      });
    }
  );

  // -------------------------------------------------------------------------
  server.registerTool(
    'coorte_por_tempo_de_casa',
    {
      title: 'Coorte por tempo de casa',
      description:
        'Alinha todos os parceiros pelo mês 1 de programa (não pelo calendário) e mostra a curva: quantas ' +
        'indicações e quanta conversão no mês 1, 2, 3... Responde "quando o parceiro típico começa a ' +
        'produzir" e "a produção cai depois de quantos meses?".',
      inputSchema: {
        parceiro_id: z.string().optional().describe('Compara um parceiro específico contra a curva geral.'),
        modo: z.enum(['average', 'total']).optional().describe('Padrão: average.'),
        limite_meses: z.number().int().min(1).max(60).optional().describe('Até que mês de casa ir. Padrão: 12.'),
        estatistica: z.enum(['media', 'mediana']).optional().describe('Padrão: media.')
      }
    },
    async ({ parceiro_id, modo, limite_meses, estatistica }) => {
      const d = await getDataset();
      const r = calculatePartnerTenureCohortMetrics(d.referrals, d.partners, {
        selectedPartnerId: parceiro_id,
        viewMode: modo ?? 'average',
        limitMonths: limite_meses ?? 12,
        statMode: estatistica ?? 'media'
      });
      return texto(r);
    }
  );

  // -------------------------------------------------------------------------
  server.registerTool(
    'buscar_parceiro',
    {
      title: 'Buscar parceiro',
      description:
        'Acha parceiros por nome, empresa, documento, e-mail ou executivo, e devolve o id para usar nas ' +
        'outras ferramentas.',
      inputSchema: {
        termo: z.string().min(1).describe('Parte do nome, empresa, CNPJ/CPF, e-mail ou nome do executivo.'),
        limite: z.number().int().min(1).max(50).optional().describe('Padrão: 10.')
      }
    },
    async ({ termo, limite }) => {
      const d = await getDataset();
      const q = termo.trim().toLowerCase();
      const achados = d.partners.filter(p =>
        [p.name, p.company, p.document, p.email, p.accountOwner, p.responsiblePerson, p.idConexa]
          .some(campo => (campo ?? '').toLowerCase().includes(q))
      );

      const indicacoesPorParceiro = new Map<string, number>();
      for (const r of d.referrals) {
        indicacoesPorParceiro.set(r.partnerId, (indicacoesPorParceiro.get(r.partnerId) ?? 0) + 1);
      }

      return texto({
        encontrados: achados.length,
        parceiros: achados.slice(0, limite ?? 10).map(p => ({
          id: p.id,
          nome: p.name,
          empresa: p.company,
          perfil: p.profile,
          tier: p.tier,
          status: p.status,
          entrada: p.joinedDate,
          executivo: p.accountOwner,
          contato_no_parceiro: p.responsiblePerson,
          indicacoes: indicacoesPorParceiro.get(p.id) ?? 0
        })),
        _nota: 'contato_no_parceiro (responsiblePerson) é a pessoa DENTRO do parceiro. O executivo interno ' +
               'da QRPoint é o campo executivo (accountOwner) — não confunda os dois.'
      });
    }
  );

  // -------------------------------------------------------------------------
  server.registerTool(
    'atualizar_dados',
    {
      title: 'Reler o banco agora',
      description:
        'Descarta o cache e relê as tabelas do Supabase. Use quando alguém acabou de mexer nos dados e ' +
        'você precisa do estado mais recente.',
      inputSchema: {}
    },
    async () => {
      const d = await getDataset({ forcarAtualizacao: true });
      return texto({
        lido_em: d.fetchedAt.toISOString(),
        parceiros: d.partners.length,
        indicacoes: d.referrals.length
      });
    }
  );
}
