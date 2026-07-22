# Etapa 1: Construcción
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm ci

# Copiar el código del frontend y compilar
COPY . .
RUN npm run build

# Etapa 2: Ejecución standalone sobre Node
FROM node:20-alpine

WORKDIR /app

# Instalar el servidor estático 'serve' globalmente en Node
RUN npm install -g serve

# Copiar solo el bundle compilado de estáticos
COPY --from=builder /app/dist ./dist

# Puerto expuesto por el servidor standalone
EXPOSE 3000

# Comando para servir la SPA de Vite de forma standalone en Node
# -s habilita el single-page-application fallback (redirigiendo rutas no encontradas a index.html)
# -l 3000 configura el puerto de escucha
CMD ["serve", "-s", "dist", "-l", "3000"]
