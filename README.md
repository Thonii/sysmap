# Sysmap - Directorio Comunitario de Eventos Tech (Buenos Aires)

**Sysmap** es un agregador y directorio comunitario de eventos tecnológicos locales enfocado en Buenos Aires, Argentina. Diseñado bajo la filosofía de la **Constitución Global de TecnoAncon**, prioriza la privacidad del usuario, el aislamiento multi-tenant, la resiliencia offline-first y la token-economy en el uso de modelos de IA.

---

## 🏗️ Arquitectura y Tecnologías

El proyecto se despliega en una isla de contenedores totalmente aislada integrada a la infraestructura central orquestada por **Traefik v3.7**:

```
                              ┌────────────────────────┐
                              │  Tráfico HTTPS (Edge)  │
                              └───────────┬────────────┘
                                          │ (Cloudflare Proxy / SSL)
                                          ▼
                            ┌───────────────────────────┐
                            │   Traefik v3.7 (Proxy)    │
                            └─────────────┬─────────────┘
                                          │
                                          ▼ (Red externa: tecnoancon_gateway)
                                ┌──────────────────┐
                                │   sysmap-app     │
                                └─────────┬────────┘
                                          │
                        ┌─────────────────┴─────────────────┐
                        ▼                                   ▼
             ┌─────────────────────┐             ┌─────────────────────┐
             │   sysmap_frontend   │             │   sysmap_backend    │
             │   (Node Standalone) │             │  (FastAPI + Worker) │
             └─────────────────────┘             └──────────┬──────────┘
                                                            │
                                                            ▼ (Red Aislada)
                                                 ┌─────────────────────┐
                                                 │      sysmap_db      │
                                                 │    (PostgreSQL)     │
                                                 └─────────────────────┘
```

* **Frontend:** Single Page Application (SPA) construida con **Vite + React + TypeScript + Lucide React**. Se ejecuta en producción de forma standalone sobre un contenedor de **Node.js (serve)** en el puerto `3000`, libre de servidores web tradicionales como Nginx.
* **Backend:** API REST construida con **FastAPI (Python 3.10)** que gestiona la consulta de eventos, registros de suscripciones y enrutamientos.
* **Base de Datos:** Motor relacional **PostgreSQL 16** en producción, persistido en volúmenes Docker. En entornos de desarrollo local, si no está activo Postgres, cuenta con un **fallback automático e inmediato a SQLite local (`sysmap.db`)** para garantizar el funcionamiento.
* **Worker & Planificador:** **APScheduler** integrado dentro del proceso del backend. Se encarga de la ingestión diaria (03:00 AM) y el boletín semanal (Lunes 08:00 AM) de forma autocontenida y ligera, haciendo que el proyecto sea 100% portable sin dependencias externas complejas (como n8n).

---

## ⚡ Pilares Mandatorios y Diseño

### 1. Privacidad y Simplicidad UI (Cero Geolocalización Invasiva)
* Se eliminó por completo el popup invasivo de permisos GPS del navegador (`navigator.geolocation`). La aplicación carga de forma inmediata y directa todos los eventos tech de la zona de Buenos Aires de forma predeterminada.
* **Aesthetics:** Interfaz responsiva con enfoque primario en dispositivos móviles (`360x800px`) y distribución elegante de dos columnas en escritorio (ancho máx. 1000px). Utiliza un sistema de diseño Solarpunk oscuro basado en variables HSL, micro-animaciones y efectos de glassmorphic.
* **Enlaces Externos:** Se descartaron los mapas nativos (Leaflet.js) en el frontend para maximizar la velocidad de carga. Cada tarjeta incluye accesos directos al sitio oficial del evento ("Registrarse") y un enlace externo a Google Maps resolviendo la dirección en texto plano ("Cómo llegar").

### 2. Ingesta y Clasificación Semántica (Token-Economy)
El pipeline automatizado de ingesta secuencia scrapers en tiempo real para:
* **Luma:** Extracción y parseo del bloque JSON de Next.js (`__NEXT_DATA__`) adaptado a las actualizaciones de estructura de `luma.com`.
* **Meetup y Eventbrite:** Extracción estructurada nativa de JSON-LD Schema.org.

#### Pipeline de Clasificación Semántica:
Para minimizar costos de API de IA y optimizar el consumo de tokens, el clasificador opera en tres niveles:
1. **Filtro Heurístico Local:** Compara palabras clave de descarte o confirmación tecnológica localmente (costo $0).
2. **Caché Semántica en Base de Datos:** Si el evento ya se procesó previamente, recupera la decisión de la tabla `cache_ia` a costo cero.
3. **Gemini 1.5 Flash (Respaldo):** Solo en caso de ambigüedad en los filtros heurísticos, consulta al modelo de Google para confirmar la clasificación del evento, persistiendo de inmediato la respuesta en la base de datos.

### 3. Boletines y Emails Transaccionales (Resend)
* **Boletín Semanal (Agenda Técnica):** Cada **lunes a las 08:00 AM**, el planificador compila los eventos de la semana entrante en Buenos Aires y envía un correo responsivo HTML premium a los suscriptores activos.
* **Email de Bienvenida Inmediato:** Al registrar una nueva suscripción, FastAPI dispara una tarea en segundo plano que envía un correo de bienvenida inmediato con un resumen de los eventos destacados más cercanos.
* **Desuscripción en 1 Clic:** Las plantillas incluyen un enlace dinámico que llama a `GET /subscriptions/unsubscribe` desactivando la suscripción instantáneamente en la base de datos.

---

## 🚀 Guía de Despliegue y Ejecución en Local

### Desarrollo en Local

1. **Clonar e instalar dependencias:**
   ```bash
   # Backend
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   
   # Frontend
   cd ../frontend
   npm install
   ```

2. **Configurar el archivo `.env` en `backend/`:**
   ```env
   DATABASE_URL=postgresql://sysmap_user:sysmap_password_local_2026@localhost:5432/sysmap
   GEMINI_API_KEY=tu_api_key_gemini
   RESEND_API_KEY=tu_api_key_resend
   PORT=8000
   ```
   *Nota: Si no posees una base de datos Postgres corriendo localmente, la aplicación iniciará automáticamente una base de datos local SQLite `sysmap.db` en la carpeta backend.*

3. **Ejecutar en Local:**
   * **Backend:** `uvicorn app.main:app --reload`
   * **Frontend:** `npm run dev`
   * Abre tu navegador en `http://localhost:5173`.

---

## 🚀 Despliegue en Producción (Ecosistema Multi-Tenant)

### Paso 1: Configurar Variables en el VPS
Crea el archivo `.env` en la carpeta del cliente en `/root/clientes/sysmap-app/` en tu VPS configurando los secretos reales:
```env
SYSMAP_HOST=sysmap.tecnoancon.com
POSTGRES_DB=sysmap
POSTGRES_USER=sysmap_user
POSTGRES_PASSWORD=una_clave_segura_2026
GEMINI_API_KEY=tu_api_key_gemini
RESEND_API_KEY=tu_api_key_resend
```

### Paso 2: Levantar el Orquestador
Levanta la aplicación en segundo plano. Traefik autodetectará las etiquetas, resolverá el enrutamiento relativo y compilará la SPA de Node:
```bash
docker compose up -d --build
```
