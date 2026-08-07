# Dockerfile para despliegue en EasyPanel / VPS
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifiestos de paquetes
COPY package.json ./
COPY prisma ./prisma/

# Instalar dependencias
RUN npm install

# Copiar el resto del código fuente del proyecto
COPY . .

# Generar cliente de Prisma
RUN npx prisma generate || true

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]
