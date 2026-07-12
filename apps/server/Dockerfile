FROM node:20-slim AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npx prisma generate --schema=apps/server/prisma/schema.prisma
RUN npx nx build server

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist/apps/server ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3001
CMD ["node", "src/index.js"]