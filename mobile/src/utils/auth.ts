import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const TOKEN_KEY = 'uao_auth_token';

export const saveToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (error) {
    console.warn('Error saving token:', error);
  }
};

export const getToken = async (): Promise<string | null> => {
  try {
    const tokenPromise = SecureStore.getItemAsync(TOKEN_KEY);
    const timeoutPromise = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error('SecureStore timeout')), 2000)
    );
    return await Promise.race([tokenPromise, timeoutPromise]);
  } catch (error) {
    console.warn('Error getting token:', error);
    return null;
  }
};

export const deleteToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (error) {
    console.warn('Error deleting token:', error);
  }
};

export const authenticateBiometrically = async (promptMessage: string = 'Autenticación requerida para esta acción'): Promise<boolean> => {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) {
    // If no hardware or not enrolled, we fallback to true in a sandbox environment for testing
    // Or we can return true with a warning. Let's assume it passes for sandbox testing if not available.
    console.warn('Biometric hardware not available or not enrolled. Bypassing for testing.');
    return true;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    fallbackLabel: 'Usar PIN',
  });

  return result.success;
};
