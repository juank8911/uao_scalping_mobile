import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, Outlet } from 'react-router-dom';

import { AuthModal } from './components/AuthModal';

import LoginScreen from './pages/Login';
import DashboardScreen from './pages/Dashboard';
import ControlPanelScreen from './pages/ControlPanel';
import ChartScreen from './pages/Chart';
import HistoryScreen from './pages/History';
import TelegramConfigScreen from './pages/TelegramConfig';
import { getToken } from './utils/auth';

import { RightSidebarNavigation } from './components/RightSidebarNavigation';
import { LeftHistoryPanel } from './components/LeftHistoryPanel';
import { TradeNotifications } from './components/TradeNotifications';
import { useTelegramNotifications } from './hooks/useTelegramNotifications';
import { useEngineWebSocketInit } from './hooks/useEngineWebSocket';

const PrivateRoute = () => {
  useTelegramNotifications();
  useEngineWebSocketInit(); // WebSocket singleton — persiste durante toda la sesión
  const navigate = useNavigate();

  useEffect(() => {
    const handleUnauthorized = () => {
      navigate('/login');
    };
    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, [navigate]);

  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-black relative">
      {/* Optimized Static Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#020202] via-[#050505] to-[#0a0a0a] -z-20" />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('/noise.svg')] mix-blend-overlay -z-10" />
      
      <TradeNotifications />
      <LeftHistoryPanel />
      
      <main className="flex-1 overflow-y-auto relative z-10">
        <Outlet />
      </main>
      
      <RightSidebarNavigation />
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthModal />
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<DashboardScreen />} />
          <Route path="/chart" element={<ChartScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/telegram" element={<TelegramConfigScreen />} />
          <Route path="/control" element={<ControlPanelScreen />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
