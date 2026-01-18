# Issue#4: Docker環境の導入 - Backend Dockerfile
# TDD Red段階: 実装前のDockerfile定義

# Multi-stage build for optimization
# Amazon Corretto 21を使用（EC2/ECSとの相性が良いため）
FROM amazoncorretto:21 AS builder

WORKDIR /app

# Copy Gradle files
COPY gradle/ gradle/
COPY gradlew .
COPY build.gradle .
COPY settings.gradle .

# Download dependencies
RUN ./gradlew dependencies --no-daemon

# Copy source code
COPY src/ src/

# Build application
RUN ./gradlew build -x test --no-daemon

# Runtime stage
FROM amazoncorretto:21-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user for security
RUN addgroup -S photlas && adduser -S photlas -G photlas

# Copy jar file from builder stage
COPY --from=builder /app/build/libs/*.jar app.jar

# Change ownership to non-root user
RUN chown photlas:photlas app.jar

USER photlas

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8080/api/v1/health || exit 1

# Run application
ENTRYPOINT ["java", "-jar", "app.jar"]