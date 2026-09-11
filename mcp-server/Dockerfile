# Build a partir da RAIZ do repositório, não de dentro de mcp-server/:
#
#   docker build -f mcp-server/Dockerfile -t canal-parcerias-mcp .
#
# O servidor importa as funções de análise de src/utils/, então o contexto
# precisa enxergar as duas pastas. Isso é proposital: as métricas são as mesmas
# que o dashboard usa, e não uma segunda implementação que diverge com o tempo.

FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY mcp-server ./mcp-server

RUN npm run mcp:build

# ---------------------------------------------------------------------------

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/mcp-server/dist ./mcp-server/dist

# Não roda como root.
USER node

EXPOSE 8787

# SUPABASE_URL e SUPABASE_ANON_KEY vêm do ambiente (secrets da plataforma).
# NÃO injete a service role aqui: ela ignora a RLS, e num servidor multiusuário
# isso daria a todo mundo a visão de um master. Ver DEPLOY.md.
CMD ["node", "mcp-server/dist/http.mjs"]
