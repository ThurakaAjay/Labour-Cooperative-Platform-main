# WorkHive — Production Deployment & DevOps Guide

WorkHive supports automated multi-stage Docker builds, Docker Compose orchestration, and cloud deployment pipelines.

---

## 1. Multi-Stage Dockerfile Overview

The root `Dockerfile` produces a minimal, production-optimized container:

```dockerfile
# Stage 1: Build the Vite Client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Production Server & Static Delivery
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev
COPY server/ ./server/

# Copy compiled frontend from builder
COPY --from=client-builder /app/client/dist ./client/dist
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "server/server.js"]
```

---

## 2. Docker Compose Deployment

Run the complete multi-tier stack (Node.js App + MongoDB 7):

```bash
docker compose up -d --build
```

- App URL: `http://localhost:5000`
- MongoDB: `localhost:27017`
- Health check verifies container readiness via `/api/health`.

---

## 3. Render PaaS Cloud Blueprint

`render.yaml` specifies the continuous deployment blueprint:

```yaml
services:
  - type: web
    name: workhive
    runtime: node
    region: oregon
    plan: free
    buildCommand: npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      - key: JWT_SECRET
        sync: false
```

---

## 4. Continuous Integration Pipeline (GitHub Actions)

Located at `.github/workflows/ci.yml`:
1. Checks out repository source.
2. Configures Node.js 20 with npm caching.
3. Installs backend and frontend dependencies.
4. Executes Jest test suites.
5. Builds the production Vite bundle.
