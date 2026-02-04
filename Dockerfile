FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json eslint.config.mjs .prettierrc .prettierignore ./
COPY src ./src/

CMD ["npx", "tsx", "watch", "src/index.ts"]
