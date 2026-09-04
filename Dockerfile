# ==============================================================================
# Multi-Stage Dockerfile for MindScribe AI Journal (Google Cloud Run)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Bundle
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# ------------------------------------------------------------------------------
# Install dependencies
# ------------------------------------------------------------------------------

# Copy package manifest first for better Docker layer caching
COPY package.json ./

# Install all dependencies, including devDependencies required for Vite/esbuild
RUN npm install

# ------------------------------------------------------------------------------
# Copy application source and configuration
# ------------------------------------------------------------------------------

COPY tsconfig.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY metadata.json ./
COPY firebase-applet-config.json ./
COPY server.ts ./

# Copy frontend source
COPY src/ ./src/

# ------------------------------------------------------------------------------
# Google Maps API key for Vite build
# ------------------------------------------------------------------------------

# The .env file must contain:
#
# VITE_GOOGLE_MAPS_API_KEY=YOUR_REAL_GOOGLE_MAPS_API_KEY
#
# Vite injects VITE_* values at BUILD TIME.
# This .env file is only used in the builder stage and is NOT copied
# into the final production runtime image.
#
# IMPORTANT:
# - Use the Google Maps / Places browser API key here.
# - Do NOT put the Gemini API key here.
# - Keep .env excluded from GitHub using .gitignore.
#
COPY .env ./.env

# ------------------------------------------------------------------------------
# Build frontend + backend
# ------------------------------------------------------------------------------

RUN npm run build


# ==============================================================================
# Stage 2: Production Runtime
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# ------------------------------------------------------------------------------
# Production environment
# ------------------------------------------------------------------------------

ENV NODE_ENV=production
ENV PORT=8080

# ------------------------------------------------------------------------------
# Install runtime dependencies only
# ------------------------------------------------------------------------------

COPY package.json ./

RUN npm install --omit=dev --ignore-scripts \
    && npm cache clean --force

# ------------------------------------------------------------------------------
# Copy compiled application artifacts
# ------------------------------------------------------------------------------

COPY --from=builder /app/dist ./dist

COPY --from=builder /app/firebase-applet-config.json ./

# ------------------------------------------------------------------------------
# Security
# ------------------------------------------------------------------------------

# Run as non-root user
USER node

# ------------------------------------------------------------------------------
# Cloud Run
# ------------------------------------------------------------------------------

EXPOSE 8080

# ------------------------------------------------------------------------------
# Start application
# ------------------------------------------------------------------------------

CMD ["node", "dist/server.cjs"]
