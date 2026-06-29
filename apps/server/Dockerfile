FROM oven/bun:1

WORKDIR /app

# Copy workspace files so Bun workspaces and Turbo can resolve packages
COPY bun.lock package.json turbo.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages

# Install dependencies for the whole monorepo (use lockfile)
RUN bun install --frozen-lockfile

# Run the server directly from TypeScript source. Bun executes TS natively and
# resolves the full (transitive) dependency tree at runtime — bundling with
# tsdown externalized deep transitive deps like emailmd→mjml→lodash/fp that the
# container could not resolve, crashing the server on boot.
WORKDIR /app/apps/server

ENV NODE_ENV=production
EXPOSE 3000

# Run migrations then start the server
CMD ["sh", "-c", "bun run ../../packages/db/src/migrate.ts && bun run start"]

