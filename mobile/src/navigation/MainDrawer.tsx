import React from 'react';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { View, Text, Platform, StyleSheet } from 'react-native';
import DashboardScreen from '../screens/DashboardScreen';
import ControlPanelScreen from '../screens/ControlPanelScreen';
import ChartScreen from '../screens/ChartScreen';
import HistoryScreen from '../screens/HistoryScreen';
import TelegramConfigScreen from '../screens/TelegramConfigScreen';

const Drawer = createDrawerNavigator();

const CustomDrawerContent = (props: any) => {
  const currentRouteName = props.state.routeNames[props.state.index];

  const renderItem = (label: string, route: string, emoji: string) => {
    const isFocused = currentRouteName === route;
    return (
      <DrawerItem
        label={() => (
          <View style={styles.drawerItemLabelContainer}>
            <Text style={styles.drawerItemEmoji}>{emoji}</Text>
            <Text style={[styles.drawerItemText, isFocused && styles.drawerItemTextFocused]}>
              {label}
            </Text>
          </View>
        )}
        onPress={() => props.navigation.navigate(route)}
        style={[styles.drawerItem, isFocused && styles.drawerItemFocused]}
      />
    );
  };

  return (
    <DrawerContentScrollView {...props} style={styles.drawerContent} contentContainerStyle={{ paddingTop: 40 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>JeiKei</Text>
        <Text style={styles.headerSubtitle}>Trading System</Text>
      </View>
      <View style={styles.menuContainer}>
        {renderItem('Dashboard', 'Dashboard', '📊')}
        {renderItem('Control Panel', 'Control', '⚙️')}
        {renderItem('Charts', 'Chart', '📈')}
        {renderItem('History', 'History', '📒')}
        {renderItem('Telegram', 'Telegram', '🚀')}
      </View>
    </DrawerContentScrollView>
  );
};

export default function MainDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: '#02040A',
          width: 280,
          borderRightWidth: 1,
          borderRightColor: 'rgba(52, 216, 255, 0.15)',
        },
        sceneContainerStyle: {
          backgroundColor: '#02040A',
        },
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} />
      <Drawer.Screen name="Control" component={ControlPanelScreen} />
      <Drawer.Screen name="Chart" component={ChartScreen} />
      <Drawer.Screen name="History" component={HistoryScreen} />
      <Drawer.Screen name="Telegram" component={TelegramConfigScreen} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerContent: {
    flex: 1,
    backgroundColor: '#02040A',
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#34d8ff',
    letterSpacing: 2,
    textShadowColor: 'rgba(52, 216, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1,
    marginTop: 4,
  },
  menuContainer: {
    paddingHorizontal: 10,
  },
  drawerItem: {
    borderRadius: 8,
    marginBottom: 8,
  },
  drawerItemFocused: {
    backgroundColor: 'rgba(52, 216, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 216, 255, 0.3)',
  },
  drawerItemLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  drawerItemEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  drawerItemText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  drawerItemTextFocused: {
    color: '#34d8ff',
    fontWeight: 'bold',
  },
});
