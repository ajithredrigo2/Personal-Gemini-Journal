# ==============================================================================
# Multi-Stage Dockerfile for MindScribe AI Journal (Google Cloud Run)
# Optimized for security, minimal image size, and fast cold-starts
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Bundle
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Install build dependencies
WORKDIR /app

# Copy package manifests for efficient layer caching
COPY package.json ./

# Install all dependencies (including devDependencies required for build)
RUN npm install

# Copy source code and configuration files
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY metadata.json ./
COPY firebase-applet-config.json ./
COPY server.ts ./
COPY src/ ./src/

# Compile frontend static assets (Vite) and backend bundle (esbuild) to /app/dist
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Minimal Runtime
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Copy package manifest and install runtime dependencies only
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled distribution artifacts from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/firebase-applet-config.json ./

# Security: Run as non-root user (least-privilege principle)
USER node

# Expose default Cloud Run container port
EXPOSE 8080

# Start server entry point
CMD ["node", "dist/server.cjs"]
