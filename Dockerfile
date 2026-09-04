# =============================================================================
# Multi-Stage Dockerfile for MindScribe AI Journal (Google Cloud Run)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build & bundle
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies from the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci

# Application source and configuration
COPY tsconfig.json vite.config.ts index.html metadata.json server.ts ./
COPY src/ ./src/

# -----------------------------------------------------------------------------
# Client-side Firebase / Maps configuration
#
# Vite inlines VITE_* values at BUILD time, so they are passed as build args
# rather than copied in from a .env file. These are public browser identifiers,
# not secrets - the Gemini API key is injected at RUNTIME via Secret Manager and
# never reaches the client bundle.
#
#   docker build \
#     --build-arg VITE_FIREBASE_API_KEY=... \
#     --build-arg VITE_FIREBASE_AUTH_DOMAIN=... \
#     ...
# -----------------------------------------------------------------------------
ARG VITE_FIREBASE_API_KEY=""
ARG VITE_FIREBASE_AUTH_DOMAIN=""
ARG VITE_FIREBASE_PROJECT_ID=""
ARG VITE_FIREBASE_STORAGE_BUCKET=""
ARG VITE_FIREBASE_MESSAGING_SENDER_ID=""
ARG VITE_FIREBASE_APP_ID=""
ARG VITE_FIRESTORE_DATABASE_ID=""
ARG VITE_GOOGLE_MAPS_API_KEY=""

ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_FIRESTORE_DATABASE_ID=$VITE_FIRESTORE_DATABASE_ID \
    VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

RUN npm run build


# =============================================================================
# Stage 2: Production runtime
# =============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Runtime dependencies only (vite/esbuild/tailwind stay in the builder stage).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force

# Compiled server bundle + static client assets
COPY --from=builder /app/dist ./dist

# Run as non-root
USER node

EXPOSE 8080

CMD ["node", "dist/server.cjs"]
