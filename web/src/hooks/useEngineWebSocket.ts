import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '../services/api';
import { getToken } from '../utils/auth';
import { useEngineStore } from '../store/useEngineStore';

const HEARTBEAT_MS = 25_000;
const MAX_RECONNECT_MS = 15_000;
let socket: WebSocket | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let reconnect: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let subscribedSymbol: string | null = null;
let subscribedTimeframe = '5m';
let consumers = 0;

const wsUrl = () => { const configured = import.meta.env.VITE_WS_URL as string | undefined; if (configured) return configured.replace(/\/$/, "") + "/api/v1/ws/engine"; if (API_BASE_URL.startsWith("http")) return API_BASE_URL.replace(/^http/, "ws").replace(/\/$/, "") + "/ws/engine"; return `${window.location.protocol === "https:" ? "wss" : "ws"}://localhost:8000/api/v1/ws/engine`; };
const send = (message: unknown) => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };
const stopHeartbeat = () => { if (heartbeat) { clearInterval(heartbeat); heartbeat = null; } };
const scheduleReconnect = () => { if (reconnect || consumers <= 0) return; const delay = Math.min(1000 * 2 ** reconnectAttempt++, MAX_RECONNECT_MS); reconnect = setTimeout(() => { reconnect = null; connect(); }, delay); };
const handleMessage = (raw: any) => { const event = raw?.type || raw?.event; const store = useEngineStore.getState(); if (event === 'price' && raw.symbol && raw.price != null) store.updatePrice(raw.symbol, Number(raw.price)); else if (event === 'candle_update' || event === 'candle_closed') { const candle = raw.candle || raw.data; if (candle && raw.symbol) store.updateCandle(raw.symbol, raw.timeframe || subscribedTimeframe, candle); } else if (event === 'position_update') store.updatePosition(raw.position || raw.data); else if (event === 'order_update') { const order = raw.order || raw.data; if (order) store.updateOrder(order); } else if (event === 'balance_update') store.updateBalance(raw.balance || raw.data); else if (event === 'trade') store.addTrade(raw.trade || raw.data); else if (event === 'status') store.setStatus(raw.status || raw.data || raw); else if (event === 'snapshot') store.applySnapshot(raw.data || raw.snapshot || raw); else if (event === 'connected') useEngineStore.getState().setConnected(true); else if (event === 'error') console.error('[WS]', raw.message || raw); };
const connect = () => { if (consumers <= 0 || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return; const token = getToken(); if (!token) { useEngineStore.getState().setConnected(false); return; } const url = token ? `${wsUrl()}?token=${encodeURIComponent(token)}` : wsUrl(); socket = new WebSocket(url); socket.onopen = () => { reconnectAttempt = 0; useEngineStore.getState().setConnected(true); if (subscribedSymbol) send({ action: 'subscribe', symbol: subscribedSymbol, timeframe: subscribedTimeframe }); stopHeartbeat(); heartbeat = setInterval(() => send({ action: 'ping', timestamp: Date.now() }), HEARTBEAT_MS); }; socket.onmessage = (event) => { try { handleMessage(JSON.parse(event.data)); } catch (error) { console.error('[WS] Invalid message', error); } }; socket.onerror = () => socket?.close(); socket.onclose = () => { stopHeartbeat(); socket = null; useEngineStore.getState().setConnected(false); scheduleReconnect(); }; };
const disconnect = () => { if (reconnect) { clearTimeout(reconnect); reconnect = null; } stopHeartbeat(); if (socket) { socket.onclose = null; socket.close(); socket = null; } useEngineStore.getState().setConnected(false); };
export const useEngineWebSocketInit = () => { useEffect(() => { consumers += 1; connect(); return () => { consumers -= 1; if (consumers <= 0) disconnect(); }; }, []); };
export const useEngineWebSocket = (activeSymbol?: string | null, timeframe = '5m') => { const previous = useRef<string | null>(null); useEngineWebSocketInit(); useEffect(() => { const next = activeSymbol || null; if (previous.current && previous.current !== next) send({ action: 'unsubscribe', symbol: previous.current, timeframe }); subscribedSymbol = next; subscribedTimeframe = timeframe; if (next) { if (socket?.readyState === WebSocket.OPEN) send({ action: 'subscribe', symbol: next, timeframe }); else connect(); } previous.current = next; return () => { if (next && subscribedSymbol === next) send({ action: 'unsubscribe', symbol: next, timeframe }); }; }, [activeSymbol, timeframe]); };
export const subscribeToSymbol = (symbol: string, timeframe = '5m') => { subscribedSymbol = symbol; subscribedTimeframe = timeframe; send({ action: 'subscribe', symbol, timeframe }); };
