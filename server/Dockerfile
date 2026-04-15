# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++

# Copy just what's needed to install — server + shared workspaces only.
# We override the root package.json to skip the client + infra workspaces so
# we don't bloat the image with React + CDK deps.
COPY tsconfig.base.json ./
COPY shared ./shared
COPY server ./server
# Minimal root package.json pointing at just server + shared
RUN printf '{\n  "name": "dcl-build",\n  "private": true,\n  "workspaces": ["shared", "server"]\n}\n' > package.json

# --ignore-scripts skips puppeteer's chromium download (system chromium at
# runtime). optionalDependencies must stay in so esbuild's platform binary
# (needed by tsx) installs.
RUN npm install --ignore-scripts

# ---- Runtime stage ----
FROM node:20-alpine
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/shared ./shared
COPY --from=build /app/server ./server
COPY --from=build /app/node_modules ./node_modules

WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npx", "tsx", "src/index.ts"]
