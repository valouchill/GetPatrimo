# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /opt/doc2loc

# Dépendances système pour canvas (PDF rendering)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pkgconfig \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev \
    fontconfig \
    ttf-dejavu \
    ttf-liberation \
    font-noto \
    font-noto-emoji \
    && fc-cache -fv

# Layer caching: package.json first
COPY package*.json ./
RUN npm ci

# Source code
COPY . .

# Build Next.js
ARG JWT_SECRET=build-time-placeholder
ARG NEXTAUTH_SECRET=build-time-placeholder
ARG MONGO_URI=mongodb://127.0.0.1:27017/doc2loc-build
# Sentry : le DSN doit être présent AU BUILD (withSentryConfig + inlining client).
# Non-secret (clé d'envoi seulement). Passé via :
#   --build-arg NEXT_PUBLIC_SENTRY_DSN="$(grep -E '^NEXT_PUBLIC_SENTRY_DSN=' /opt/doc2loc/.env | cut -d= -f2-)"
ARG NEXT_PUBLIC_SENTRY_DSN=""
ENV NODE_ENV=production \
    JWT_SECRET=$JWT_SECRET \
    NEXTAUTH_SECRET=$NEXTAUTH_SECRET \
    MONGO_URI=$MONGO_URI \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /opt/doc2loc

# Le serveur custom choisit le mode Next.js via NODE_ENV. Sans cette variable
# dans l'image runtime, Next démarre en mode dev et recompilie à la volée.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Runtime-only system deps (no compiler toolchain)
# - libreoffice-writer : DOCX → PDF conversion for lease contracts
# - python3 + py3-pip + weasyprint deps : HTML/CSS → PDF (Passeport Locatif)
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    librsvg \
    fontconfig \
    ttf-dejavu \
    ttf-liberation \
    font-noto \
    font-noto-emoji \
    curl \
    libdmtx \
    libdmtx-libs \
    libreoffice-writer \
    libreoffice-common \
    python3 \
    py3-pip \
    py3-cffi \
    py3-brotli \
    gcc \
    musl-dev \
    python3-dev \
    && fc-cache -fv \
    && pip3 install --no-cache-dir --break-system-packages \
       'weasyprint==68.1' \
       pylibdmtx Pillow 'pydantic>=2.12' 'cryptography>=43' \
    && apk del gcc musl-dev python3-dev

# Copy everything from builder EXCEPT node_modules
COPY --from=builder /opt/doc2loc/package*.json ./
COPY --from=builder /opt/doc2loc/.next ./.next
COPY --from=builder /opt/doc2loc/public ./public
COPY --from=builder /opt/doc2loc/server.js ./server.js
COPY --from=builder /opt/doc2loc/next.config.js ./next.config.js
COPY --from=builder /opt/doc2loc/src ./src
COPY --from=builder /opt/doc2loc/lib ./lib
COPY --from=builder /opt/doc2loc/models ./models
COPY --from=builder /opt/doc2loc/app ./app
COPY --from=builder /opt/doc2loc/.cursor ./.cursor
COPY --from=builder /opt/doc2loc/scoring.js ./scoring.js
COPY --from=builder /opt/doc2loc/scoringEngine.js ./scoringEngine.js
COPY --from=builder /opt/doc2loc/scripts ./scripts
# Module C — lib 2D-Doc vendorée (MIT) + TSL ANTS embarquée (vérif sceau offline)
COPY --from=builder /opt/doc2loc/vendor ./vendor

# Marquer le script Python comme exécutable pour le subprocess Node.js
RUN chmod +x /opt/doc2loc/scripts/generate_passport_pdf.py 2>/dev/null || true

# Fresh production-only install (avoids npm prune --production bugs in npm 10+)
RUN apk add --no-cache python3 make g++ pkgconfig \
    cairo-dev jpeg-dev pango-dev giflib-dev librsvg-dev \
    && npm ci --omit=dev \
    && apk del python3 make g++ pkgconfig \
       cairo-dev jpeg-dev pango-dev giflib-dev librsvg-dev

# Create upload directories (all subdirs used by the app)
RUN mkdir -p \
    uploads/candidats \
    uploads/property-documents \
    uploads/leases/compiled \
    uploads/edl \
    uploads/signatures \
    uploads/receipts \
    uploads/exports \
    backups \
  && chmod -R 775 uploads/ backups/

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /opt/doc2loc
USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
