import hashlib
import json
import logging
import google.generativeai as genai
from sqlalchemy.orm import Session
from app.config import GEMINI_API_KEY
from app.models.event import IACache

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configurar API de Gemini
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Listas de palabras clave para clasificación heurística local
TECH_KEYWORDS = [
    "python", "javascript", "typescript", "react", "vue", "angular", "node", "backend", "frontend",
    "devops", "docker", "kubernetes", "aws", "gcp", "azure", "cloud", "machine learning", "deep learning",
    "inteligencia artificial", "ia", "ai", "datascience", "ciencia de datos", "sql", "postgresql",
    "mongodb", "rust", "golang", "java", "kotlin", "swift", "flutter", "react native", "api", "git",
    "github", "blockchain", "ciberseguridad", "cybersecurity", "security", "agile", "scrum",
    "ux", "ui", "product management", "qa", "testing", "microservicios", "linux", "programming",
    "programacion", "desarrollo", "software", "tecnologia", "web3", "copilot", "llm", "prompt engineering"
]

NON_TECH_KEYWORDS = [
    "yoga", "meditacion", "salsa", "bachata", "futbol", "canto", "teatro", "cocina", "gastronomia",
    "ingles conversacional", "idiomas", "finanzas personales", "inversiones inmobiliarias",
    "bienes raices", "terapia", "astrologia", "tarot", "psicologia", "autoayuda", "cuidado de la piel",
    "maquillaje", "moda", "costura", "ciclismo", "maraton", "fitness", "crossfit", "baile"
]

def clean_text(text: str) -> str:
    if not text:
        return ""
    return text.lower().strip()

def heuristic_classify(title: str, description: str) -> tuple[bool | None, list[str]]:
    """
    Clasifica el evento de forma local usando palabras clave heurísticas.
    Retorna (is_tech, tags) si se puede clasificar localmente, o (None, []) si es dudoso.
    """
    title_clean = clean_text(title)
    desc_clean = clean_text(description)
    
    # 1. Comprobar palabras que descartan tecnología de forma contundente
    for keyword in NON_TECH_KEYWORDS:
        if keyword in title_clean:
            # Si el título tiene algo muy no-tech, descartar inmediatamente
            logger.info(f"Heurística NO-TECH detectada en título: '{keyword}' para '{title}'")
            return False, []

    # 2. Comprobar palabras de tecnología contundentes
    matched_tags = []
    for keyword in TECH_KEYWORDS:
        # Se verifica en título o si se menciona frecuentemente en descripción
        if keyword in title_clean or (len(keyword) > 3 and desc_clean.count(keyword) >= 2):
            matched_tags.append(keyword)

    if matched_tags:
        logger.info(f"Heurística TECH detectada: {matched_tags} para '{title}'")
        return True, matched_tags

    # Si no coincide con nada obvio, queda en duda (None)
    return None, []

def get_hash(text: str) -> str:
    """Genera un hash md5 único para el texto."""
    return hashlib.md5(text.encode("utf-8")).hexdigest()

def get_cached_classification(db: Session, text_hash: str) -> dict | None:
    """Busca una clasificación previa en caché."""
    cached = db.query(IACache).filter(IACache.key == text_hash).first()
    if cached:
        logger.info("Clasificación recuperada de la CACHÉ local (Costo 0)")
        return cached.value
    return None

def save_to_cache(db: Session, text_hash: str, value: dict):
    """Guarda la clasificación en caché."""
    try:
        new_cache = IACache(key=text_hash, value=value)
        db.add(new_cache)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error guardando caché IA: {e}")

def classify_event_with_ia(title: str, description: str) -> dict:
    """
    Llama a Gemini 1.5 Flash para clasificar el evento y extraer tags.
    """
    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY no configurada. Clasificando como NO-TECNOLÓGICO por seguridad.")
        return {"is_tech": False, "tags": [], "reason": "No API Key configured"}

    prompt = f"""
    Evalúa si el siguiente evento pertenece al nicho de tecnología, programación, desarrollo de software, startups de base tecnológica, diseño UX/UI o gestión de productos digitales.
    
    Título: {title}
    Descripción: {description[:1000]}
    
    Responde estrictamente en formato JSON válido con los siguientes campos:
    - is_tech (boolean): true si es un evento tecnológico, false de lo contrario.
    - tags (array de strings): hasta 4 tags tecnológicos aplicables (ej: "Python", "React", "AI", "UX/UI"). Si is_tech es false, el array debe estar vacío.
    - reason (string): breve explicación de 1 frase en español.
    """

    try:
        model = genai.GenerativeModel(
            'gemini-1.5-flash',
            generation_config={"response_mime_type": "application/json"}
        )
        response = model.generate_content(prompt)
        result = json.loads(response.text)
        return result
    except Exception as e:
        logger.error(f"Error llamando a la API de Gemini: {e}")
        # En caso de error de API, por seguridad no descartamos
        return {"is_tech": True, "tags": ["tecnologia"], "reason": f"API Error fallback: {str(e)}"}

def process_and_classify_event(db: Session, title: str, description: str) -> tuple[bool, list[str]]:
    """
    Pipeline principal de clasificación:
    1. Heurística local (Costo 0).
    2. Si hay duda, buscar en caché de base de datos (Costo 0).
    3. Si no está en caché, llamar a Gemini 1.5 Flash y persistir resultado.
    """
    # 1. Heurística
    is_tech, tags = heuristic_classify(title, description)
    if is_tech is not None:
        return is_tech, tags

    # 2. Generar hash y verificar caché
    text_to_hash = f"{title}|||{description or ''}"
    text_hash = get_hash(text_to_hash)
    
    cached_result = get_cached_classification(db, text_hash)
    if cached_result:
        return cached_result.get("is_tech", True), cached_result.get("tags", [])

    # 3. Clasificación con IA
    logger.info(f"Llamando a Gemini 1.5 Flash para clasificar: '{title}'")
    ia_result = classify_event_with_ia(title, description)
    
    # Guardar en caché
    save_to_cache(db, text_hash, ia_result)
    
    return ia_result.get("is_tech", True), ia_result.get("tags", [])
