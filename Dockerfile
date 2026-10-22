# Use one supported runtime and one frozen lockfile in both stages.
FROM node:24.22.1-alpine AS base
WORKDIR /usr/src/app
RUN npm install --global pnpm@12.15.0

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV TZ=Europe/Berlin
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile \
    && mkdir -p config
COPY --from=build /usr/src/app/dist ./dist

HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
    CMD ["node", "dist/healthcheck.js"]

CMD ["node", "dist/Bot.js"]
