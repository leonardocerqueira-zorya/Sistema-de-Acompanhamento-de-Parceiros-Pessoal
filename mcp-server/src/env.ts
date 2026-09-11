import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Carrega o .env ANTES de qualquer coisa ler process.env.
//
// Precisa ser importado como primeira linha dos entrypoints (stdio.ts/http.ts):
// em ESM os imports são resolvidos antes do corpo do módulo, então basta este
// arquivo vir primeiro na lista.
//
// Ordem de precedência (dotenv não sobrescreve o que já está definido):
//   1. Variáveis já no ambiente  — é assim que o Docker/servidor injeta.
//   2. mcp-server/.env           — configuração específica do servidor.
//   3. .env do projeto           — reaproveita o que o app já usa.
// ---------------------------------------------------------------------------

const aqui = dirname(fileURLToPath(import.meta.url));

// Funciona tanto rodando o TS direto (src/) quanto o bundle (dist/): os dois
// ficam um nível abaixo de mcp-server/.
config({ path: resolve(aqui, '../.env') });
config({ path: resolve(aqui, '../../.env') });
