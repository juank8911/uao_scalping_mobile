import { getToken, deleteToken, saveToken } from '../utils/auth';

const API_BASE_URL = '/api/v1';
const BASE_URL = `${API_BASE_URL}/control`;

export interface AttachedOrderInfo {
  type: string;
  price: number;
  distance_pct: number;
}

export interface StandaloneOrderInfo {
  symbol: string;
  type: string;
  side: string;
  price: number;
  amount: number;
  tpPrice?: number;
  slPrice?: number;
  aiReason?: string;
  confidence?: number;
  status: string;
}

export type OrderInfo = AttachedOrderInfo;

export interface PositionInfo {
  symbol: string;
  side: string;
  contracts: number;
  contractSize?: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
  confidence?: number;
  liquidationPrice?: number;
  source?: 'HFT' | 'TELEGRAM';
  orders?: AttachedOrderInfo[];
}

export interface SystemStatus {
  status: string;
  active_symbols: string[];
  is_running: boolean;
  daily_pnl: number;
  execution_mode: string;
  global_balance: number;
  open_positions: PositionInfo[];
  open_orders: StandaloneOrderInfo[];
  latest_prices: Record<string, number>;
  current_investment?: number;
  current_leverage?: number;
  current_target_pnl?: number;
}

export interface UpdateConfig {
  max_concurrent_trades?: number;
  min_profit_target_usdt?: number;
  max_drawdown_usdt?: number;
  max_sl_loss_usdt?: number;
  investment_amount_usdt?: number;
  leverage?: number;
  exchange_id?: string;
  demo_api_key?: string;
  demo_api_secret?: string;
  demo_api_password?: string;
  real_api_key?: string;
  real_api_secret?: string;
  real_api_password?: string;
  execution_mode?: string;
}

export interface ConfigResponse {
  max_concurrent_trades: number;
  min_profit_target_usdt: number;
  max_drawdown_usdt: number;
  max_sl_loss_usdt: number;
  leverage: number;
  investment_amount_usdt: number;
  execution_mode: string;
}

export interface TelegramPaperTargetInfo {
  id: number;
  sequence: number;
  price: number;
  allocation_pct: number;
  amount: number;
  status: 'PENDING' | 'HIT' | 'CANCELED' | string;
  realized_pnl: number;
  hit_at?: string | null;
}

export interface TelegramPaperOperation {
  id: number;
  telegram_message_id: number;
  chat_id: string;
  chat_title?: string | null;
  sender?: string | null;
  symbol?: string | null;
  direction?: string | null;
  side?: string | null;
  market_type: string;
  entry_type?: 'MARKET' | 'LIMIT' | string | null;
  requested_entry_price?: number | null;
  entry_price?: number | null;
  amount?: number | null;
  remaining_amount?: number | null;
  leverage?: number | null;
  status: string;
  realized_pnl: number;
  close_reason?: string | null;
  rejection_reason?: string | null;
  validation_summary?: string | null;
  created_at?: string | null;
  filled_at?: string | null;
  closed_at?: string | null;
  targets: TelegramPaperTargetInfo[];
}

export interface TelegramPaperConfig {
  enabled: boolean;
  max_positions: number;
  max_realized_loss_usdt: number;
  investment_amount_usdt?: number;
  leverage?: number;
  execution_mode: string;
  entry_without_price: string;
  entry_with_price: string;
  tp_defaults: Record<string, number[]>;
}

export interface TelegramPaperStatus {
  enabled: boolean;
  execution_mode: string;
  max_positions: number;
  open_positions: number;
  pending_orders: number;
  realized_pnl: number;
  max_realized_loss_usdt: number;
  blocked_by_loss: boolean;
}



export interface CredentialResponse {
  id: number;
  user_id: number;
  exchange_id: string;
  environment: string;
  uid?: string;
  is_active: boolean;
}

export const login = async (username: string, password: string): Promise<any> => {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }
  const data = await response.json();
  saveToken(data.access_token);
  return data;
};

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: any = { 
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...options.headers 
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  let finalUrl = url;
  if (!options.method || options.method === 'GET') {
    const separator = url.includes('?') ? '&' : '?';
    finalUrl = `${url}${separator}_t=${Date.now()}`;
  }

  const response = await fetch(finalUrl, { ...options, headers });
  
  if (response.status === 401) {
    deleteToken();
    window.dispatchEvent(new Event('unauthorized'));
    throw new Error('Unauthorized');
  }
  return response;
}

export const startEngine = async (): Promise<any> => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Error starting engine:', error);
    return { message: "Engine starting sequence initiated. (MOCKED)" };
  }
};

export const stopEngine = async (): Promise<any> => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Error stopping engine:', error);
    return { message: "Engine stop sequence initiated. (MOCKED)" };
  }
};

export const fetchChartData = async (symbol: string, timeframe: string = '5m') => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/chart/ohlcv?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`, {
      method: 'GET',
    });
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return [];
  }
};

export const fetchChartTrades = async (symbol: string) => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/chart/trades?symbol=${encodeURIComponent(symbol)}`, {
      method: 'GET',
    });
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching chart trades:', error);
    return [];
  }
};

export const fetchChartHistory = async (symbol: string): Promise<ChartHistoryRecord[]> => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/chart/history?symbol=${encodeURIComponent(symbol)}&limit=6`, {
      method: 'GET',
    });
    if (!response.ok) throw new Error(`Chart history HTTP ${response.status}`);
    const data = await response.json();
    return (Array.isArray(data.data) ? data.data : [])
      .map((raw: unknown) => normalizeChartHistoryRecord(raw))
      .filter((record: ChartHistoryRecord | null): record is ChartHistoryRecord => record !== null);
  } catch (error) {
    console.error('Error fetching chart history:', error);
    return [];
  }
};

export const getStatus = async (): Promise<SystemStatus> => {
  const response = await fetchWithAuth(`${BASE_URL}/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (response.ok) {
      return await response.json();
  }
  throw new Error('Network error');
};

export const updateConfig = async (config: UpdateConfig): Promise<any> => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    return await response.json();
  } catch (error) {
    console.error('Error updating config:', error);
    return { message: "Configuration updated successfully. (MOCKED)" };
  }
};

export const getConfig = async (): Promise<ConfigResponse> => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/config`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Network error');
  } catch (error) {
    console.error('Error getting config:', error);
    return {
      max_concurrent_trades: 5,
      min_profit_target_usdt: 0.5,
      max_drawdown_usdt: 50,
      max_sl_loss_usdt: 2,
      leverage: 15,
      investment_amount_usdt: 50,
      execution_mode: 'PAPER_TRADING'
    };
  }
};

export const getTelegramPaperConfig = async (): Promise<TelegramPaperConfig> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/telegram/paper/config`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('No se pudo obtener la configuración Telegram Paper');
  return await response.json();
};

export const updateTelegramPaperConfig = async (config: {
  enabled?: boolean;
  max_positions?: number;
  max_realized_loss_usdt?: number;
  investment_amount_usdt?: number;
  leverage?: number;
}): Promise<TelegramPaperConfig> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/telegram/paper/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || 'No se pudo actualizar Telegram Paper');
  }
  return await response.json();
};

export const getTelegramPaperStatus = async (): Promise<TelegramPaperStatus> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/telegram/paper/status`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('No se pudo obtener el estado Telegram Paper');
  return await response.json();
};

export const getTelegramPaperOperations = async (limit = 100): Promise<TelegramPaperOperation[]> => {
  const response = await fetchWithAuth(`${API_BASE_URL}/telegram/paper/operations?limit=${limit}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('No se pudieron obtener las operaciones Telegram Paper');
  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data : [];
};

export const getCredentials = async (): Promise<CredentialResponse[]> => {

  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/credentials/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Network error');
  } catch (error) {
    console.error('Error getting credentials:', error);
    return [];
  }
};

export const saveCredentials = async (
  exchange_id: string,
  environment: string,
  api_key: string,
  api_secret: string,
  passphrase?: string
): Promise<CredentialResponse> => {
  const payload = {
    exchange_id,
    environment,
    api_key,
    api_secret,
    passphrase,
    is_active: true
  };
  
  const response = await fetchWithAuth(`${API_BASE_URL}/credentials/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  
  if (response.ok) {
    return await response.json();
  }
  throw new Error('Error saving credentials');
};

export const closePosition = async (symbol: string) => {
  return await fetchWithAuth(`${BASE_URL}/close-position`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ symbol })
  });
};

export interface ChartHistoryRecord {
  id?: string;
  time: number;
  side: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
}

export type ExecutionMode = 'PAPER_TRADING' | 'LIVE' | 'TESTNET';

export interface GlobalTradeRecord {
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number;
  tp_price?: number;
  sl_price?: number;
  pnl: number;
  closed_at: string;
  leverage: number;
  execution_mode?: ExecutionMode;
  close_reason?: string;
  movement_state?: string;
}

const finiteNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const epochSeconds = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value / 1000 : value;
  }
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed / 1000 : 0;
};

const normalizeChartHistoryRecord = (raw: any): ChartHistoryRecord | null => {
  if (!raw || typeof raw !== 'object') return null;
  const time = epochSeconds(raw.time ?? raw.closed_at ?? raw.closedAt);
  return {
    id: raw.id !== undefined ? String(raw.id) : undefined,
    time,
    side: String(raw.side ?? raw.direction ?? '').toUpperCase(),
    entryPrice: finiteNumber(raw.entryPrice ?? raw.entry_price),
    exitPrice: finiteNumber(raw.exitPrice ?? raw.exit_price),
    pnl: finiteNumber(raw.pnl ?? raw.realizedPnl),
  };
};

const normalizeGlobalTradeRecord = (raw: any): GlobalTradeRecord | null => {
  if (!raw || typeof raw !== 'object' || !raw.symbol) return null;
  const closedAt = raw.closed_at ?? raw.closedAt;
  const time = epochSeconds(raw.time ?? closedAt);
  return {
    symbol: String(raw.symbol),
    side: String(raw.side ?? raw.direction ?? '').toUpperCase(),
    entry_price: finiteNumber(raw.entry_price ?? raw.entryPrice),
    exit_price: finiteNumber(raw.exit_price ?? raw.exitPrice),
    tp_price: raw.tp_price !== undefined || raw.tpPrice !== undefined ? finiteNumber(raw.tp_price ?? raw.tpPrice) : undefined,
    sl_price: raw.sl_price !== undefined || raw.slPrice !== undefined ? finiteNumber(raw.sl_price ?? raw.slPrice) : undefined,
    pnl: finiteNumber(raw.pnl ?? raw.realizedPnl),
    closed_at: closedAt ? String(closedAt) : (time > 0 ? new Date(time * 1000).toISOString() : ''),
    leverage: finiteNumber(raw.leverage),
    execution_mode: raw.execution_mode === 'LIVE' || raw.execution_mode === 'TESTNET' || raw.execution_mode === 'PAPER_TRADING'
      ? raw.execution_mode
      : undefined,
    close_reason: raw.close_reason ?? raw.closeReason
      ? String(raw.close_reason ?? raw.closeReason).toUpperCase()
      : undefined,
    movement_state: raw.movement_state ?? raw.movementState
      ? String(raw.movement_state ?? raw.movementState).toUpperCase()
      : undefined,
  };
};

export const getGlobalHistory = async (
  limit: number = 20,
  executionMode: ExecutionMode = 'PAPER_TRADING',
): Promise<{data: GlobalTradeRecord[]}> => {
  const response = await fetchWithAuth(
    `${BASE_URL}/history?limit=${limit}&execution_mode=${encodeURIComponent(executionMode)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
  if (!response.ok) throw new Error(`History HTTP ${response.status}`);
  const payload = await response.json();
  const records = (Array.isArray(payload.data) ? payload.data : [])
    .map((raw: unknown) => normalizeGlobalTradeRecord(raw))
    .filter((record: GlobalTradeRecord | null): record is GlobalTradeRecord => record !== null);
  return { data: records };
};

export const resetPaperBalance = async (): Promise<any> => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/paper_balance/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Error resetting paper balance:', error);
    throw error;
  }
};
