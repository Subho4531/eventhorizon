FROM node:20-slim AS builder
WORKDIR /app

COPY worker/package*.json ./
RUN npm ci

COPY worker/index.ts ./
COPY worker/tsconfig.json ./
RUN npx tsc --outDir dist

# ── Runtime image ────────────────────────────────────────────────────────────
FROM node:20-slim
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

# Render assigns PORT dynamically
EXPOSE ${PORT:-8080}

CMD ["node", "dist/index.js"]
