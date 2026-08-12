import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, Animated, DeviceEventEmitter, SafeAreaView } from 'react-native';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'danger' | 'info';
}

export const TradeNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('ws:message', (payload: any) => {
      const { event, symbol, data } = payload;
      
      let newNotif: Notification | null = null;
      const id = Date.now().toString() + Math.random().toString();

      if (event === 'trade_closed') {
        const pnl = data.pnl ? parseFloat(data.pnl) : 0;
        newNotif = {
          id,
          title: `Trade Cerrado: ${symbol}`,
          message: `PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)} USDT`,
          type: pnl >= 0 ? 'success' : 'danger'
        };
      } else if (event === 'position_opened') {
        newNotif = {
          id,
          title: `Posición Abierta: ${symbol}`,
          message: `${data.side?.toUpperCase()} @ ${data.entry_price} (${data.leverage}x)`,
          type: 'info'
        };
      } else if (event === 'position_closed') {
        newNotif = {
          id,
          title: `Posición Cerrada: ${symbol}`,
          message: `La posición fue cerrada.`,
          type: 'info'
        };
      }

      if (newNotif) {
        setNotifications(prev => [...prev, newNotif!]);
        // Auto remove after 5 seconds
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (notifications.length === 0) return null;

  return (
    <SafeAreaView style={styles.container} pointerEvents="none">
      {notifications.map((notif) => (
        <NotificationItem key={notif.id} notification={notif} />
      ))}
    </SafeAreaView>
  );
};

const NotificationItem = ({ notification }: { notification: Notification }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const getBorderColor = () => {
    switch (notification.type) {
      case 'success': return '#00ff88';
      case 'danger': return '#ff3366';
      default: return '#34d8ff';
    }
  };

  return (
    <Animated.View style={[
      styles.toast, 
      { 
        opacity, 
        transform: [{ translateY }],
        borderLeftColor: getBorderColor()
      }
    ]}>
      <Text style={styles.title}>{notification.title}</Text>
      <Text style={styles.message}>{notification.message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 9999,
  },
  toast: {
    backgroundColor: 'rgba(2, 2, 2, 0.9)',
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  title: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
  }
});
