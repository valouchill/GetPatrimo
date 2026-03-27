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
ENV NODE_ENV=production
ARG JWT_SECRET=build-time-placeholder
ARG NEXTAUTH_SECRET=build-time-placeholder
ARG MONGO_URI=mongodb://127.0.0.1:27017/doc2loc-build
ENV JWT_SECRET=$JWT_SECRET
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV MONGO_URI=$MONGO_URI
RUN npm run build

# Remove devDependencies
RUN npm prune --production

# ── Stage 2: Production ────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /opt/doc2loc

# Runtime-only system deps (no compiler toolchain)
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
    && fc-cache -fv

# Copy built artifacts from builder
COPY --from=builder /opt/doc2loc/package*.json ./
COPY --from=builder /opt/doc2loc/node_modules ./node_modules
COPY --from=builder /opt/doc2loc/.next ./.next
COPY --from=builder /opt/doc2loc/public ./public
COPY --from=builder /opt/doc2loc/server.js ./server.js
COPY --from=builder /opt/doc2loc/src ./src
COPY --from=builder /opt/doc2loc/lib ./lib
COPY --from=builder /opt/doc2loc/models ./models
COPY --from=builder /opt/doc2loc/app ./app
COPY --from=builder /opt/doc2loc/next.config.js ./next.config.js

# Create upload directories
RUN mkdir -p uploads/candidats uploads/property-documents && chmod -R 750 uploads/

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /opt/doc2loc
USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
