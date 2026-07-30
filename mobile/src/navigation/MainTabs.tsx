import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';
import ControlPanelScreen from '../screens/ControlPanelScreen';
import ChartScreen from '../screens/ChartScreen';
import { View, Text, Platform } from 'react-native';

const Tab = createBottomTabNavigator();

const TabBarIcon = ({ focused, name, emoji }: { focused: boolean; name: string; emoji: string }) => {
  return (
    <View style={{
      width: 52,
      height: 44,
      borderRadius: 12,
      backgroundColor: focused ? 'rgba(52, 216, 255, 0.08)' : 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: focused ? 1 : 0,
      borderColor: focused ? 'rgba(52, 216, 255, 0.35)' : 'transparent',
      // Glow shadow on iOS when active
      ...(focused && Platform.OS === 'ios' ? {
        shadowColor: '#34d8ff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      } : {}),
      ...(focused && Platform.OS === 'android' ? {
        elevation: 4,
      } : {}),
    }}>
      <Text style={{
        fontSize: 16,
        marginBottom: 2,
      }}>
        {emoji}
      </Text>
      <Text style={{
        color: focused ? '#34d8ff' : 'rgba(255, 255, 255, 0.3)',
        fontSize: 8,
        fontWeight: 'bold',
        letterSpacing: 1.5,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      }}>
        {name}
      </Text>
    </View>
  );
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(2, 4, 10, 0.85)', // Fondo Glass
          borderTopColor: 'rgba(52, 216, 255, 0.15)', // Borde neon sutil
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 16,
          paddingTop: 8,
          elevation: 0, // Quitar sombra en Android
          // Glass shadow effect on iOS
          ...(Platform.OS === 'ios' ? {
            shadowColor: '#34d8ff',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
          } : {}),
        },
        tabBarActiveTintColor: '#34d8ff', // Neon cyan
        tabBarInactiveTintColor: '#4b5563',
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="DASH" emoji="📊" />,
        }}
      />
      <Tab.Screen
        name="Chart"
        component={ChartScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="CHART" emoji="📈" />,
        }}
      />
      <Tab.Screen
        name="Control"
        component={ControlPanelScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="CTRL" emoji="⚙️" />,
        }}
      />
    </Tab.Navigator>
  );
}
