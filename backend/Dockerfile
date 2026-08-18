FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Copy migrations files to dist because tsc doesn't copy SQL files
RUN mkdir -p dist/db/migrations && cp src/db/migrations/001_initial.sql dist/db/migrations/

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

# Create uploads directory structure
RUN mkdir -p uploads/original uploads/optimized uploads/thumbnails

EXPOSE 5000

ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/uploads

CMD ["node", "dist/index.js"]
