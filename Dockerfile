FROM node:16.13-alpine AS build-stage

RUN apk add --no-cache \
  python3 \
  build-base \
  g++ \
  cairo-dev \
  jpeg-dev \
  pango-dev \
  giflib-dev


USER node

RUN mkdir -p /home/node/app

WORKDIR /home/node/app

COPY --chown=node:node package*.json ./

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN npm ci --loglevel error --no-fund

COPY --chown=node:node . .

RUN npm run build

FROM alpine:3.15

# Installs  Chromium (93) package.
RUN apk add --no-cache \
  "chromium~=93.0.4577.82" \
  nss \
  freetype \
  freetype-dev \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  nodejs \
  npm \
  graphicsmagick \
  build-base \
  g++ \
  cairo-dev \
  jpeg-dev \
  pango-dev \
  giflib-dev

WORKDIR /tmp

#Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
  PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Add user so we don't need --no-sandbox.
RUN addgroup -S -g 1000 pptruser && adduser -S -u 1000 -g pptruser pptruser \
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

ARG BUILD_VERSION=<unknown>
RUN echo $BUILD_VERSION > build-version.txt

EXPOSE 4500

CMD [ "node", "./build/index.js" ]
