FROM node:12-alpine AS build-stage

USER node

RUN mkdir -p /home/node/app

WORKDIR /home/node/app

COPY --chown=node:node package*.json ./

RUN npm ci --no-optional --loglevel error --no-fund

COPY --chown=node:node . .

RUN npm run build

FROM alpine:edge

# Installs latest Chromium (85) package.
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  freetype-dev \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  nodejs \
  npm

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
  PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Add user so we don't need --no-sandbox.
RUN addgroup -S pptruser && adduser -S -g pptruser pptruser \
  && mkdir -p /home/pptruser/Downloads /app \
  && chown -R pptruser:pptruser /home/pptruser \
  && chown -R pptruser:pptruser /app

# Run everything after as non-privileged user.
USER pptruser

WORKDIR /app

COPY --from=build-stage --chown=pptruser:pptruser /home/node/app/build ./build
COPY --from=build-stage --chown=pptruser:pptruser /home/node/app/package*.json ./
COPY --chown=pptruser:pptruser ./templates ./templates

RUN npm ci --only=production --loglevel error --no-fund

EXPOSE 4500

CMD [ "node", "./build/index.js" ]