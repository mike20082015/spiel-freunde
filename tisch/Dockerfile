# Privater Skat-Tisch.
# Build-Kontext ist die Repository-Wurzel: tisch/lib/room.js lädt
# public/skat/js/engine.js und ai.js. Die liegen außerhalb von tisch/.
FROM node:22-bookworm-slim

WORKDIR /app

COPY tisch/package.json tisch/package-lock.json tisch/
RUN npm ci --prefix tisch

COPY tisch/ tisch/
COPY public/skat/js/ public/skat/js/

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "tisch/server.js"]
