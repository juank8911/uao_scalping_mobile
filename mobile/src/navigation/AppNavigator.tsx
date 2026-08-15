import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import MainDrawer from './MainDrawer';
import { getToken, onAuthRequired } from '../utils/auth';
import { getCurrentUser } from '../services/api';
import { View, ActivityIndicator } from 'react-native';
import { NeoLayout } from 'jeikei-design-system/native';
import { useEngineWebSocketInit } from '../hooks/useEngineWebSocket';
import { useTelegramNotifications } from '../hooks/useTelegramNotifications';
import { TradeNotifications } from '../components/TradeNotifications';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize global websocket connection (only happens once)
  useEngineWebSocketInit();
  useTelegramNotifications();

  useEffect(() => {
    const checkAuth = async () => {
      console.log('checkAuth started');
      try {
        console.log('calling getToken');
        const token = await getToken();
        console.log('getToken resolved', token);
        if (token) { await getCurrentUser(); }
        setIsAuthenticated(!!token);
      } catch (error) {
        console.warn('CheckAuth error:', error);
        setIsAuthenticated(false);
      } finally {
        console.log('setting isLoading false');
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => onAuthRequired(() => setIsAuthenticated(false)), []);

  if (isLoading) {
    return (
      <NeoLayout>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#34d8ff" />
        </View>
      </NeoLayout>
    );
  }

  return (
    <>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
      >
        {isAuthenticated ? (<Stack.Screen name="MainDrawer" component={MainDrawer} />) : (<Stack.Screen name="Login" component={LoginScreen} />)}
      </Stack.Navigator>
      <TradeNotifications />
    </>
  );
}
