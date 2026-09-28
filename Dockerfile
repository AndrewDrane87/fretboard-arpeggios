FROM node:24-alpine AS build

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production
ENV PORT=4173
ENV BASE_PATH=/

RUN pnpm --filter @workspace/fretboard-arpeggio-explorer run build

FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/artifacts/fretboard-arpeggio-explorer/dist/public /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/ || exit 1