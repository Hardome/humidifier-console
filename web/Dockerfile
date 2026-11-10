FROM node:26.13.0-bookworm-slim AS build
ENV KUBB_DISABLE_TELEMETRY=1
WORKDIR /app
RUN npm install --global corepack && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json web/package.json
COPY contracts/package.json contracts/package.json
RUN pnpm install --frozen-lockfile
COPY web web
RUN pnpm --dir web build

FROM nginx:1.31.8-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
