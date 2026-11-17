# ==============================================================================
# ESTÁGIO 1: BUILD DA APLICAÇÃO (NODE.JS ALPINE)
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Parâmetros de build configuráveis para o Vite
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV NODE_ENV=production

# Copiar arquivos de dependências com verificação de integridade
COPY package.json package-lock.json ./

# Instalação reprodutível e limpa de dependências
RUN npm ci --include=dev

# Copiar código-fonte da aplicação
COPY . .

# Compilação e empacotamento com TypeScript e Vite
RUN npm run build

# ==============================================================================
# ESTÁGIO 2: RUNTIME ENDURECIDO (HARDENED NGINX UNPRIVILEGED)
# ==============================================================================
FROM nginxinc/nginx-unprivileged:alpine AS runtime

# Metadados de auditoria e conformidade OCI
LABEL org.opencontainers.image.title="Sistema de Inventário e Auditoria Industrial" \
      org.opencontainers.image.description="Front-end seguro SPA para auditoria de ativos via leitor de código de barras" \
      org.opencontainers.image.authors="Engenharia de Software" \
      org.opencontainers.image.source="https://github.com/empresa/inventario"

USER root

# Remover arquivos de boas-vindas padrões do Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copiar artefatos compilados do estágio anterior
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Copiar configuração com cabeçalhos de segurança DevSecOps
COPY --chown=nginx:nginx nginx.conf /etc/nginx/nginx.conf

# Rebaixar privilégios para usuário não-root (UID 101 - nginx)
USER 101

# Expor porta sem privilégios de root
EXPOSE 8080

# Healthcheck nativo para orquestradores (Kubernetes, AWS ECS, Docker Compose)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
