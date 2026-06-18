# --- Stage 1: Build the React Frontend ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Stage 2: Serve Backend ---
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY server.js ./
COPY --from=builder /app/dist ./dist

VOLUME /app/data
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
