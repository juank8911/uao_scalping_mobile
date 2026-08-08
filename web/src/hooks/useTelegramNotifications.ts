/**
 * useTelegramNotifications.ts
 *
 * Escucha el CustomEvent 'ws:message' que emite el singleton de useEngineWebSocket.
 * NO abre ningún WebSocket propio — evita sockets duplicados y desconexiones.
 */
import { useEffect } from 'react';
import toast from 'react-hot-toast';

export const useTelegramNotifications = () => {
  useEffect(() => {
    const handleWsMessage = (e: Event) => {
      const payload = (e as CustomEvent).detail;
      if (!payload || payload.event !== 'new_telegram_message' || !payload.data) return;

      const { chat_title, sender_name, text } = payload.data;
      toast.success(
        `Mensaje en ${chat_title} de ${sender_name}:\n\n${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`,
        { duration: 6000, position: 'top-right', icon: '💌' }
      );
    };

    window.addEventListener('ws:message', handleWsMessage);
    return () => window.removeEventListener('ws:message', handleWsMessage);
  }, []);
};
