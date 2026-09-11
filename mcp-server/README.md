# Servidor MCP — Canal de Parcerias

Um agente que lê os dados do canal direto do Supabase e responde perguntas em
linguagem natural: safras de parceiros e de indicações, taxa de conversão, MRR,
CAC, ROI, churn e ranking de parceiros.

## A regra que sustenta tudo

**Nenhum número é calculado aqui.** Cada ferramenta chama a mesma função que a
tela do app chama (`src/utils/analytics.ts`, `vintageAnalytics.ts`,
`partnerVintageAnalytics.ts`, `channelMetrics.ts`, `churnAnalytics.ts`) e só
reembala o resultado.

Isso não é preciosismo: um modelo somando MRR linha a linha acerta quase sempre,
e o "quase" vira número errado num slide de diretoria sem ninguém perceber.
Regras como *comissão é custo único contra 12 meses de MRR*, *inativação em 90
dias* ou *bônus de 35pp* também não são deriváveis dos dados — o modelo
inventaria uma versão plausível delas.

Consequência prática: quando você mudar uma regra de negócio no app, o agente
muda junto, no mesmo commit. Não existe segunda implementação para sair de sincronia.

## Rodar local (você, na sua máquina)

1. Copie `mcp-server/.env.example` para `mcp-server/.env`.
2. Preencha `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API →
   `service_role`). A URL e a anon key ele já pega do `.env` do projeto.
3. Registre no Claude Code, na raiz do projeto:

```bash
claude mcp add canal-de-parcerias -- npm run mcp:stdio
```

Pronto. Pergunte em português: *"compare a conversão das safras de parceiros dos
últimos 6 meses"*, *"qual mês teve o melhor ROI"*, *"quais parceiros da carteira
da Ana estão em risco"*.

### Por que a service role só vale para uso local

Essa chave **ignora a RLS** — quem a tem lê tudo, como master. Para você, que é
master, o resultado é o mesmo. Para dar acesso a outras pessoas, **não copie a
chave**: use o modo remoto, onde cada um entra com o próprio login e a RLS do
banco (`supabase/schema_rls_scope.sql`) aplica o escopo por carteira sozinha.

Ver [DEPLOY.md](DEPLOY.md) — é o arquivo para mandar ao time de tech.

## Ferramentas

| Ferramenta | Responde |
|---|---|
| `visao_geral` | O que existe na base: períodos, executivos, meses com custo informado |
| `kpis_do_canal` | Conversão, volume, comissões, ciclo, **payback e ROI 12m** |
| `safras_de_indicacoes` | Safras por mês da indicação, conversão no corte D+15 e atual |
| `safras_de_parceiros` | Safras por mês de entrada: ativação, produção, conversão, saúde |
| `metricas_do_periodo` | CAC, CAP, ticket e relevância do canal, mês a mês |
| `churn_mensal` | Cancelamentos e MRR perdido por mês |
| `ranking_de_parceiros` | Ranking por ganhos, indicações, volume, conversão ou velocidade |
| `coorte_por_tempo_de_casa` | Curva de produção pelo mês 1, 2, 3... de programa |
| `buscar_parceiro` | Acha o id de um parceiro por nome, empresa, documento ou executivo |
| `atualizar_dados` | Descarta o cache e relê o banco agora |

Os retornos trazem campos `_nota` com a regra de negócio daquele bloco (unidade,
base de cálculo, armadilha conhecida) — é o que impede o modelo de comparar MRR
mensal com comissão única, ou de ler `null` ("não informado") como zero.

## Testar sem credencial

```bash
npm run mcp:test
```

Sobe o servidor com dados sintéticos e chama todas as ferramentas por um cliente
MCP real, em memória. Não toca no Supabase de propósito: erro de credencial não
deve conseguir mascarar erro de código.

## Estrutura

```
mcp-server/
  src/
    env.ts       Carrega o .env antes de tudo (aceita nomes VITE_*)
    data.ts      Lê as tabelas do Supabase + cache com TTL
    scope.ts     Recorte por período/parceiro/executivo (reusa filterReferrals)
    format.ts    Arredondamento e enxugamento do retorno
    tools.ts     As 10 ferramentas
    server.ts    Fábrica comum aos dois transportes
    stdio.ts     Entrypoint local
    http.ts      Entrypoint remoto (multiusuário, RLS por token)
  smoke-test.ts  Teste com dados sintéticos
  Dockerfile     Build do modo remoto
```

`src/services/rowMappers.ts` (no app, não aqui) traduz linha do banco ↔ objeto do
domínio. Ele foi extraído do `repository.ts` justamente para poder ser usado aqui
sem arrastar `import.meta.env` e `localStorage`, que só existem no browser.
