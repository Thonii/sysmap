import json
import logging
import re
from datetime import datetime
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

def scrape_eventbrite_buenos_aires() -> list[dict]:
    """
    Scrapea eventos de ciencia y tecnología de Eventbrite en Buenos Aires.
    Utiliza extracción de scripts JSON-LD para robustez frente a cambios de interfaz.
    """
    url = "https://www.eventbrite.com.ar/d/argentina--buenos-aires/science-and-tech--events/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
    }
    
    events_found = []
    
    try:
        logger.info(f"Iniciando scraping de Eventbrite: {url}")
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            response = client.get(url, headers=headers)
            
        if response.status_code != 200:
            logger.error(f"Error cargando Eventbrite: Status {response.status_code}")
            return []
            
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Buscar bloques JSON-LD
        ld_json_scripts = soup.find_all("script", type="application/ld+json")
        logger.info(f"Bloques JSON-LD encontrados en Eventbrite: {len(ld_json_scripts)}")
        
        raw_events = []
        for script in ld_json_scripts:
            try:
                if not script.string:
                    continue
                content = json.loads(script.string)
                
                # Eventbrite puede inyectar un array de eventos o un único evento
                if isinstance(content, list):
                    for item in content:
                        if isinstance(item, dict) and (item.get("@type") == "Event" or "Event" in str(item.get("@type"))):
                            raw_events.append(item)
                elif isinstance(content, dict):
                    if content.get("@type") == "Event" or "Event" in str(content.get("@type")):
                        raw_events.append(content)
                    elif content.get("@type") == "ItemList":
                        items = content.get("itemListElement", [])
                        for element in items:
                            item = element.get("item", {})
                            if isinstance(item, dict) and (item.get("@type") == "Event" or "Event" in str(item.get("@type"))):
                                raw_events.append(item)
            except Exception as e:
                logger.error(f"Error parseando script JSON-LD de Eventbrite: {e}")
                
        # Si no hay eventos JSON-LD, intentamos un fallback básico de tarjetas
        if not raw_events:
            logger.warning("No se encontraron eventos estructurados en Eventbrite. Usando fallback de tarjetas...")
            return scrape_eventbrite_cards_fallback(soup)
            
        logger.info(f"Eventos crudos estructurados encontrados en Eventbrite: {len(raw_events)}")
        
        for event_data in raw_events:
            try:
                title = event_data.get("name")
                source_url = event_data.get("url")
                
                if not title or not source_url:
                    continue
                
                # Extraer ID del evento de la URL (ej. https://www.eventbrite.com.ar/e/workshop-ia-tickets-12345678)
                match = re.search(r"-tickets-(\d+)", source_url) or re.search(r"/e/.*?(\d+)", source_url)
                source_id = match.group(1) if match else None
                
                if not source_id:
                    # Alternativa: generar un hash de la URL
                    source_id = str(hash(source_url))
                
                # Fechas
                start_str = event_data.get("startDate")
                end_str = event_data.get("endDate")
                
                start_time = None
                if start_str:
                    try:
                        clean_start = start_str.replace("Z", "+00:00")
                        start_time = datetime.fromisoformat(clean_start)
                    except ValueError:
                        continue
                        
                if not start_time:
                    continue
                    
                end_time = None
                if end_str:
                    try:
                        clean_end = end_str.replace("Z", "+00:00")
                        end_time = datetime.fromisoformat(clean_end)
                    except ValueError:
                        pass
                
                # Ubicación
                location = event_data.get("location", {})
                venue_name = "Online"
                address = "Online"
                latitude = None
                longitude = None
                
                if isinstance(location, dict):
                    venue_name = location.get("name", "A confirmar")
                    address_info = location.get("address", {})
                    if isinstance(address_info, dict):
                        address = address_info.get("streetAddress") or address_info.get("name") or venue_name
                    else:
                        address = str(address_info) or venue_name
                        
                    geo = location.get("geo", {})
                    if isinstance(geo, dict):
                        latitude = geo.get("latitude")
                        longitude = geo.get("longitude")
                
                if latitude:
                    latitude = float(latitude)
                if longitude:
                    longitude = float(longitude)
                
                description = event_data.get("description", "")
                
                events_found.append({
                    "title": title,
                    "description": description,
                    "source_platform": "eventbrite",
                    "source_id": str(source_id),
                    "source_url": source_url,
                    "start_time": start_time,
                    "end_time": end_time,
                    "venue_name": venue_name,
                    "address": address,
                    "latitude": latitude,
                    "longitude": longitude,
                    "city": "Buenos Aires",
                    "raw_data": event_data
                })
            except Exception as e:
                logger.error(f"Error procesando evento estructurado de Eventbrite: {e}")
                
    except Exception as e:
        logger.error(f"Error general scrapeando Eventbrite: {e}")
        
    return events_found

def scrape_eventbrite_cards_fallback(soup: BeautifulSoup) -> list[dict]:
    """
    Fallback para extraer información básica si falla el JSON-LD.
    """
    events = []
    # Buscar enlaces de eventos
    cards = soup.select("section.discover-horizontal-event-card") or soup.select("article")
    
    for card in cards:
        try:
            link = card.find("a")
            if not link:
                continue
            href = link.get("href", "")
            if not href or "/e/" not in href:
                continue
                
            title_el = card.find("h3") or card.find("h2")
            title = title_el.text.strip() if title_el else "Evento Eventbrite"
            
            match = re.search(r"/e/.*?(\d+)", href)
            source_id = match.group(1) if match else "hash_" + str(hash(href))
            
            events.append({
                "title": title,
                "description": "Detalles del evento en Eventbrite.",
                "source_platform": "eventbrite",
                "source_id": source_id,
                "source_url": href,
                "start_time": datetime.now(),
                "end_time": None,
                "venue_name": "Buenos Aires",
                "address": "Buenos Aires, Argentina",
                "latitude": -34.6037,
                "longitude": -58.3816,
                "city": "Buenos Aires",
                "raw_data": {"fallback_scraped": True}
            })
        except Exception as e:
            logger.error(f"Error en fallback de Eventbrite: {e}")
            
    return events
