FROM node:20-bookworm-slim AS base

# Native addon build deps (better-sqlite3)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# ── Stage 1: Install & build frontend ────────────────────────────
FROM base AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ── Stage 2: Install backend deps ────────────────────────────────
FROM base AS backend-builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 3: Production image ────────────────────────────────────
FROM node:20-bookworm-slim

# better-sqlite3 needs libstdc++ at runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends libstdc++6 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Backend
COPY --from=backend-builder /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/

# Frontend (Next.js standalone output)
COPY --from=frontend-builder /app/frontend/.next/standalone ./frontend/
COPY --from=frontend-builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/frontend/public ./frontend/public

# tsx is needed to run the TS backend — copy it from backend build
COPY --from=backend-builder /app/node_modules/.package-lock.json /dev/null* ./
RUN npm install --no-save tsx

ENV NODE_ENV=production
# Backend Express server port
ENV PORT=8000

# Expose both ports: 3000 (frontend), 8000 (backend API)
EXPOSE 3000 8000

# Start both processes: Express backend + Next.js frontend
# HOSTNAME=0.0.0.0 lets Next.js bind to all interfaces inside Docker
CMD sh -c 'npx tsx src/server.ts & HOSTNAME=0.0.0.0 PORT=3000 node frontend/server.js & wait'
