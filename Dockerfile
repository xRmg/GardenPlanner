# syntax=docker/dockerfile:1.7

# Multi-stage build for Garden Planner
# Stage 1: Build the React app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY scripts ./scripts

# Install dependencies
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy only frontend build inputs so backend-only changes do not invalidate this layer
COPY app ./app
COPY data ./data
COPY hooks ./hooks
COPY images ./images
COPY i18n ./i18n
COPY lib ./lib
COPY services ./services
COPY src ./src
COPY styles ./styles
COPY components.json ./components.json
COPY index.html ./index.html
COPY tsconfig.json ./tsconfig.json
COPY tsconfig.app.json ./tsconfig.app.json
COPY vite.config.ts ./vite.config.ts

# Build the app
RUN --mount=type=cache,target=/app/node_modules/.tmp npm run build:frontend

# Stage 2: Serve with nginx
FROM nginx:alpine

# Install envsubst for runtime config templating
RUN apk add --no-cache gettext

# Copy nginx config template and startup entrypoint
COPY nginx.conf /etc/nginx/nginx.conf.template
COPY docker/nginx-entrypoint.sh /usr/local/bin/nginx-entrypoint.sh
RUN chmod +x /usr/local/bin/nginx-entrypoint.sh

# Copy built app from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/index.html || exit 1

# Start nginx
CMD ["/usr/local/bin/nginx-entrypoint.sh"]
