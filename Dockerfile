# Cortex MCP Server Docker Image
# Multi-stage build producing a Bun single-file executable

# ==============================================================================
# Stage 1: Builder - Install deps & compile executable
# ==============================================================================
FROM oven/bun:1.3-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json bun.lock* ./

# Install dependencies (compile happens in this stage)
RUN bun install --frozen-lockfile

# Copy sources required for the build
COPY tsconfig.json ./
COPY src ./src

# Build a standalone executable
# Default target is musl to match the alpine runtime image.
ARG BUN_TARGET=bun-linux-x64-musl
RUN bun build --compile --target=${BUN_TARGET} --minify --sourcemap ./src/server/index.ts --outfile /app/cortex

# ==============================================================================
# Stage 2: Production - Minimal runtime image
# ==============================================================================
FROM alpine:3.20 AS production

# Healthcheck uses wget; compiled executable needs C++ runtime libs
RUN apk add --no-cache wget libstdc++ libgcc

# Add labels for container metadata
LABEL org.opencontainers.image.title="Cortex MCP Server"
LABEL org.opencontainers.image.description="Memory Context Protocol server for AI assistants"
LABEL org.opencontainers.image.version="1.0.0"

# Create non-root user for security
RUN addgroup -g 1001 -S cortex && \
    adduser -u 1001 -S cortex -G cortex

WORKDIR /app

# Copy the standalone executable from builder stage
COPY --from=builder /app/cortex /usr/local/bin/cortex

# Create data directory with correct ownership
RUN chmod +x /usr/local/bin/cortex \
    && mkdir -p /data \
    && chown -R cortex:cortex /data

# Switch to non-root user
USER cortex

# Environment variable defaults
ENV CORTEX_DATA_PATH=/data
ENV CORTEX_PORT=3000
ENV CORTEX_HOST=0.0.0.0
ENV CORTEX_DEFAULT_STORE=default
ENV CORTEX_LOG_LEVEL=info
ENV CORTEX_OUTPUT_FORMAT=yaml
ENV CORTEX_AUTO_SUMMARY_THRESHOLD=500

# Expose the server port
EXPOSE 3000

# Define volume mount point for persistent data
VOLUME ["/data"]

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${CORTEX_PORT}/health || exit 1

# Start the MCP server
ENTRYPOINT ["/usr/local/bin/cortex"]
