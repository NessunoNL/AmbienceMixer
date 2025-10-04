# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Copy frontend files
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Backend runtime
FROM node:20-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy backend source
COPY backend/src ./src

# Copy built frontend from stage 1
COPY --from=frontend-build /app/backend/public ./public

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port (not strictly necessary with internal networking, but good practice)
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV AUDIO_DIR=/app/audio
ENV DB_PATH=/app/data/ambience.db

CMD ["node", "src/index.js"]
