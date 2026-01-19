# Frontend Dockerfile - Multi-stage build
# Stage 1: Build React application with Vite

FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build arguments for environment-specific builds
ARG VITE_API_URL
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

# Build application
RUN pnpm build

# Stage 2: Serve with Nginx
FROM nginx:1.25-alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Run Nginx
CMD ["nginx", "-g", "daemon off;"]
