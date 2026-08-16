import { getToken, deleteToken, saveToken } from '../utils/auth';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');
export const BASE_URL = `${API_BASE_URL}/control`;

export interface Candle { time: any; open: number; high: number; low: number; close: number; volume: number; closed?: boolean; }
export interface OrderInfo { id?: string | number; symbol: string; side?: string; type?: string; status?: string; price?: number; quantity?: number; filled_quantity?: number; [key: string]: any; }
export interface PositionInfo { symbol: string; side?: string; quantity?: number; entry_price?: number; mark_price?: number; pnl?: number; unrealized_pnl?: number; tp_price?: number; sl_price?: number; currentMarkPrice?: number; entryPrice?: number; contracts?: number; orders?: OrderInfo[]; [key: string]: any; }
export interface SystemStatus { engine_status?: string; system_status?: string; balance?: number; equity?: number; available_balance?: number; unrealized_pnl?: number; realized_pnl?: number; open_positions?: PositionInfo[]; open_orders?: OrderInfo[]; latest_prices?: Record<string, number>; [key: string]: any; }
export interface UpdateConfig { max_concurrent_trades?: number; min_profit_target_usdt?: number; max_drawdown_usdt?: number; leverage?: number; investment_amount_usdt?: number; execution_mode?: string; [key: string]: any; }
export interface ConfigResponse extends UpdateConfig { [key: string]: any; }
export interface CredentialResponse { id?: number | string; user_id?: number | string; exchange_id: string; environment: string; uid?: string; is_active: boolean; [key: string]: any; }
export interface GlobalTradeRecord { symbol: string; side: string; entry_price: number; exit_price?: number; tp_price?: number; sl_price?: number; pnl: number; closed_at?: string; leverage?: number; [key: string]: any; }

const jsonHeaders = { 'Content-Type': 'application/json' };

async function fetchWithAuth<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) { deleteToken(); window.dispatchEvent(new CustomEvent('auth:required')); window.dispatchEvent(new CustomEvent('unauthorized')); throw new Error('Unauthorized'); }
  const text = await response.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!response.ok) throw new Error(data?.detail || data?.message || `HTTP ${response.status}`);
  return data as T;
}

export const login = async (username: string, password: string) => {
  const body = new URLSearchParams({ username, password });
  const response = await fetch(`${API_BASE_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.detail || 'Login failed');
  if (data.access_token) saveToken(data.access_token);
  return data;
};
export const refreshToken = () => fetchWithAuth(`${API_BASE_URL}/auth/refresh`, { method: 'POST' });
export const logout = async () => { try { await fetchWithAuth(`${API_BASE_URL}/auth/logout`, { method: 'POST' }); } finally { deleteToken(); } };
export const getCurrentUser = () => fetchWithAuth(`${API_BASE_URL}/auth/me`);

export const getStatus = () => fetchWithAuth<SystemStatus>(`${BASE_URL}/status`);
export const getConfig = () => fetchWithAuth<ConfigResponse>(`${BASE_URL}/config`);
export const updateConfig = (config: UpdateConfig) => fetchWithAuth(`${BASE_URL}/config`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(config) });
export const startEngine = () => fetchWithAuth(`${BASE_URL}/start`, { method: 'POST', headers: jsonHeaders });
export const stopEngine = () => fetchWithAuth(`${BASE_URL}/stop`, { method: 'POST', headers: jsonHeaders });
export const restartEngine = () => fetchWithAuth(`${BASE_URL}/restart`, { method: 'POST', headers: jsonHeaders });
export const getHealth = () => fetchWithAuth(`${BASE_URL}/health`);

const query = (params: Record<string, string | number | undefined>) => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();
export const getTicker = (symbol: string) => fetchWithAuth(`${API_BASE_URL}/market/ticker?${query({ symbol })}`);
export const getSymbols = () => fetchWithAuth(`${API_BASE_URL}/market/symbols`);
export const getTimeframes = () => fetchWithAuth(`${API_BASE_URL}/market/timeframes`);
export const fetchChartData = async (symbol: string, timeframe = '5m', limit = 500): Promise<any[]> => { const data = await fetchWithAuth<any>(`${BASE_URL}/chart/ohlcv?${query({ symbol, timeframe, limit })}`); return data?.data || data || []; };
export const fetchChartTrades = async (symbol: string): Promise<any[]> => { const data = await fetchWithAuth<any>(`${BASE_URL}/chart/trades?${query({ symbol })}`); return data?.data || data || []; };
export const fetchChartHistory = async (symbol: string): Promise<any[]> => { const data = await fetchWithAuth<any>(`${BASE_URL}/chart/history?${query({ symbol })}`); return data?.data || data || []; };

export const getPositions = () => fetchWithAuth<PositionInfo[]>(`${BASE_URL}/positions`);
export const getPosition = (symbol: string) => fetchWithAuth<PositionInfo>(`${BASE_URL}/positions/${encodeURIComponent(symbol)}`);
export const getOrders = () => fetchWithAuth<OrderInfo[]>(`${BASE_URL}/orders`);
export const getOrder = (orderId: string | number) => fetchWithAuth<OrderInfo>(`${BASE_URL}/orders/${encodeURIComponent(String(orderId))}`);
export const cancelOrder = (orderId: string | number) => fetchWithAuth(`${BASE_URL}/orders/${encodeURIComponent(String(orderId))}/cancel`, { method: 'POST', headers: jsonHeaders });
export const cancelAllOrders = () => fetchWithAuth(`${BASE_URL}/orders/cancel-all`, { method: 'POST', headers: jsonHeaders });
export const closePosition = (symbol: string) => fetchWithAuth(`${BASE_URL}/close-position`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ symbol }) });

export const getBalance = () => fetchWithAuth(`${BASE_URL}/balance`);
export const getBalanceHistory = () => fetchWithAuth(`${BASE_URL}/balance/history`);
export const getGlobalHistory = async (limit = 20, mode?: string): Promise<{ data: GlobalTradeRecord[] }> => {
  const data = await fetchWithAuth<any>(`${BASE_URL}/history?${query({ limit, mode })}`, { cache: 'no-store' });
  return { data: Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [] };
};
export const resetPaperBalance = () => fetchWithAuth(`${BASE_URL}/paper_balance/reset`, { method: 'POST', headers: jsonHeaders });

export const getCredentials = () => fetchWithAuth<CredentialResponse[]>(`${API_BASE_URL}/credentials`);
export const saveCredentials = (exchange_id: string, environment: string, api_key: string, api_secret: string, passphrase?: string) => fetchWithAuth<CredentialResponse>(`${API_BASE_URL}/credentials`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ exchange_id, environment, api_key, api_secret, passphrase, is_active: true }) });
export const updateCredentials = (id: string | number, payload: Partial<CredentialResponse>) => fetchWithAuth(`${API_BASE_URL}/credentials/${id}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(payload) });
export const deleteCredentials = (id: string | number) => fetchWithAuth(`${API_BASE_URL}/credentials/${id}`, { method: 'DELETE' });
export const validateCredentials = (id: string | number) => fetchWithAuth(`${API_BASE_URL}/credentials/${id}/validate`, { method: 'POST', headers: jsonHeaders });

export const apiFetchTelegram = (path: string, options: RequestInit = {}) => fetchWithAuth(`${API_BASE_URL}/telegram${path.startsWith('/') ? path : `/${path}`}`, options);
export { fetchWithAuth };
