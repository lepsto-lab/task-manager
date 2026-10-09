FROM node:26-slim
RUN npm install -g pnpm@11.25.0
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @tm/web build

ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 WEB_DIST=/app/apps/web/dist
EXPOSE 8080
CMD ["pnpm", "--filter", "@tm/api", "start"]
