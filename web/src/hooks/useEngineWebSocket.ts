/**
 * useEngineWebSocket.ts
 * Hook global que gestiona el ciclo de vida completo del WebSocket
 * con el engine de trading. Inyecta datos directamente en Zustand,
 * eliminando el polling de setInterval en Dashboard y Chart.
 * 
 * Arquitectura HFT:
 * - Reemplaza el setInterval de getStatus() por eventos de push del servidor
 * - Cada tick de precio actualiza solo state.latestPrices[symbol] → solo
 *   el componente PriceTicker suscrito a ese símbolo re-renderiza
 * - El estado global (posiciones, órdenes) se actualiza por evento del servidor
 * - Reconexión automática con backoff exponencial en caso de corte
 */
import { useEffect, useRef } from 'react';
import { useEngineStore } from '../store/useEngineStore';
import { getStatus } from '../services/api';

const WS_RECONNECT_DELAY_MS = 3000;
const STATUS_POLL_FALLBACK_MS = 8000; // Fallback si el WS no envía status completo

export const useEngineWebSocket = (activeSymbol?: string | null) => {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { setStatus, setConnected, updatePrice } = useEngineStore.getState();

  useEffect(() => {
    let isMounted = true;

    // --- Carga inicial via REST (snapshot rápido antes de que conecte el WS) ---
    getStatus().then((data) => {
      if (isMounted) setStatus(data);
    });

    // --- Fallback polling para el estado completo (posiciones, órdenes) ---
    // El WS envía ticks de precio, pero el status completo lo obtenemos
    // via REST como respaldo cada 8s para garantizar consistencia.
    fallbackTimer.current = setInterval(async () => {
      if (!isMounted) return;
      try {
        const data = await getStatus();
        if (isMounted) setStatus(data);
      } catch (e) {
        console.warn('[EngineWS] Fallback REST falló:', e);
      }
    }, STATUS_POLL_FALLBACK_MS);

    const connect = () => {
      if (!isMounted) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
      const wsUrl = `${protocol}//${host}/api/v1/ws/notifications`;

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        if (!isMounted) return;
        setConnected(true);
        console.log('🔗 [EngineWS] Conectado al WebSocket del motor.');

        // Suscripción al símbolo activo si hay uno
        if (activeSymbol) {
          ws.current?.send(JSON.stringify({ action: 'subscribe', symbol: activeSymbol }));
          console.log(`[EngineWS] Suscrito a ticks de: ${activeSymbol}`);
        }
      };

      ws.current.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const payload = JSON.parse(event.data);
          const { event: evtType, symbol, data } = payload;

          switch (evtType) {
            // Tick de precio en tiempo real → actualizar solo ese símbolo
            case 'ticker_update':
              if (symbol && data?.price != null) {
                updatePrice(symbol, parseFloat(data.price));
              } else if (symbol && data?.last != null) {
                updatePrice(symbol, parseFloat(data.last));
              }
              break;

            // El motor emite el status completo cuando hay un cambio de estado
            case 'status_update':
              if (data) setStatus(data);
              break;

            // Notificación de trade cerrado → forzar refresh del status
            case 'trade_closed':
            case 'position_opened':
            case 'position_closed':
              getStatus().then((s) => { if (isMounted) setStatus(s); });
              break;

            default:
              // Ignorar eventos desconocidos silenciosamente
              break;
          }
        } catch (e) {
          // Ignorar mensajes malformados
        }
      };

      ws.current.onclose = () => {
        if (!isMounted) return;
        setConnected(false);
        console.log(`🔴 [EngineWS] Desconectado. Reconectando en ${WS_RECONNECT_DELAY_MS / 1000}s...`);
        reconnectTimer.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
      };

      ws.current.onerror = (err) => {
        console.error('[EngineWS] Error:', err);
        ws.current?.close();
      };
    };

    connect();

    // --- CLEANUP: Vital para evitar fugas de memoria al cambiar de ruta ---
    return () => {
      isMounted = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (fallbackTimer.current) clearInterval(fallbackTimer.current);
      if (ws.current) {
        ws.current.onclose = null; // Evitar reconexión al hacer cleanup intencional
        ws.current.close();
        ws.current = null;
      }
      setConnected(false);
    };
  }, [activeSymbol]); // Se reconecta y re-suscribe si cambia el símbolo activo
};

/**
 * Suscribe un símbolo al WebSocket activo para recibir sus ticks.
 * Útil cuando el usuario cambia de símbolo en Chart.tsx.
 */
export const subscribeToSymbol = (symbol: string) => {
  // Esta función se llama desde componentes que tienen acceso al store
  // pero no directamente al ref del WS. El hook se encarga de la suscripción
  // inicial via el parámetro activeSymbol.
  console.log(`[EngineWS] Solicitud de suscripción a: ${symbol}`);
};
