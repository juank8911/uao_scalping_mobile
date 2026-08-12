/**
 * useEngineWebSocket.ts
 *
 * SINGLETON PERSISTENTE — Una sola conexión WS durante toda la sesión.
 */
import { useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useEngineStore } from '../store/useEngineStore';
import { getStatus, API_BASE_URL } from '../services/api';
// Necesitamos importar Platform si lo usamos, pero aquí usaremos la API_BASE_URL configurada

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
let currentlySubscribedSymbol: string | null = null;

// ─── Helpers internos ─────────────────────────────────────────────────────────
function getWsUrl(): string {
  // En móvil usamos el API_BASE_URL que está configurado
  const wsUrl = API_BASE_URL.replace('http', 'ws');
  return `${wsUrl}/ws/notifications`;
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
      
      // Emitir evento global para que otros hooks (ej. TradeNotifications) puedan reaccionar
      DeviceEventEmitter.emit('ws:message', payload);

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
    // ws.close(); // onclose se encarga de la reconexión. En RN, onerror y onclose suelen llamarse juntos
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

// ─── Hook de inicialización (llamar UNA SOLA VEZ desde AppNavigator) ───
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
      // Solo desconectar al desmontar la app (no suele ocurrir en RN salvo reload)
      disconnectSingleton();
    };
  }, []); // sin dependencias → se monta una sola vez
};

// ─── Hook para pantallas — solo actualiza la suscripción de símbolo ─────────────
export const useEngineWebSocket = (activeSymbol?: string | null) => {
  useEffect(() => {
    if (!activeSymbol) return;
    if (activeSymbol === currentlySubscribedSymbol) return;
    
    // Desuscribirse del símbolo anterior si existe
    if (currentlySubscribedSymbol && globalWs && globalWs.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify({ action: 'unsubscribe', symbol: currentlySubscribedSymbol }));
      console.log(`[WS] Desuscrito de: ${currentlySubscribedSymbol}`);
    }

    currentlySubscribedSymbol = activeSymbol || null;
    activeSymbolGlobal = activeSymbol || null;

    // Suscribir inmediatamente si el socket ya está abierto
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify({ action: 'subscribe', symbol: activeSymbol }));
      console.log(`[WS] Suscrito a: ${activeSymbol}`);
    }
  }, [activeSymbol]);
};

export const subscribeToSymbol = (symbol: string) => {
  console.log(`[WS] subscribeToSymbol: ${symbol}`);
};
