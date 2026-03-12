FROM node:20-alpine

WORKDIR /opt/doc2loc

# Installation des dépendances système (canvas + polices pour le rendu PDF)
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

# Copie des fichiers package
COPY package*.json ./

# Installation de TOUTES les dépendances (dev inclus pour le build)
RUN npm ci

# Copie du code source
COPY . .

# Build Next.js pour la production
ENV NODE_ENV=production
RUN npm run build

# Suppression des devDependencies après le build
RUN npm prune --production

# Création des dossiers nécessaires
RUN mkdir -p uploads/candidats uploads/property-documents

# Exposition du port
EXPOSE 3000

# Démarrage du serveur
CMD ["node", "server.js"]
