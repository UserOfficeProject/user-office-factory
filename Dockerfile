FROM node:12-slim

# Install latest chrome dev package and fonts
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer
# installs, work.
RUN apt-get update \
  && apt-get install -y wget gnupg apt-transport-https \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] https://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install -y google-chrome-stable fonts-freefont-ttf libxss1 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

RUN wget https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64 -nv -O /tmp/dumb-init && \
  cd /tmp && \
  echo '81231da1cd074fdc81af62789fead8641ef3f24b6b07366a1c34e5b059faf363  dumb-init' | sha256sum --check && \ 
  mv /tmp/dumb-init /usr/local/bin/dumb-init
RUN chmod +x /usr/local/bin/dumb-init
ENTRYPOINT ["dumb-init", "--"]

RUN usermod -G audio,video node

USER node

RUN mkdir -p /home/node/app

WORKDIR /home/node/app

COPY --chown=node:node package*.json ./

RUN npm ci --only=production --silent

COPY --chown=node:node . .

RUN npm run build

USER root

RUN cd ./node_modules/puppeteer/.local-chromium/linux-*/chrome-linux/ && \
  chown root:root chrome_sandbox && \
  chmod 4755 chrome_sandbox && \
  cp -p chrome_sandbox /usr/local/sbin/chrome-devel-sandbox && \
  export CHROME_DEVEL_SANDBOX=/usr/local/sbin/chrome-devel-sandbox

USER node

RUN echo 'export CHROME_DEVEL_SANDBOX=/usr/local/sbin/chrome-devel-sandbox' >> ~/.bashrc

EXPOSE 4500

CMD [ "node", "./build/index.js" ]