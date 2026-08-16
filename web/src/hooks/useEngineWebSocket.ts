import { useEffect } from 'react';
import { API_BASE_URL } from '../services/api';
import { getToken } from '../utils/auth';
import { useEngineStore } from '../store/useEngineStore';

const HEARTBEAT_MS = 25_000;
const MAX_RECONNECT_MS = 15_000;

let socket: WebSocket | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let reconnect: ReturnType<typeof setTimeout> | null = null;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let consumers = 0;
let subscribedSymbol: string | null = null;
let subscribedTimeframe = '5m';

const wsUrl = () => {
  const configured = import.meta.env.VITE_WS_URL as string | undefined;
  const base = configured || API_BASE_URL;
  if (base.startsWith('http')) {
    const normalized = base.replace(/^http/, 'ws').replace(/\/$/, '');
    return normalized.endsWith('/api/v1') ? `${normalized}/ws/engine` : `${normalized}/api/v1/ws/engine`;
  }
  const normalized = base.replace(/\/$/, '');
  return normalized.endsWith('/api/v1') ? `${normalized}/ws/engine` : `${normalized}/api/v1/ws/engine`;
};

const send = (message: unknown) => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
};

const stopHeartbeat = () => {
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
};

const startHeartbeat = () => {
  stopHeartbeat();
  heartbeat = setInterval(() => send({ action: 'ping' }), HEARTBEAT_MS);
};

const dispatchWsMessage = (raw: any) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ws:message', { detail: raw }));
  }
};

const handleMessage = (raw: any) => {
  const event = raw?.type || raw?.event;
  const store = useEngineStore.getState();
  dispatchWsMessage(raw);

  if (event === 'price' && raw.symbol && raw.price != null) {
    store.updatePrice(raw.symbol, Number(raw.price));
  } else if (event === 'ticker_update') {
    const ticker = raw.data || {};
    const price = Number(ticker.last ?? ticker.price ?? raw.price);
    if (raw.symbol && Number.isFinite(price) && price > 0) {
      store.updatePrice(raw.symbol, price);
    }
  } else if (event === 'candle_update' || event === 'candle_closed') {
    const candle = raw.candle || raw.data;
    if (candle && raw.symbol) store.updateCandle(raw.symbol, raw.timeframe || subscribedTimeframe, candle);
  } else if (event === 'position_update') {
    store.updatePosition(raw.position || raw.data);
  } else if (event === 'order_update') {
    const order = raw.order || raw.data;
    if (order) store.updateOrder(order);
  } else if (event === 'balance_update') {
    store.updateBalance(raw.balance || raw.data);
  } else if (event === 'trade') {
    store.addTrade(raw.trade || raw.data);
  } else if (event === 'status') {
    store.setStatus(raw.status || raw.data || raw);
  } else if (event === 'snapshot') {
    store.applySnapshot(raw.data || raw.snapshot || raw);
  } else if (event === 'connected') {
    store.setConnected(true);
    if (subscribedSymbol) send({ action: 'subscribe', symbol: subscribedSymbol, timeframe: subscribedTimeframe });
  } else if (event === 'error') {
    console.error('[WS]', raw.message || raw);
  }
};

const scheduleReconnect = () => {
  if (reconnect || consumers <= 0) return;
  const delay = Math.min(1000 * 2 ** reconnectAttempt++, MAX_RECONNECT_MS);
  reconnect = setTimeout(() => {
    reconnect = null;
    connect();
  }, delay);
};

const connect = () => {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  const token = getToken();
  if (!token) {
    useEngineStore.getState().setConnected(false);
    return;
  }

  socket = new WebSocket(`${wsUrl()}?token=${encodeURIComponent(token)}`);
  socket.onopen = () => {
    reconnectAttempt = 0;
    startHeartbeat();
    useEngineStore.getState().setConnected(true);
    if (subscribedSymbol) send({ action: 'subscribe', symbol: subscribedSymbol, timeframe: subscribedTimeframe });
  };
  socket.onmessage = (message) => {
    try {
      handleMessage(JSON.parse(message.data));
    } catch (error) {
      console.error('[WS] Invalid message', error);
    }
  };
  socket.onerror = () => useEngineStore.getState().setConnected(false);
  socket.onclose = () => {
    stopHeartbeat();
    socket = null;
    useEngineStore.getState().setConnected(false);
    scheduleReconnect();
  };
};

const scheduleDisconnect = () => {
  if (disconnectTimer) clearTimeout(disconnectTimer);
  disconnectTimer = setTimeout(() => {
    disconnectTimer = null;
    if (consumers > 0) return;
    if (reconnect) {
      clearTimeout(reconnect);
      reconnect = null;
    }
    stopHeartbeat();
    if (socket) {
      socket.onclose = null;
      socket.close();
      socket = null;
    }
    useEngineStore.getState().setConnected(false);
  }, 500);
};

export const subscribeToSymbol = (symbol: string, timeframe = '5m') => {
  subscribedSymbol = symbol;
  subscribedTimeframe = timeframe;
  send({ action: 'subscribe', symbol, timeframe });
};

export const unsubscribeFromSymbol = (symbol?: string) => {
  if (!symbol || subscribedSymbol === symbol) {
    if (subscribedSymbol) send({ action: 'unsubscribe', symbol: subscribedSymbol });
    subscribedSymbol = null;
  }
};

export const useEngineWebSocketInit = () => {
  useEffect(() => {
    consumers += 1;
    connect();
    return () => {
      consumers = Math.max(0, consumers - 1);
      scheduleDisconnect();
    };
  }, []);
};

export const useEngineWebSocket = (symbol?: string | null, timeframe = '5m') => {
  useEffect(() => {
    consumers += 1;
    connect();
    if (symbol) subscribeToSymbol(symbol, timeframe);
    return () => {
      consumers = Math.max(0, consumers - 1);
      if (symbol) unsubscribeFromSymbol(symbol);
      scheduleDisconnect();
    };
  }, [symbol, timeframe]);
};
