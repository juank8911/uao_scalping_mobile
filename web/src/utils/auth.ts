const TOKEN_KEY = 'uao_auth_token';

export const saveToken = (token: string): void => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.warn('Error saving token:', error);
  }
};

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.warn('Error getting token:', error);
    return null;
  }
};

export const deleteToken = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.warn('Error deleting token:', error);
  }
};

// Dispatch a custom event to show the auth modal
export const authenticateBiometrically = async (promptMessage: string = 'Autenticación requerida para esta acción'): Promise<boolean> => {
  return new Promise((resolve) => {
    const event = new CustomEvent('require-auth-modal', {
      detail: {
        promptMessage,
        resolve,
      },
    });
    window.dispatchEvent(event);
  });
};
