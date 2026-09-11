import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { rowToCost, rowToMrr, rowToPartner, rowToReferral, type Row } from '../../src/services/rowMappers';
import type { ChannelCostEntry, NewMrrEntry, Partner, Referral } from '../../src/types';

// ---------------------------------------------------------------------------
// Leitura das tabelas do Supabase em Node.
//
// Usa os MESMOS mappers do app (src/services/rowMappers.ts). Isso é o ponto:
// quando uma coluna nova entra no schema, ela aparece aqui sozinha, em vez de
// exigir que alguém lembre de atualizar uma segunda cópia do mapeamento.
//
// Dois modos de credencial:
//   * service role  -> lê tudo, ignora a RLS. É o modo local (você é master).
//   * token de usuário -> a RLS do banco decide o que a pessoa vê. É o modo
//     remoto: master enxerga tudo, executivo só a carteira dele, sem que este
//     servidor precise reimplementar o recorte.
// ---------------------------------------------------------------------------

const PAGE_SIZE = 1000;

export interface Dataset {
  partners: Partner[];
  referrals: Referral[];
  channelCosts: ChannelCostEntry[];
  newMrrEntries: NewMrrEntry[];
  fetchedAt: Date;
}

/**
 * Aceita tanto SUPABASE_URL quanto VITE_SUPABASE_URL: o .env do projeto já tem
 * as variáveis com o prefixo do Vite, e obrigar a duplicá-las só criaria duas
 * fontes da mesma verdade para alguém esquecer de atualizar depois.
 */
export function requireEnv(name: string): string {
  const value = process.env[name] || process.env[`VITE_${name}`];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} (ou VITE_${name}) não definida. ` +
      'Copie mcp-server/.env.example para mcp-server/.env e preencha.'
    );
  }
  return value;
}

/** Credencial de service role: acesso total, sem RLS. Só para uso local. */
export function createServiceClient(): SupabaseClient {
  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Credencial do usuário final: a RLS do banco aplica o escopo por carteira. */
export function createUserClient(accessToken: string): SupabaseClient {
  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

// O Supabase devolve no máximo 1000 linhas por request; sem paginar, uma base
// que cresce passa a ser truncada em silêncio — e a análise fica errada sem
// nenhum erro aparecer.
async function fetchAllRows(client: SupabaseClient, table: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client.from(table).select('*').range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Falha ao ler a tabela ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as Row[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function loadDataset(client: SupabaseClient): Promise<Dataset> {
  const [partnerRows, referralRows, costRows, mrrRows] = await Promise.all([
    fetchAllRows(client, 'partners'),
    fetchAllRows(client, 'referrals'),
    fetchAllRows(client, 'channel_costs'),
    fetchAllRows(client, 'new_mrr_entries')
  ]);

  return {
    partners: partnerRows.map(rowToPartner),
    referrals: referralRows.map(rowToReferral),
    channelCosts: costRows.map(rowToCost),
    newMrrEntries: mrrRows.map(rowToMrr),
    fetchedAt: new Date()
  };
}

// ---------------------------------------------------------------------------
// Cache com TTL curto.
//
// Uma pergunta costuma virar várias chamadas de ferramenta seguidas; reler as
// tabelas inteiras a cada uma delas é desperdício. O TTL é curto para que o
// dado siga essencialmente ao vivo, e `atualizar_dados` força a releitura.
//
// A chave inclui a credencial de propósito: no modo remoto, duas pessoas com
// escopos de RLS diferentes NÃO podem compartilhar a mesma entrada de cache.
// ---------------------------------------------------------------------------
export class DatasetCache {
  private entries = new Map<string, { dataset: Dataset; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  async get(key: string, load: () => Promise<Dataset>): Promise<Dataset> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.dataset;

    const dataset = await load();
    this.entries.set(key, { dataset, expiresAt: Date.now() + this.ttlMs });
    return dataset;
  }

  invalidate(key: string): void {
    this.entries.delete(key);
  }
}
