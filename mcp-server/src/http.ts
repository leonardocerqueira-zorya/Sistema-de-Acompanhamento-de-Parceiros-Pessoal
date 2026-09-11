import './env';
import express from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createUserClient, requireEnv } from './data';
import { criarLeitor, criarServidor } from './server';

// ---------------------------------------------------------------------------
// Modo remoto: um servidor, várias pessoas.
//
// Cada requisição chega com o access token do PRÓPRIO usuário (Supabase Auth),
// e as consultas são feitas com esse token. Consequência importante: a RLS que
// já existe no banco (schema_rls_scope.sql) passa a valer sozinha — master vê
// tudo, executivo vê só a carteira dele — sem este servidor reimplementar
// recorte nenhum. Uma regra de acesso nova no banco vale aqui no mesmo dia.
//
// A service role NÃO é usada aqui, de propósito: ela ignora a RLS, e num
// servidor multiusuário isso daria a todo mundo a visão de um master.
//
// Modo stateless (sem sessão): cada request monta servidor e transporte e os
// descarta no fim. Isso permite rodar várias instâncias atrás de um load
// balancer sem sessão grudada em processo.
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT ?? 8787);

function tokenDoHeader(header: string | undefined): string | null {
  if (!header) return null;
  const [esquema, valor] = header.split(' ');
  if (!valor || esquema.toLowerCase() !== 'bearer') return null;
  return valor.trim() || null;
}

function erro(res: express.Response, status: number, code: number, message: string): void {
  res.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });
}

class ErroHttp extends Error {
  constructor(readonly status: number, readonly code: number, message: string) {
    super(message);
  }
}

interface Sessao {
  client: SupabaseClient;
  chaveCache: string;
}

async function autenticar(token: string): Promise<Sessao> {
  const client = createUserClient(token);
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    throw new ErroHttp(401, -32001, 'Token inválido ou expirado.');
  }
  // A chave do cache é o usuário: escopos de RLS diferentes nunca podem
  // dividir a mesma entrada, ou uma pessoa enxergaria o recorte da outra.
  return { client, chaveCache: `user:${data.user.id}` };
}

async function main(): Promise<void> {
  // Falha cedo e com mensagem clara se faltar configuração, em vez de só
  // devolver 500 na primeira chamada real.
  requireEnv('SUPABASE_URL');
  requireEnv('SUPABASE_ANON_KEY');

  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, servico: 'canal-de-parcerias-mcp' });
  });

  app.post('/mcp', async (req, res) => {
    const token = tokenDoHeader(req.headers.authorization);
    if (!token) {
      erro(res, 401, -32001, 'Faltou o header Authorization: Bearer <access token do Supabase>.');
      return;
    }

    try {
      const sessao = await autenticar(token);

      const server = criarServidor(criarLeitor(sessao.client, sessao.chaveCache));
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

      res.on('close', () => {
        void transport.close();
        void server.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      if (err instanceof ErroHttp) {
        if (!res.headersSent) erro(res, err.status, err.code, err.message);
        return;
      }
      console.error('[canal-de-parcerias] erro ao atender request:', err);
      if (!res.headersSent) erro(res, 500, -32603, 'Erro interno.');
    }
  });

  // Sem sessão não há stream de servidor para abrir nem sessão para encerrar.
  const semSessao: express.RequestHandler = (_req, res) => {
    erro(res, 405, -32000, 'Servidor em modo stateless: use POST /mcp.');
  };
  app.get('/mcp', semSessao);
  app.delete('/mcp', semSessao);

  app.listen(PORT, () => {
    console.log(`[canal-de-parcerias] servidor MCP HTTP na porta ${PORT} (POST /mcp)`);
  });
}

main().catch(err => {
  console.error('[canal-de-parcerias] falhou ao iniciar:', err instanceof Error ? err.message : err);
  process.exit(1);
});
