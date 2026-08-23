FROM node:22-alpine

RUN apk add --no-cache git ca-certificates

WORKDIR /app

COPY package.json package-lock.json ./
COPY vendor ./vendor

RUN npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund

COPY . .

ENV HOST=0.0.0.0
ENV PORT=5173
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
