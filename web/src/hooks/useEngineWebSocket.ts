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
import { useEffect } from 'react';
import { useEngineStore, type Candle } from '../store/useEngineStore';
import { getStatus } from '../services/api';
import { getToken } from '../utils/auth';

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
let currentCandleSubscription: { symbol: string; timeframe: string; source: 'HFT' | 'TELEGRAM' } | null = null;

// ─── Helpers internos ─────────────────────────────────────────────────────────
function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host =
    window.location.hostname === 'localhost'
      ? 'localhost:8000'
      : window.location.host;
  const token = getToken() || '';
  return `${protocol}//${host}/ws/engine?token=${encodeURIComponent(token)}`;
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
    if (currentCandleSubscription) {
      ws.send(JSON.stringify({
        action: 'subscribe_candles',
        symbol: currentCandleSubscription.symbol,
        timeframe: currentCandleSubscription.timeframe,
        source: currentCandleSubscription.source,
      }));
    }
  };

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);

      // Emitir evento global para que otros hooks puedan reaccionar
      window.dispatchEvent(new CustomEvent('ws:message', { detail: payload }));

      const type = payload.type || payload.event;
      const { setSnapshot, setStatus, updatePrice, setCandlesSnapshot, updateCandle } = store();

      if (type === 'snapshot') {
        if (payload.data) {
          setSnapshot(payload.data);
        }
        return;
      }

      if (type === 'candles_snapshot') {
        if (Array.isArray(payload.candles)) {
          setCandlesSnapshot(payload.candles);
        }
        return;
      }

      if (type === 'candle_update') {
        const candleData = payload.data || payload.candle;
        if (candleData) {
          if (Array.isArray(candleData)) {
            candleData.forEach((c: Candle) => updateCandle(c));
          } else {
            updateCandle(candleData);
          }
        }
        return;
      }

      const { symbol, data } = payload;
      switch (type) {
        case 'pong': break; // respuesta al heartbeat
        case 'ticker_update':
          if (symbol && data?.price != null) updatePrice(symbol, parseFloat(data.price));
          else if (symbol && data?.last != null) updatePrice(symbol, parseFloat(data.last));
          else if (symbol && data?.close != null) updatePrice(symbol, parseFloat(data.close));
          else if (payload.price != null && symbol) updatePrice(symbol, parseFloat(payload.price));
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
    // Si no está abierto, onopen re-suscribirá usando activeSymbolGlobal
  }, [activeSymbol]);
};

export const subscribeCandles = (symbol: string, timeframe: string, source: 'HFT' | 'TELEGRAM') => {
  currentCandleSubscription = { symbol, timeframe, source };
  if (globalWs && globalWs.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify({
      action: 'subscribe_candles',
      symbol,
      timeframe,
      source,
    }));
    console.log(`[WS] Suscrito a velas de ${symbol} (${timeframe}, ${source})`);
  }
};

export const unsubscribeCandles = (symbol: string, source: 'HFT' | 'TELEGRAM') => {
  if (currentCandleSubscription?.symbol === symbol) {
    currentCandleSubscription = null;
  }
  if (globalWs && globalWs.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify({
      action: 'unsubscribe_candles',
      symbol,
      source,
    }));
    console.log(`[WS] Desuscrito de velas de ${symbol} (${source})`);
  }
};

/** @deprecated Usar useEngineWebSocket desde páginas */
export const subscribeToSymbol = (symbol: string) => {
  console.log(`[WS] subscribeToSymbol: ${symbol}`);
};
