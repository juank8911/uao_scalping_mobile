import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Activity, LayoutDashboard, Settings, MessageSquare, ChevronRight, ChevronLeft, History as HistoryIcon } from 'lucide-react';
import { NeoButton } from 'jeikei-design-system';

export const RightSidebarNavigation: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: <LayoutDashboard size={24} />, label: 'Dashboard' },
    { path: '/chart', icon: <Activity size={24} />, label: 'Chart' },
    { path: '/history', icon: <HistoryIcon size={24} />, label: 'History' },
    { path: '/telegram', icon: <MessageSquare size={24} />, label: 'Telegram' },
    { path: '/control', icon: <Settings size={24} />, label: 'Config' },
  ];

  return (
    <div className={`transition-all duration-300 ease-in-out h-full border-l border-[#34d8ff]/20 bg-[#020202]/80 backdrop-blur-xl relative flex flex-col z-20 ${collapsed ? 'w-16' : 'w-48'}`}>
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -left-4 top-6 bg-[#0a0a0a] border border-[#34d8ff]/30 text-[#34d8ff] rounded-full p-1 z-10 hover:bg-[#1a1a1a]"
      >
        {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <div className="flex-1 flex flex-col gap-4 py-10 px-2 mt-8">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NeoButton
              key={item.path}
              variant={isActive ? 'primary' : 'ghost'}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 w-full justify-start p-3 ${collapsed ? 'px-2' : ''}`}
            >
              <div className={`flex-shrink-0 flex items-center justify-center ${collapsed ? 'w-full' : ''}`}>
                {item.icon}
              </div>
              {!collapsed && (
                <span className="font-bold tracking-widest text-xs">{item.label}</span>
              )}
            </NeoButton>
          );
        })}
      </div>
    </div>
  );
};
