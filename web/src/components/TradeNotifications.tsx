import { useEffect, useState, useRef } from 'react';
import { getStatus, getGlobalHistory } from '../services/api';
import type { SystemStatus, GlobalTradeRecord } from '../services/api';
import { useEngineStore } from '../store/useEngineStore';

interface NotificationData {
  id: string;
  message: string;
  description: string;
  variant: 'info' | 'success' | 'warning' | 'error';
}

export function TradeNotifications() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const knownPositions = useRef<Set<string>>(new Set());
  const lastHistoryCheck = useRef<string>(new Date(Date.now() - 60000).toISOString()); // Last minute

  useEffect(() => {
    let isMounted = true;
    
    const checkUpdates = async () => {
      try {
        // 1. Check for new open positions
        const status: SystemStatus = await getStatus();
        useEngineStore.getState().setStatus(status);
        if (!isMounted) return;
        
        const currentPositionIds = new Set(status.open_positions?.map(p => p.symbol) || []);
        
        status.open_positions?.forEach(pos => {
          if (!knownPositions.current.has(pos.symbol)) {
            // New position!
            const dir = pos.side.toUpperCase() === 'BUY' || pos.side.toUpperCase() === 'LONG' ? 'LONG' : 'SHORT';
            addNotification({
              id: `pos-${pos.symbol}-${Date.now()}-${Math.random()}`,
              message: `ORDEN EJECUTADA: ${pos.symbol}`,
              description: `Se ha abierto una posición ${dir} en ${pos.entryPrice}`,
              variant: 'info'
            });
          }
        });
        
        knownPositions.current = currentPositionIds;

        // 2. Check for newly closed positions in history
        const history = await getGlobalHistory(5);
        if (!isMounted) return;
        
        if (history && history.data && history.data.length > 0) {
          history.data.forEach((record: GlobalTradeRecord) => {
            if (record.closed_at > lastHistoryCheck.current) {
              const dir = record.side.toUpperCase() === 'BUY' || record.side.toUpperCase() === 'LONG' ? 'LONG' : 'SHORT';
              let exitType = 'Cerrada';
              if (record.tp_price && Math.abs(record.exit_price - record.tp_price) < 0.0001) exitType = 'TP Tocado';
              else if (record.sl_price && Math.abs(record.exit_price - record.sl_price) < 0.0001) exitType = 'SL Tocado';
              
              const isProfit = record.pnl > 0;
              
              addNotification({
                id: `hist-${record.symbol}-${record.closed_at}-${Math.random()}`,
                message: `POSICIÓN CERRADA: ${record.symbol}`,
                description: `${dir} | ${exitType} | PNL: ${isProfit ? '+' : ''}${record.pnl.toFixed(7)} USDT`,
                variant: isProfit ? 'success' : 'error'
              });
              
              // Update last check time
              if (record.closed_at > lastHistoryCheck.current) {
                lastHistoryCheck.current = record.closed_at;
              }
            }
          });
        }
      } catch (e) {
        // Ignore API errors for notifications polling
      }
    };

    // Initial check
    checkUpdates();
    
    // Poll every 5 seconds
    const interval = setInterval(checkUpdates, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const addNotification = (notif: NotificationData) => {
    setNotifications(prev => [...prev, notif]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const variantStyles = {
    info: 'border-[#34d8ff]/30 shadow-[0_0_20px_-5px_rgba(52,216,255,0.4)] text-[#34d8ff]',
    success: 'border-emerald-400/30 shadow-[0_0_20px_-5px_rgba(52,211,153,0.4)] text-emerald-400',
    warning: 'border-amber-400/30 shadow-[0_0_20px_-5px_rgba(251,191,36,0.4)] text-amber-400',
    error: 'border-red-500/40 shadow-[0_0_20px_-5px_rgba(239,68,68,0.5)] text-red-500',
  };

  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 items-end w-[320px]">
      {notifications.map((notif) => (
        <ToastItem 
          key={notif.id} 
          notif={notif} 
          onClose={() => removeNotification(notif.id)} 
          variantStyles={variantStyles} 
        />
      ))}
    </div>
  );
}

function ToastItem({ notif, onClose, variantStyles }: { notif: NotificationData, onClose: () => void, variantStyles: any }) {
  const [isVisible, setIsVisible] = useState(true);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onCloseRef.current(), 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onCloseRef.current(), 300);
  };

  return (
    <div 
      className={[
        'pointer-events-auto flex items-center gap-4 py-4 px-6 min-w-[320px] max-w-md bg-black/80 border rounded-lg backdrop-blur-xl transition-all duration-300 relative',
        variantStyles[notif.variant],
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
      ].filter(Boolean).join(' ')}
    >
      <div className="flex-1 pr-2">
        <p className="font-bold tracking-wide uppercase text-[11px] mb-1 leading-tight text-white">
          {notif.message}
        </p>
        <p className="text-sm text-white/60 leading-snug">
          {notif.description}
        </p>
      </div>
      
      <button 
        onClick={handleClose}
        className="text-white/40 hover:text-white transition-colors p-1"
      >
        ✕
      </button>

      {/* Structural HUD Overlay */}
      <div className="absolute top-0 right-0 w-4 h-[1px] bg-current" />
      <div className="absolute top-0 right-0 h-4 w-[1px] bg-current" />
      <div className="absolute bottom-0 left-0 w-4 h-[1px] bg-current" />
      <div className="absolute bottom-0 left-0 h-4 w-[1px] bg-current" />
    </div>
  );
}


