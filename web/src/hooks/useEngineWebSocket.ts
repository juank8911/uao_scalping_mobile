/**
 * useEngineWebSocket.ts
 *
 * SINGLETON PERSISTENTE — Una sola conexión WS durante toda la sesión.
 *
 * Problemas anteriores resueltos:
 *  1. Dashboard y Chart llamaban al hook por separado → 2 sockets simultáneos
 *     que se destruían/recreaban al navegar entre páginas.
 *  2. La dependencia en [activeSymbol] destruía y recreaba el socket al cambiar
 *     símbolo, en lugar de solo enviar un nuevo "subscribe".
 *  3. Sin heartbeat, el proxy de Vite (y Nginx en producción) cerraba la
 *     conexión por inactividad → "socket hang up".
 *
 * Arquitectura nueva:
 *  - `useEngineWebSocketInit()` → llamar UNA VEZ desde PrivateRoute/App.
 *    Crea el socket global, arranca heartbeat y fallback REST.
 *  - `useEngineWebSocket(symbol)` → llamar desde páginas.
 *    Solo actualiza la suscripción de símbolo sin tocar el socket.
 */
import { useEffect, useRef } from 'react';
import { useEngineStore } from '../store/useEngineStore';
import { getStatus } from '../services/api';

// ─── Constantes ───────────────────────────────────────────────────────────────
const HEARTBEAT_MS = 25_000;          // ping cada 25s (keepalive ante proxies)
const FALLBACK_POLL_MS = 10_000;      // REST fallback cada 10s
const MAX_RECONNECT_DELAY_MS = 30_000; // techo del backoff exponencial

// ─── Estado singleton (fuera de React) ───────────────────────────────────────
let globalWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;
let reconnectDelay = 1_000;
let intentionallyClosed = false;
let activeSymbolGlobal: string | null = null;

// ─── Helpers internos ─────────────────────────────────────────────────────────
function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host =
    window.location.hostname === 'localhost'
      ? 'localhost:8000'
      : window.location.host;
  return `${protocol}//${host}/api/v1/ws/notifications`;
}

function stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

function startHeartbeat(ws: WebSocket) {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ action: 'ping' })); } catch { /* ignorar */ }
    }
  }, HEARTBEAT_MS);
}

function store() { return useEngineStore.getState(); }

// ─── Conexión singleton ───────────────────────────────────────────────────────
function connectSingleton() {
  if (intentionallyClosed) return;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  // No abrir si ya hay conexión activa/en progreso
  if (
    globalWs &&
    (globalWs.readyState === WebSocket.OPEN ||
      globalWs.readyState === WebSocket.CONNECTING)
  ) return;

  console.log(`🔌 [WS] Conectando a ${getWsUrl()}…`);
  const ws = new WebSocket(getWsUrl());
  globalWs = ws;

  ws.onopen = () => {
    console.log('🔗 [WS] Conexión establecida.');
    reconnectDelay = 1_000; // reset backoff
    store().setConnected(true);
    startHeartbeat(ws);
    if (activeSymbolGlobal) {
      ws.send(JSON.stringify({ action: 'subscribe', symbol: activeSymbolGlobal }));
    }
  };

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);

      // Emitir evento global para que otros hooks (ej. useTelegramNotifications)
      // puedan reaccionar sin abrir su propio socket
      window.dispatchEvent(new CustomEvent('ws:message', { detail: payload }));

      const { event: evtType, symbol, data } = payload;
      const { setStatus, updatePrice } = store();

      switch (evtType) {
        case 'pong': break; // respuesta al heartbeat
        case 'ticker_update':
          if (symbol && data?.price != null) updatePrice(symbol, parseFloat(data.price));
          else if (symbol && data?.last != null) updatePrice(symbol, parseFloat(data.last));
          break;
        case 'status_update':
          if (data) setStatus(data);
          break;
        case 'trade_closed':
        case 'position_opened':
        case 'position_closed':
          getStatus().then((s) => store().setStatus(s)).catch(() => {});
          break;
        default: break;
      }
    } catch { /* ignorar mensajes malformados */ }
  };

  ws.onclose = (event) => {
    stopHeartbeat();
    globalWs = null;

    if (intentionallyClosed) {
      store().setConnected(false);
      console.log('🔴 [WS] Cerrado intencionalmente.');
      return;
    }

    store().setConnected(false);
    console.warn(`🔴 [WS] Desconectado (code=${event.code}). Reconectando en ${reconnectDelay / 1000}s…`);
    reconnectTimer = setTimeout(connectSingleton, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  };

  ws.onerror = (err) => {
    console.error('[WS] Error:', err);
    ws.close(); // onclose se encarga de la reconexión
  };
}

function disconnectSingleton() {
  intentionallyClosed = true;
  stopHeartbeat();
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (globalWs) { globalWs.onclose = null; globalWs.close(); globalWs = null; }
  if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; }
  store().setConnected(false);
}

// ─── Hook de inicialización (llamar UNA SOLA VEZ desde PrivateRoute / App) ───
export const useEngineWebSocketInit = () => {
  useEffect(() => {
    intentionallyClosed = false;

    // Snapshot REST inmediato
    getStatus().then((data) => store().setStatus(data)).catch(() => {});

    // Fallback polling REST
    if (!fallbackTimer) {
      fallbackTimer = setInterval(async () => {
        try { store().setStatus(await getStatus()); } catch { /* silencio */ }
      }, FALLBACK_POLL_MS);
    }

    connectSingleton();

    return () => {
      // Solo desconectar al hacer logout / desmontar la raíz privada
      disconnectSingleton();
    };
  }, []); // sin dependencias → se monta una sola vez
};

// ─── Hook para páginas — solo actualiza la suscripción de símbolo ─────────────
export const useEngineWebSocket = (activeSymbol?: string | null) => {
  const prevSymbol = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (activeSymbol === prevSymbol.current) return;
    
    // Desuscribirse del símbolo anterior si existe
    if (prevSymbol.current && globalWs && globalWs.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify({ action: 'unsubscribe', symbol: prevSymbol.current }));
      console.log(`[WS] Desuscrito de: ${prevSymbol.current}`);
    }

    prevSymbol.current = activeSymbol;
    if (!activeSymbol) return;

    activeSymbolGlobal = activeSymbol;

    // Suscribir inmediatamente si el socket ya está abierto
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify({ action: 'subscribe', symbol: activeSymbol }));
      console.log(`[WS] Suscrito a: ${activeSymbol}`);
    }
    // Si no está abierto, onopen re-suscribirá usando activeSymbolGlobal
  }, [activeSymbol]);
};

/** @deprecated Usar useEngineWebSocket desde páginas */
export const subscribeToSymbol = (symbol: string) => {
  console.log(`[WS] subscribeToSymbol: ${symbol}`);
};
