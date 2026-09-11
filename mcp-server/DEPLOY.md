# Publicar como conector MCP da organização

Documento para o time de tech. O objetivo é que as pessoas do canal (e o CEO)
consultem os dados do programa de parcerias pelo Claude, **sem instalar nada**.

## O que é isso

Um servidor MCP (Model Context Protocol) que expõe 10 ferramentas de análise
sobre as tabelas do Supabase do Canal de Parcerias. Ele **não calcula nada por
conta própria**: chama as mesmas funções TypeScript que o dashboard React já usa
(`src/utils/*.ts`). Uma regra de negócio alterada no app vale no agente no mesmo
deploy.

O servidor é **somente leitura**. Não há nenhuma ferramenta de escrita, e o
código não chama `insert`/`update`/`delete` em lugar nenhum.

## Decisão de segurança já tomada (por favor, não reverter)

O servidor **não usa a service role key**. Cada requisição precisa trazer o
access token do próprio usuário:

```
Authorization: Bearer <access token do Supabase Auth>
```

O servidor cria o cliente Supabase com esse token, então **a RLS já existente
(`supabase/schema_rls_scope.sql`) aplica o escopo sozinha**: master vê tudo,
executivo vê só a carteira dele. O servidor não reimplementa recorte de acesso —
o que significa que uma regra nova no banco passa a valer aqui sem redeploy.

Usar service role "para simplificar" quebraria exatamente isso: daria a todo
mundo a visão de um master. O cache também é chaveado por usuário (`user:<id>`)
pelo mesmo motivo.

## Subir

Build a partir da **raiz do repositório** (o servidor importa `src/utils/`):

```bash
docker build -f mcp-server/Dockerfile -t canal-parcerias-mcp .
```

Variáveis de ambiente:

| Variável | Obrigatória | O quê |
|---|---|---|
| `SUPABASE_URL` | sim | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | sim | anon/publishable key (**não** a service role) |
| `PORT` | não | Padrão 8787 |
| `MCP_CACHE_TTL_MS` | não | TTL do cache de leitura. Padrão 60000 |

Endpoints:

- `POST /mcp` — o endpoint MCP (Streamable HTTP, **stateless**: sem sessão
  presa a processo, então pode escalar horizontalmente atrás de um LB)
- `GET /health` — healthcheck

Sem Docker: `npm ci && npm run mcp:build && node mcp-server/dist/http.mjs`.

Deve ficar atrás de HTTPS. O token do usuário trafega no header.

## Ligar no Claude

Duas situações diferentes, e a segunda precisa de uma decisão de vocês.

### 1. Claude Code (funciona como está)

```bash
claude mcp add --transport http canal-de-parcerias https://SEU-HOST/mcp \
  --header "Authorization: Bearer <token do usuário>"
```

### 2. Conector da organização no claude.ai (precisa checar)

Aqui está a única parte que eu **não consigo garantir sem vocês verificarem**:
conectores remotos adicionados no claude.ai normalmente esperam um fluxo
**OAuth** para autenticar o usuário final, e este servidor, como entregue, espera
um bearer token do Supabase no header.

Duas saídas, e a escolha é de vocês:

- **(a) Verificar se o plano Claude da Zorya aceita conector com header estático
  ou chave de API.** Se aceitar, não há trabalho adicional — mas aí o token é
  compartilhado, e o escopo por carteira deixa de valer por pessoa. Só faz
  sentido se todos os usuários forem master.

- **(b) Colocar uma camada OAuth na frente** (o caminho correto para mais de um
  perfil de usuário). O servidor MCP em si não muda: ele continua recebendo um
  bearer token e repassando ao Supabase. O que falta é o endpoint de
  autorização que troca o login pelo access token do Supabase Auth — que já é o
  mesmo provedor de identidade que o app usa hoje.

Recomendo (b) se executivos forem usar. Se for só master (CEO e responsável pelo
canal), (a) resolve e é bem mais rápido.

## Conferir se subiu certo

```bash
curl https://SEU-HOST/health
# {"ok":true,"servico":"canal-de-parcerias-mcp"}

# Sem token deve dar 401:
curl -X POST https://SEU-HOST/mcp -H 'Content-Type: application/json' -d '{}'

# Com token válido, lista as ferramentas:
curl -X POST https://SEU-HOST/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Teste da lógica sem precisar de banco nem credencial:

```bash
npm run mcp:test
```

Sobe o servidor com dados sintéticos e chama as 10 ferramentas por um cliente MCP
real, em memória.

## Detalhes que evitam retrabalho

- **Paginação**: o Supabase devolve no máximo 1000 linhas por request. `data.ts`
  pagina em blocos de 1000 — sem isso a base cresce e as análises passam a ser
  truncadas em silêncio, sem erro nenhum aparecer.
- **`npm ci --omit=dev` instala bastante coisa** porque `vite`, `react` e
  `firebase` estão em `dependencies` no `package.json` do app. Funciona, mas se
  quiserem uma imagem menor, dá para mover essas para `devDependencies` — só
  confiram o build do front antes.
- **Cache**: TTL de 1 minuto por usuário. A ferramenta `atualizar_dados` força a
  releitura, então o dado é essencialmente ao vivo quando alguém pede.
