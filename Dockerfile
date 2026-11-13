# ===============================================================
# Stage 1: Build the Vite Client
# ===============================================================
FROM node:20-alpine AS client-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# ===============================================================
# Stage 2: Production Server & Static Delivery
# ===============================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies for server
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev && npm cache clean --force

# Copy server application source with unprivileged ownership
COPY --chown=node:node server/ ./server/

# Copy built frontend assets from builder stage with unprivileged ownership
COPY --chown=node:node --from=client-builder /app/client/dist ./client/dist

# Enforce non-root user execution
USER node

# Expose API & Web interface port
EXPOSE 5000

# Container liveness healthcheck targeting /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start the unified WorkHive service
CMD ["node", "server/server.js"]
