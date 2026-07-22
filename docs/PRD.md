# PRD: Agregador de Eventos Tecnológicos Locales (MVP)

## 1. Visión General y Objetivo
Construir una herramienta comunitaria que unifique la información fragmentada de eventos tecnológicos. El sistema debe extraer, filtrar y normalizar datos de múltiples plataformas aisladas (como Meetup, Eventbrite, Luma) para proveer un directorio centralizado e interactivo, ordenado por fecha y proximidad geográfica.

## 2. Requerimientos Funcionales (El "Qué")
*   **Motor de Ingestión Dinámica:** El sistema debe aceptar parámetros de ubicación (ciudad o coordenadas) y rangos de fecha para rastrear y extraer eventos en la red de forma automatizada.
*   **Filtrado Semántico y Normalización:** Un pipeline de procesamiento que evalúe la data cruda, clasifique y elimine los eventos que no pertenezcan al nicho tecnológico. La data limpia debe unificarse bajo un esquema estándar (Título, Fecha, Coordenadas, Enlace, Descripción).
*   **Directorio Interactivo (Frontend):** Interfaz enfocada en una experiencia *mobile-first*. Debe incluir un listado cronológico de los próximos eventos y un mapa interactivo para visualización por ubicación.
*   **Módulo de Distribución:** Capacidad de almacenar suscripciones simples para ejecutar un flujo de automatización que envíe boletines periódicos (ej. un top 3 semanal de eventos cercanos).

## 3. Directrices de Arquitectura (Para los Agentes)
*   **Autonomía de Selección:** Analicen nuestro contexto de infraestructura actual y propongan el stack más eficiente para este MVP. Definan qué módulos se resolverán mediante flujos visuales (nodos de automatización), qué requerirá scripts a medida para extracción de datos y el stack del frontend.
*   **Despliegue Local y Privacidad:** Por defecto, todas las piezas de procesamiento lógico, orquestación y modelos de filtrado deben apuntar a una configuración de despliegue local para maximizar la privacidad y el control de la información.
*   **Mantenimiento de Estado:** Todas las decisiones arquitectónicas, dependencias y esquemas de base de datos definidos en esta fase deben registrarse obligatoriamente en el archivo `AI_CONTEXT.md` del proyecto para mantener la coherencia.

## 4. Entregables Esperados
Analicen estos requerimientos frente a nuestros recursos disponibles y generen:
1. Una propuesta arquitectónica (diagrama lógico de componentes).
2. El esquema inicial de la base de datos para la unificación de los eventos.
