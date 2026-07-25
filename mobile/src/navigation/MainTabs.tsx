import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';
import ControlPanelScreen from '../screens/ControlPanelScreen';
import { View, Text } from 'react-native';

const Tab = createBottomTabNavigator();

const TabBarIcon = ({ focused, name }: { focused: boolean, name: string }) => {
  return (
    <View style={{
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: focused ? 'rgba(52, 216, 255, 0.2)' : 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: focused ? 1 : 0,
      borderColor: 'rgba(52, 216, 255, 0.5)',
    }}>
      <Text style={{ color: focused ? '#34d8ff' : '#888', fontSize: 10, fontWeight: 'bold' }}>
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
          backgroundColor: '#020202',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
          height: 80,
          paddingBottom: 20,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="DASH" />
        }}
      />
      <Tab.Screen
        name="Control"
        component={ControlPanelScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="CTRL" />
        }}
      />
    </Tab.Navigator>
  );
}
