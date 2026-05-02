# syntax=docker/dockerfile:1.6
#
# Multi-stage build for the Sheet Music Library — produces a single Spring
# Boot JAR with the React app baked in as static resources. Render auto-
# detects this Dockerfile when set as the runtime.
#
# Stage 1: build the React frontend.
# Stage 2: build the Spring Boot backend (with the frontend bundle copied
#          into src/main/resources/static so Spring Boot serves it).
# Stage 3: runtime — minimal JRE image, JAR only.

# === Stage 1: frontend ===
FROM node:24-alpine AS frontend-build
WORKDIR /app

# Cache npm install separately from source code: only re-runs when package
# files change.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build
# Build output is at /app/dist/

# === Stage 2: backend ===
FROM eclipse-temurin:21-jdk-alpine AS backend-build
WORKDIR /app

# Cache Maven dependencies separately from source.
COPY backend/.mvn .mvn
COPY backend/mvnw backend/pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline

COPY backend/src ./src
# Drop the React build into Spring Boot's static resources. The
# StaticResourceConfig serves everything under classpath:/static/ and falls
# back to index.html for SPA routes.
COPY --from=frontend-build /app/dist ./src/main/resources/static

RUN ./mvnw -B -q -DskipTests package

# === Stage 3: runtime ===
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

COPY --from=backend-build /app/target/*.jar app.jar

# Render injects PORT; Spring Boot honors it via server.port in
# application.yml. Expose for documentation; not strictly required by Render.
EXPOSE 8080

# Constrain heap to fit Render's free 512 MB instance with headroom for the
# JVM itself, OS, and request-time allocations. Tune up on bigger instances.
ENV JAVA_OPTS="-Xmx400m -XX:+UseSerialGC"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
