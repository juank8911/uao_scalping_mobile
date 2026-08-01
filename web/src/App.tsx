import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { Activity, LayoutDashboard, Settings } from 'lucide-react';
import { AuthModal } from './components/AuthModal';

import LoginScreen from './pages/Login';
import DashboardScreen from './pages/Dashboard';
import ControlPanelScreen from './pages/ControlPanel';
import ChartScreen from './pages/Chart';
import { getToken } from './utils/auth';

const PrivateRoute = () => {
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
    <>
      <Outlet />
      <BottomNavigation />
    </>
  );
};

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: <LayoutDashboard size={24} />, label: 'Dashboard' },
    { path: '/chart', icon: <Activity size={24} />, label: 'Chart' },
    { path: '/control', icon: <Settings size={24} />, label: 'Config' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#02040a] border-t border-[#34d8ff]/10 p-2 pb-safe">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center p-2 transition-colors ${
                isActive ? 'text-[#34d8ff]' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {item.icon}
              <span className="text-[10px] mt-1 font-bold">{item.label}</span>
            </button>
          );
        })}
      </div>
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
          <Route path="/control" element={<ControlPanelScreen />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
