# Stage 1: Build Client
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Build Server Dependencies
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# Stage 3: Production Image
FROM node:20-alpine
WORKDIR /app

# Copy server dependencies
COPY --from=backend-builder /app/node_modules ./node_modules
COPY package*.json ./

# Copy backend source
COPY server.js ./
COPY server/ ./server/
COPY scripts/ ./scripts/
COPY utils/ ./utils/
COPY database/ ./database/

# Copy the built client to the expected path
COPY --from=frontend-builder /app/client/dist ./client/dist

# Set permissions and fix line endings for linux execution
RUN chmod +x scripts/docker-entrypoint.sh && \
    sed -i 's/\r$//' scripts/*.sh

# Automation: Run migrations and start server
EXPOSE 3000
ENTRYPOINT ["scripts/docker-entrypoint.sh"]
