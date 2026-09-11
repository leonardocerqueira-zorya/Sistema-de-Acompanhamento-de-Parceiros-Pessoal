import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { Partner, Referral } from '../src/types';
import type { Dataset } from './src/data';
import { criarServidor } from './src/server';

// ---------------------------------------------------------------------------
// Teste de fumaça: sobe o servidor MCP com dados sintéticos e chama todas as
// ferramentas por um cliente real, em memória.
//
// Não toca no Supabase de propósito — o que precisa ser verificado aqui é o
// encanamento (schemas das ferramentas, chamada das funções de análise, forma
// do retorno). Erro de credencial não deve conseguir mascarar erro de código.
//
// Rodar: npm run mcp:test
// ---------------------------------------------------------------------------

function dataMesesAtras(meses: number, dia = 10): string {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  d.setDate(dia);
  return d.toISOString().slice(0, 10);
}

function parceiro(id: string, mesesAtras: number, dono: string): Partner {
  const p: Partner = {
    id,
    name: `Parceiro ${id}`,
    company: `Empresa ${id}`,
    status: 'ativo',
    joinedDate: dataMesesAtras(mesesAtras, 1),
    accountOwner: dono,
    responsiblePerson: `Contato ${id}`
  };
  return p;
}

// Tipado como Referral (sem cast) de propósito: assim um status inválido vira
// erro de compilação aqui, em vez de virar um caminho que o teste nunca exerce
// e que passa dando zero em silêncio.
function indicacao(
  id: string,
  partnerId: string,
  mesesAtras: number,
  ganho: boolean,
  mrr: number,
  churn = false
): Referral {
  const r: Referral = {
    id,
    partnerId,
    partnerName: `Parceiro ${partnerId}`,
    clientName: `Cliente ${id}`,
    referralDate: dataMesesAtras(mesesAtras, 5),
    dealStatus: ganho ? 'ganho' : 'negociacao',
    planRecurrence: 'mensal',
    mrrNet: mrr,
    dealValue: mrr,
    commissionStatus: ganho ? 'paga' : 'pendente_fechamento',
    commissionInstallments: [],
    ambassadorCommissionInstallments: []
  };
  if (ganho) {
    r.closeDate = dataMesesAtras(mesesAtras, 20);
    r.commissionValue = mrr * 0.3;
  }
  if (churn) r.churnedAt = dataMesesAtras(Math.max(0, mesesAtras - 2), 15);
  return r;
}

const datasetFalso: Dataset = {
  partners: [
    parceiro('p1', 8, 'Ana'),
    parceiro('p2', 8, 'Ana'),
    parceiro('p3', 5, 'Bruno'),
    parceiro('p4', 5, 'Bruno'),
    parceiro('p5', 2, 'Ana')
  ],
  referrals: [
    indicacao('r1', 'p1', 7, true, 500),
    indicacao('r2', 'p1', 6, true, 300),
    indicacao('r3', 'p1', 4, false, 800),
    indicacao('r4', 'p2', 6, false, 200),
    indicacao('r5', 'p3', 4, true, 900, true),
    indicacao('r6', 'p3', 3, true, 450),
    indicacao('r7', 'p4', 3, false, 600),
    indicacao('r8', 'p5', 1, true, 700)
  ],
  channelCosts: [
    { id: 'c1', period: dataMesesAtras(3).slice(0, 7), totalCost: 12000, updatedAt: new Date().toISOString() },
    { id: 'c2', period: dataMesesAtras(1).slice(0, 7), totalCost: 9000, updatedAt: new Date().toISOString() }
  ],
  newMrrEntries: [
    {
      id: 'm1',
      period: dataMesesAtras(3).slice(0, 7),
      totalNewMrr: 40000,
      totalNewDealsCount: 30,
      otherChannels: [],
      updatedAt: new Date().toISOString()
    }
  ],
  fetchedAt: new Date()
};

const CHAMADAS: Array<{ nome: string; args: Record<string, unknown> }> = [
  { nome: 'visao_geral', args: {} },
  { nome: 'kpis_do_canal', args: {} },
  { nome: 'kpis_do_canal', args: { executivo: 'Ana' } },
  { nome: 'kpis_do_canal', args: { periodo: 'anual', ano: new Date().getFullYear() } },
  { nome: 'safras_de_indicacoes', args: { meses: 9 } },
  { nome: 'safras_de_indicacoes', args: { meses: 3, incluir_evolucao_mensal: true } },
  { nome: 'safras_de_parceiros', args: {} },
  { nome: 'safras_de_parceiros', args: { janela_dias: 90, incluir_membros: true, ordenar_por: 'ativacao' } },
  { nome: 'metricas_do_periodo', args: {} },
  { nome: 'churn_mensal', args: { meses: 6 } },
  { nome: 'ranking_de_parceiros', args: { ordenar_por: 'conversion', limite: 5 } },
  { nome: 'coorte_por_tempo_de_casa', args: { limite_meses: 6 } },
  { nome: 'buscar_parceiro', args: { termo: 'p3' } },
  { nome: 'atualizar_dados', args: {} }
];

async function main(): Promise<void> {
  const server = criarServidor(async () => datasetFalso);
  const client = new Client({ name: 'smoke-test', version: '1.0.0' });
  const [aCliente, aServidor] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(aServidor), client.connect(aCliente)]);

  const { tools } = await client.listTools();
  console.log(`Ferramentas registradas: ${tools.length}`);
  for (const t of tools) console.log(`  - ${t.name}`);
  console.log('');

  let falhas = 0;
  for (const { nome, args } of CHAMADAS) {
    const rotulo = `${nome}(${JSON.stringify(args)})`;
    try {
      const r = await client.callTool({ name: nome, arguments: args });
      const texto = (r.content as Array<{ type: string; text?: string }>)
        .filter(c => c.type === 'text')
        .map(c => c.text ?? '')
        .join('');

      if (r.isError) throw new Error(texto.slice(0, 300));
      JSON.parse(texto); // o retorno tem que ser JSON válido, não texto solto
      console.log(`OK    ${rotulo} -> ${texto.length} chars`);
    } catch (err) {
      falhas++;
      console.error(`FALHA ${rotulo}\n      ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Amostra de um retorno inteiro, para conferir os números na mão.
  const amostra = await client.callTool({ name: 'kpis_do_canal', arguments: {} });
  console.log('\n--- kpis_do_canal (amostra) ---');
  console.log((amostra.content as Array<{ text?: string }>)[0]?.text);

  await client.close();
  await server.close();

  console.log(`\n${CHAMADAS.length - falhas}/${CHAMADAS.length} chamadas OK`);
  if (falhas > 0) process.exit(1);
}

main().catch(err => {
  console.error('Teste de fumaça quebrou:', err);
  process.exit(1);
});
