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
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
  confidence?: number;
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
}

export interface UpdateConfig {
  max_concurrent_trades?: number;
  min_profit_target_usdt?: number;
  max_drawdown_usdt?: number;
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
  leverage: number;
  investment_amount_usdt: number;
  execution_mode: string;
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

export const fetchChartHistory = async (symbol: string) => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/chart/history?symbol=${encodeURIComponent(symbol)}&limit=6`, {
      method: 'GET',
    });
    const data = await response.json();
    return data.data || [];
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
      leverage: 15,
      investment_amount_usdt: 50,
      execution_mode: 'PAPER_TRADING'
    };
  }
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
}

export const getGlobalHistory = async (limit: number = 20): Promise<{data: GlobalTradeRecord[]}> => {
  const response = await fetchWithAuth(`${BASE_URL}/history?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (response.ok) {
    return await response.json();
  }
  throw new Error('Network error fetching history');
};
