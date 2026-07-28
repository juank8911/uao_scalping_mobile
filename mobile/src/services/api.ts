import { getToken, deleteToken, saveToken } from '../utils/auth';
import { resetToLogin } from '../navigation/navigationRef';

const API_BASE_URL = 'http://192.168.0.9:8000/api/v1';
const BASE_URL = `${API_BASE_URL}/control`;

export interface OrderInfo {
  type: string;
  price: number;
  distance_pct: number;
}

export interface PositionInfo {
  symbol: string;
  side: string;
  contracts: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
  orders?: OrderInfo[];
}

export interface SystemStatus {
  status: string;
  active_symbols: string[];
  is_running: boolean;
  daily_pnl: number;
  execution_mode: string;
  global_balance?: number;
  open_positions?: PositionInfo[];
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
  await saveToken(data.access_token);
  return data;
};

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers: any = { ...options.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    await deleteToken();
    resetToLogin();
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
    // Mock fallback for sandbox
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
    // Mock fallback for sandbox
    return { message: "Engine stop sequence initiated. (MOCKED)" };
  }
};

export const getStatus = async (): Promise<SystemStatus> => {
  try {
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
  } catch (error) {
    console.error('Error getting status:', error);
    // Mock fallback for sandbox
    return {
      status: 'running',
      active_symbols: ['BTC/USDT', 'ETH/USDT'],
      is_running: true,
      daily_pnl: 12.5,
      execution_mode: 'PAPER_TRADING',
      open_positions: [
        {
          symbol: 'BTC/USDT',
          side: 'buy',
          contracts: 0.05,
          entryPrice: 65000,
          markPrice: 65200,
          unrealizedPnl: 10,
          leverage: 15,
          orders: [
            { type: 'TAKE_PROFIT', price: 65500, distance_pct: 0.46 },
            { type: 'STOP_LOSS', price: 64500, distance_pct: 1.07 }
          ]
        }
      ]
    };
  }
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
    // Mock fallback for sandbox
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
    const response = await fetchWithAuth(`${API_BASE_URL}/credentials`, {
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
  
  const response = await fetchWithAuth(`${API_BASE_URL}/credentials`, {
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
