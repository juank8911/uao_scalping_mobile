import { useEffect } from 'react';
import { DeviceEventEmitter, Alert } from 'react-native';

export const useTelegramNotifications = () => {
  useEffect(() => {
    const handleWsMessage = (payload: any) => {
      if (!payload || payload.event !== 'new_telegram_message' || !payload.data) return;

      const { chat_title, sender_name, text } = payload.data;
      
      const truncatedText = text.substring(0, 100) + (text.length > 100 ? '...' : '');
      
      Alert.alert(
        `💌 Mensaje en ${chat_title}`,
        `De ${sender_name}:\n\n${truncatedText}`,
        [{ text: 'OK' }]
      );
    };

    const subscription = DeviceEventEmitter.addListener('ws:message', handleWsMessage);
    
    return () => {
      subscription.remove();
    };
  }, []);
};
