FROM node:12-alpine AS build-stage

USER node

RUN mkdir -p /home/node/app

WORKDIR /home/node/app

COPY --chown=node:node package*.json ./

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN npm ci --loglevel error --no-fund

COPY --chown=node:node . .

RUN npm run build

# alpine 3.12 has Node 12, alpine:3.13 has Node 14, 
# but Node 14 has no prebuilt binaries for hummus
# after upgrade make sure to add the dependencies for node-gyp and hummus
FROM alpine:3.12

# Installs  Chromium (86) package.
RUN apk add --no-cache \
  "chromium~=86.0.4240.111-r0" \
  nss \
  freetype \
  freetype-dev \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  nodejs \
  npm

WORKDIR /tmp

# Since the alpine:3.12 version of imagemagick doesn't work with tiff install 3.13's version
RUN wget --quiet http://dl-cdn.alpinelinux.org/alpine/v3.13/community/x86_64/imagemagick-7.0.10.57-r0.apk && \
  echo "b895a8145e400af93c71e004529793e663e61e013a933b7811eb25a7b20af3e5  imagemagick-7.0.10.57-r0.apk" | sha256sum -c && \
  apk add imagemagick-7.0.10.57-r0.apk && \
  rm -f imagemagick-7.0.10.57-r0.apk

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

ARG BUILD_VERSION=<unknown>
RUN echo $BUILD_VERSION > build-version.txt

EXPOSE 4500

CMD [ "node", "./build/index.js" ]