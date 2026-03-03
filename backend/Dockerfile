FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy source
COPY src ./src
COPY scripts ./scripts

# Create data & logs directories
RUN mkdir -p data logs

# Non-root user for security
RUN addgroup -S somaa && adduser -S somaa -G somaa
RUN chown -R somaa:somaa /app
USER somaa

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]
