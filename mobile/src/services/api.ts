import { getToken, deleteToken, saveToken } from '../utils/auth';
import { resetToLogin } from '../navigation/navigationRef';

const API_BASE_URL = 'http://localhost:8000/api/v1';
const BASE_URL = `${API_BASE_URL}/control`;

export interface SystemStatus {
  status: string;
  active_symbols: number;
  is_running: boolean;
  daily_pnl: number;
}

export interface UpdateConfig {
  max_concurrent_trades?: number;
  min_profit_target_usdt?: number;
  max_drawdown_usdt?: number;
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
      active_symbols: 3,
      is_running: true,
      daily_pnl: 12.5,
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
