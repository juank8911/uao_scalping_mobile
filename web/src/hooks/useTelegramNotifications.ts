import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

export const useTelegramNotifications = () => {
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      // Usamos el host actual (o localhost si es desarrollo) para construir la URL del WS
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      // Asumimos que el API corre en localhost:8000 en entorno dev, o relativa en prod
      const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
      const wsUrl = `${protocol}//${host}/api/v1/ws/notifications`;

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('🔗 [Telegram Notifications] Conectado al WebSocket');
      };

      ws.current.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === 'new_telegram_message' && payload.data) {
            const { chat_title, sender_name, text } = payload.data;
            toast.success(
              `Mensaje en ${chat_title} de ${sender_name}:\n\n${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`,
              {
                duration: 6000,
                position: 'top-right',
                icon: '💌',
              }
            );
          }
        } catch (err) {
          console.error('Error parseando mensaje WS de Telegram', err);
        }
      };

      ws.current.onclose = () => {
        console.log('🔴 [Telegram Notifications] WebSocket desconectado. Reconectando en 5s...');
        reconnectTimeout = setTimeout(connect, 5000);
      };

      ws.current.onerror = (err) => {
        console.error('WebSocket Error:', err);
        ws.current?.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);
};
