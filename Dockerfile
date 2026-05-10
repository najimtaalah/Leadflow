FROM node:20-alpine
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Install deps first (layer cache)
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install

# Generate Prisma client
RUN pnpm prisma generate

# Build the app
COPY . .
RUN pnpm build

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

CMD ["/docker-entrypoint.sh"]
