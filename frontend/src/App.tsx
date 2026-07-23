import { useState, useEffect } from 'react';
import { List, Mail, RefreshCw, Compass, AlertCircle, Search } from 'lucide-react';
import { EventList } from './components/EventList';
import { SubscriptionForm } from './components/SubscriptionForm';

interface EventData {
  id: string;
  title: string;
  source_platform: string;
  source_url: string;
  start_time: string;
  venue_name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  tags: string[];
}

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000';
    }
    return `${protocol}//${hostname}/api`;
  }
  return 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl();

function App() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado de ingesta
  const [isIngesting, setIsIngesting] = useState(false);
  
  // Pestaña activa en móvil: 'list' | 'subscribe'
  const [activeTab, setActiveTab] = useState<'list' | 'subscribe'>('list');

  // Estados de Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | 'luma' | 'meetup' | 'eventbrite'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // 1. Recuperar eventos desde la API
  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        city: 'Buenos Aires',
        is_tech: 'true'
      });

      const response = await fetch(`${API_BASE_URL}/events?${params.toString()}`);
      if (!response.ok) {
        throw new Error('No se pudieron recuperar los eventos.');
      }
      
      const data = await response.json();
      setEvents(data);
      
      // Guardar en caché local para Offline-First
      localStorage.setItem('sysmap_events_cache', JSON.stringify(data));
    } catch (err: any) {
      console.error(err);
      setError('Error de conexión. Mostrando datos locales.');
      
      // Cargar caché local offline-first
      const cached = localStorage.getItem('sysmap_events_cache');
      if (cached) {
        setEvents(JSON.parse(cached));
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Disparar proceso de ingesta en segundo plano
  const handleTriggerIngest = async () => {
    setIsIngesting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/ingest`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error al iniciar la sincronización de eventos en el servidor.');
      }
      
      // Damos una espera de 11 segundos mientras los scrapers ejecutan secuencialmente en background.
      await new Promise(resolve => setTimeout(resolve, 11000));
      
      // Volver a consultar eventos
      await fetchEvents();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'No se pudo completar la sincronización automática de eventos.');
    } finally {
      setIsIngesting(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // 3. Filtrar eventos en caliente en el cliente (UX ultra veloz)
  const filteredEvents = events.filter(event => {
    // A. Filtrar por plataforma
    if (selectedPlatform !== 'all' && event.source_platform.toLowerCase() !== selectedPlatform) {
      return false;
    }
    
    // B. Filtrar por tag
    if (selectedTag && (!event.tags || !event.tags.includes(selectedTag))) {
      return false;
    }
    
    // C. Filtrar por texto de búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const titleMatch = event.title.toLowerCase().includes(query);
      const venueMatch = (event.venue_name || '').toLowerCase().includes(query);
      const addressMatch = (event.address || '').toLowerCase().includes(query);
      const tagsMatch = event.tags ? event.tags.some(tag => tag.toLowerCase().includes(query)) : false;
      if (!titleMatch && !venueMatch && !addressMatch && !tagsMatch) {
        return false;
      }
    }
    return true;
  });

  // 4. Extraer tags únicos en caliente de los eventos recuperados (Sugerencias dinámicas)
  const availableTags = Array.from(
    new Set(events.flatMap(event => event.tags || []))
  ).slice(0, 12);

  // Renderizar la barra de filtros unificada
  const renderFilterBar = () => {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--glass-border)'
      }}>
        {/* Buscador */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Buscar eventos por título o palabra clave..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 38px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none',
              transition: 'var(--transition-fast)'
            }}
            onFocus={(e) => e.target.style.borderColor = 'hsl(var(--primary))'}
            onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
          />
          <Search size={16} style={{
            position: 'absolute',
            left: '12px',
            top: '12px',
            color: 'var(--text-muted)'
          }} />
        </div>

        {/* Filtros por Plataforma */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', fontWeight: 500, marginRight: '4px' }}>
            Fuente:
          </span>
          <button
            onClick={() => setSelectedPlatform('all')}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: selectedPlatform === 'all' ? 'var(--bg-tertiary)' : 'transparent',
              border: selectedPlatform === 'all' ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid var(--glass-border)',
              color: selectedPlatform === 'all' ? '#fff' : 'var(--text-secondary)',
              transition: 'var(--transition-fast)'
            }}
          >
            Todos
          </button>
          <button
            onClick={() => setSelectedPlatform('luma')}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: selectedPlatform === 'luma' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              border: selectedPlatform === 'luma' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--glass-border)',
              color: selectedPlatform === 'luma' ? '#3b82f6' : 'var(--text-secondary)',
              transition: 'var(--transition-fast)'
            }}
          >
            Luma
          </button>
          <button
            onClick={() => setSelectedPlatform('meetup')}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: selectedPlatform === 'meetup' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              border: selectedPlatform === 'meetup' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--glass-border)',
              color: selectedPlatform === 'meetup' ? '#ef4444' : 'var(--text-secondary)',
              transition: 'var(--transition-fast)'
            }}
          >
            Meetup
          </button>
          <button
            onClick={() => setSelectedPlatform('eventbrite')}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: selectedPlatform === 'eventbrite' ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
              border: selectedPlatform === 'eventbrite' ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid var(--glass-border)',
              color: selectedPlatform === 'eventbrite' ? '#f97316' : 'var(--text-secondary)',
              transition: 'var(--transition-fast)'
            }}
          >
            Eventbrite
          </button>
        </div>

        {/* Filtros rápidos por Tags */}
        {availableTags.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', fontWeight: 500, flexShrink: 0 }}>
              Tecnologías:
            </span>
            <div style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              paddingBottom: '4px',
              width: '100%',
              scrollbarWidth: 'none'
            }}>
              {availableTags.map(tag => {
                const isSelected = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(isSelected ? null : tag)}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'hsl(var(--primary) / 0.2)' : 'var(--bg-secondary)',
                      border: isSelected ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid var(--glass-border)',
                      color: isSelected ? '#fff' : 'var(--text-secondary)',
                      transition: 'var(--transition-fast)'
                    }}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: 'var(--bg-primary)',
      color: '#fff'
    }}>
      {/* Header Fijo */}
      <header className="glass-panel" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid var(--glass-border)',
        zIndex: 10,
        height: '60px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h1 style={{ 
            fontSize: '1.2rem', 
            fontFamily: 'var(--font-display)', 
            fontWeight: 800,
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Compass size={18} style={{ color: 'hsl(var(--primary))' }} />
            SYSMAP
          </h1>
          <span style={{ fontSize: '0.65rem', color: 'hsl(var(--secondary))', fontWeight: 600, letterSpacing: '0.05em' }}>
            Buenos Aires Tech
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={fetchEvents}
            disabled={loading || isIngesting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              transition: 'var(--transition-fast)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            <RefreshCw size={16} className={loading || isIngesting ? 'spin-anim' : ''} style={{
              animation: loading || isIngesting ? 'spin 1.5s linear infinite' : 'none'
            }} />
          </button>
        </div>
      </header>

      {/* Cuerpo Principal */}
      <main style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        height: 'calc(100vh - 120px)'
      }}>
        {/* Layout de Escritorio (Contenedor Centrado) */}
        <div className="desktop-layout" style={{
          display: 'none',
          width: '100%',
          height: '100%',
          maxWidth: '1000px',
          margin: '0 auto',
          padding: '24px 20px',
          gap: '24px'
        }}>
          {/* Columna Izquierda: Listado de Eventos */}
          <div style={{
            flex: 1.4,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            paddingRight: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)' }}>
                Próximos Eventos en Buenos Aires
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {filteredEvents.length} de {events.length} eventos
              </span>
            </div>
            
            {error && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#fca5a5',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {renderFilterBar()}
            
            <EventList
              events={filteredEvents}
              selectedEventId={selectedEventId}
              onEventSelect={setSelectedEventId}
              onTriggerIngest={handleTriggerIngest}
              isIngesting={isIngesting}
            />
          </div>

          {/* Columna Derecha: Suscripción al Boletín */}
          <div style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto'
          }}>
            <SubscriptionForm
              apiBaseUrl={API_BASE_URL}
              latitude={null}
              longitude={null}
            />
          </div>
        </div>

        {/* Layout de Móvil (Pestañas) */}
        <div className="mobile-layout" style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '8px 16px',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 1000
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ flex: 1, position: 'relative', height: '100%' }}>
            {activeTab === 'list' && (
              <div style={{
                height: '100%',
                overflowY: 'auto',
                padding: '16px',
                paddingBottom: '80px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontFamily: 'var(--font-display)' }}>
                    Eventos Tecnológicos ({filteredEvents.length})
                  </h3>
                </div>

                {renderFilterBar()}

                <EventList
                  events={filteredEvents}
                  selectedEventId={selectedEventId}
                  onEventSelect={setSelectedEventId}
                  onTriggerIngest={handleTriggerIngest}
                  isIngesting={isIngesting}
                />
              </div>
            )}

            {activeTab === 'subscribe' && (
              <div style={{
                height: '100%',
                overflowY: 'auto',
                padding: '24px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingBottom: '80px'
              }}>
                <SubscriptionForm
                  apiBaseUrl={API_BASE_URL}
                  latitude={null}
                  longitude={null}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Nav Inferior Móvil */}
      <nav className="glass-panel mobile-nav" style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: '60px',
        borderTop: '1px solid var(--glass-border)',
        zIndex: 1000,
        backgroundColor: 'rgba(10, 14, 23, 0.9)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}>
        <button
          onClick={() => setActiveTab('list')}
          style={{
            background: 'transparent',
            border: 'none',
            color: activeTab === 'list' ? 'hsl(var(--primary))' : 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.7rem',
            fontWeight: 600,
            cursor: 'pointer',
            flex: 1,
            transition: 'var(--transition-fast)'
          }}
        >
          <div style={{ position: 'relative' }}>
            <List size={20} />
            {filteredEvents.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-8px',
                backgroundColor: 'hsl(var(--accent))',
                color: 'white',
                fontSize: '0.55rem',
                borderRadius: '50%',
                width: '14px',
                height: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700
              }}>
                {filteredEvents.length}
              </span>
            )}
          </div>
          Eventos
        </button>

        <button
          onClick={() => setActiveTab('subscribe')}
          style={{
            background: 'transparent',
            border: 'none',
            color: activeTab === 'subscribe' ? 'hsl(var(--primary))' : 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.7rem',
            fontWeight: 600,
            cursor: 'pointer',
            flex: 1,
            transition: 'var(--transition-fast)'
          }}
        >
          <Mail size={20} />
          Boletín
        </button>
      </nav>

      {/* Reglas CSS para Layout Responsivo */}
      <style>{`
        @media (min-width: 769px) {
          .desktop-layout {
            display: flex !important;
          }
          .mobile-layout, .mobile-nav {
            display: none !important;
          }
          main {
            height: calc(100vh - 60px) !important;
          }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;
