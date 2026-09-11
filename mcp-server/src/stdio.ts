import './env';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServiceClient } from './data';
import { criarLeitor, criarServidor } from './server';

// ---------------------------------------------------------------------------
// Modo local: o Claude Code sobe este processo na sua máquina e conversa por
// stdin/stdout. A credencial é a service role, então a leitura ignora a RLS —
// o que é adequado para um master rodando na própria máquina, e é exatamente
// por isso que essa chave não deve ser distribuída para outras pessoas.
// Para vários usuários, use http.ts (cada um entra com o próprio login).
//
// Atenção: em stdio, stdout é o canal do protocolo. Qualquer console.log vira
// lixo no meio de uma mensagem JSON-RPC e derruba a conexão — todo log aqui
// vai para stderr.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const client = createServiceClient();
  const server = criarServidor(criarLeitor(client, 'service-role'));
  await server.connect(new StdioServerTransport());
  console.error('[canal-de-parcerias] servidor MCP pronto (stdio)');
}

main().catch(err => {
  console.error('[canal-de-parcerias] falhou ao iniciar:', err instanceof Error ? err.message : err);
  process.exit(1);
});
