import os
from dotenv import load_dotenv

# Cargar variables de entorno del archivo .env si existe
load_dotenv()

# Configuración Base de Datos
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://sysmap_user:sysmap_password_local_2026@localhost:5432/sysmap")

# APIs
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")

# Configuración Geográfica de Búsqueda (Foco exclusivo en Buenos Aires para el MVP)
DEFAULT_CITY = "Buenos Aires"
DEFAULT_LATITUDE = -34.603722
DEFAULT_LONGITUDE = -58.381592
DEFAULT_RADIUS_KM = 15.0

# Rate limits y demoras en scrapers
SCRAPER_REQUEST_DELAY_SECONDS = 2
