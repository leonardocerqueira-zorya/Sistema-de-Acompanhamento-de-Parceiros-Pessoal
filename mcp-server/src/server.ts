import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { DatasetCache, loadDataset, type Dataset } from './data';
import { registrarFerramentas } from './tools';

// ---------------------------------------------------------------------------
// Fábrica do servidor MCP, igual para os dois transportes.
//
// stdio.ts e http.ts diferem só em COMO a credencial chega e em como as
// mensagens trafegam. As ferramentas e o cache são os mesmos, de propósito:
// assim o que você testa na sua máquina é exatamente o que o time de tech
// publica como conector da organização.
// ---------------------------------------------------------------------------

export const TTL_PADRAO_MS = 60_000;

export const cacheCompartilhado = new DatasetCache(
  Number(process.env.MCP_CACHE_TTL_MS ?? TTL_PADRAO_MS)
);

const INSTRUCOES = [
  'Servidor de análise do Canal de Parcerias da QRPoint (parceiros, indicações, comissões e MRR).',
  '',
  'Como usar:',
  '1. Comece por visao_geral quando não souber quais meses, executivos ou parceiros existem.',
  '2. Toda métrica já vem calculada pelas mesmas funções que o dashboard usa. NÃO recalcule,',
  '   não some valores à mão e não infira número que a ferramenta não devolveu — se algo faltar,',
  '   diga que falta em vez de estimar.',
  '3. Campos `_nota` no retorno carregam a regra de negócio daquele bloco (unidade, base de',
  '   cálculo, armadilha conhecida). Leia antes de interpretar o número.',
  '4. null significa "não informado", nunca zero. Mês sem custo cadastrado não é mês de custo zero.',
  '',
  'Vocabulário: safra de INDICAÇÕES agrupa pelo mês em que a indicação foi feita; safra de',
  'PARCEIROS agrupa pelo mês de entrada do parceiro no programa. São perguntas diferentes.'
].join('\n');

export function criarServidor(getDataset: (opts?: { forcarAtualizacao?: boolean }) => Promise<Dataset>): McpServer {
  const server = new McpServer(
    { name: 'canal-de-parcerias', version: '1.0.0' },
    { instructions: INSTRUCOES }
  );
  registrarFerramentas(server, getDataset);
  return server;
}

/**
 * Liga um cliente Supabase ao cache. A chave separa credenciais diferentes: no
 * modo remoto, duas pessoas com escopos de RLS distintos não podem dividir a
 * mesma entrada de cache, ou uma veria os dados da outra.
 */
export function criarLeitor(client: SupabaseClient, chaveCache: string) {
  return async (opts?: { forcarAtualizacao?: boolean }): Promise<Dataset> => {
    if (opts?.forcarAtualizacao) cacheCompartilhado.invalidate(chaveCache);
    return cacheCompartilhado.get(chaveCache, () => loadDataset(client));
  };
}
