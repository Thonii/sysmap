# AI Context - Sysmap Project

## 1. Current Status
Se han completado de forma exitosa las **Etapas 1, 2 y 3** de **Sysmap**. El agregador comunitario de eventos tecnológicos de TecnoAncon está 100% desarrollado, probado y preparado para su despliegue aislado multi-tenant en producción en el VPS de Hetzner, enrutado por **Traefik v3.7** y protegido por **Cloudflare**.

El sistema es robusto, local-first (cuenta con fallback a SQLite local si no está activa la DB de Docker en desarrollo) y respeta la privacidad por diseño (cero geolocalización invasiva del navegador).

## 2. Recent Changes
- **Sistema de Boletines y Emails Transaccionales (Etapa 3):**
  - Desarrollado el módulo [newsletter.py](file:///home/thonii/proyectos/sysmap/backend/app/pipeline/newsletter.py) con integración REST directa hacia **Resend** con la API Key del `.env`.
  - **Envío los Lunes 08:00 AM:** Modificado el CronTrigger de APScheduler en [main.py](file:///home/thonii/proyectos/sysmap/backend/app/main.py) para que la agenda técnica semanal se dispare y envíe de forma automatizada cada lunes a las 08:00 AM.
  - **Email de Bienvenida:** Integrada la lógica para enviar de forma inmediata (en segundo plano vía FastAPI `BackgroundTasks`) un correo responsivo de bienvenida Solarpunk con los 3 eventos tech más cercanos del momento cuando un usuario se registra.
  - **Desuscripción con Un Clic:** Creado el endpoint `GET /subscriptions/unsubscribe` que desactiva suscripciones desde el enlace inyectado en las plantillas de correo.
  - **Endpoint de Administración:** Implementado el endpoint `POST /newsletter/send-weekly` para forzar el envío del boletín de forma manual.
- **Docker de Producción Standalone sin Nginx (Etapa 3):**
  - Creado el [frontend/Dockerfile](file:///home/thonii/proyectos/sysmap/frontend/Dockerfile) que corre standalone sobre Node (`node:20-alpine`) y sirve los estáticos optimizados usando `serve` con soporte de SPA en el puerto `3000`.
  - Creado el archivo [docker-compose.prod.yml](file:///home/thonii/proyectos/sysmap/docker-compose.prod.yml) de producción.
- **Orquestación Multi-Tenant en TecnoAncon core (Etapa 3):**
  - Creado el orquestador [infra-tecnoancon/clientes/sysmap-app/docker-compose.yml](file:///home/thonii/proyectos/infra-tecnoancon/clientes/sysmap-app/docker-compose.yml) configurando el aislamiento de la base de datos Postgres del cliente, la red externa global `tecnoancon_gateway`, y el enrutamiento a través de **Traefik v3.7**.
  - El backend se expone dinámicamente bajo `/api/` en el dominio de producción del frontend, eliminando errores de CORS.
  - Creado el archivo de guía `.env.example` en la carpeta del cliente en `infra-tecnoancon`.

## 3. Active Constraints
- **Remitente verificado:** Configurado en el código como `no-reply@tecnoancon.com`. Los registros DNS (TXT/CNAME) de Resend deben ingresarse manualmente en la zona de Cloudflare.
- **Capa Cloudflare:** Todo el tráfico HTTP/HTTPS, certificados SSL del borde y caché perimetral son controlados por la cuenta Cloudflare de TecnoAncon externa al VPS.
- **Resiliencia Local:** En local, si la DB Postgres no está activa o el host `db` falla, el backend levanta un fallback automático a una base de datos SQLite persistente local (`sysmap.db`).

## 4. Pending Backlog
- Realizar el despliegue final en el VPS de producción de Hetzner copiando las variables de entorno de producción al archivo `.env` del cliente y ejecutando `docker compose up -d --build`.
- Verificar el envío real del primer email de prueba de Resend tras configurar las firmas DKIM/SPF del dominio `@tecnoancon.com` en Cloudflare.
