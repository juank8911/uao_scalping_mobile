import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NeoLayout, NeoCard, NeoBadge, NeoButton, NeoModal } from 'jeikei-design-system';
import { getStatus, startEngine, stopEngine, closePosition } from '../services/api';
import type { SystemStatus, PositionInfo } from '../services/api';
import { authenticateBiometrically } from '../utils/auth';
import { PositionChartModal } from '../components/PositionChartModal';

export default function DashboardScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [closingSymbol, setClosingSymbol] = useState<string | null>(null);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [chartModalVisible, setChartModalVisible] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<PositionInfo | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const data = await getStatus();
        if (!isMounted) return;
        setIsConnected(true);
        setStatus(data);
        if (data.active_symbols && data.active_symbols.length > 0) {
          setSelectedSymbol((prev) => {
            if (!prev || !data.active_symbols.includes(prev)) {
              return data.active_symbols[0];
            }
            return prev;
          });
        } else {
          setSelectedSymbol(null);
        }
      } catch (error) {
        if (isMounted) setIsConnected(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleToggle = async (value: boolean) => {
    if (value) {
      const success = await authenticateBiometrically('Confirmar inicio del motor');
      if (success) {
        const response = await startEngine();
        alert(`Start Engine: ${response.message}`);
        setStatus(prev => prev ? { ...prev, is_running: true } : null);
      }
    } else {
      const success = await authenticateBiometrically('Confirmar parada del motor');
      if (success) {
        const response = await stopEngine();
        alert(`Stop Engine: ${response.message}`);
        setStatus(prev => prev ? { ...prev, is_running: false } : null);
      }
    }
  };

  return (
    <NeoLayout>
      <div className="p-6 pt-16 md:p-10 pb-32 max-w-4xl mx-auto w-full">
        {!isConnected && (
          <div className="bg-[#ef5350] p-3 rounded-lg mb-4 text-center">
            <p className="text-white font-bold">⚠️ DESCONECTADO DE LA API</p>
            <p className="text-white text-xs mt-1">Reintentando conectar en segundo plano...</p>
          </div>
        )}
        <div className="mb-6 flex flex-col items-center">
          <div className="flex flex-row items-center justify-center gap-4">
            <NeoBadge
              label={status?.is_running ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
              variant={status?.is_running ? 'success' : 'danger'}
            />
            {/* Custom toggle switch for React web */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={status?.is_running ?? false}
                onChange={(e) => handleToggle(e.target.checked)}
              />
              <div className="w-11 h-6 bg-[#3e3e3e] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#f4f3f4] peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4DA8DA]"></div>
            </label>
          </div>
          
          <div className="h-2" />
          {status && (
            <NeoBadge
              label={`MODE: ${status.execution_mode}`}
              variant={
                status.execution_mode === 'LIVE' ? 'danger' :
                status.execution_mode === 'TESTNET' ? 'warning' : 'primary'
              }
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <NeoCard
            title="Configuración Activa"
            value={status?.is_running ? 'En Memoria' : 'Inactivo'}
            trend={{ value: 'CONFIG', direction: status?.is_running ? 'up' : 'down' }}
          >
            <div className="flex justify-between items-center mt-2 border-t border-white/10 pt-2">
              <span className="text-white/70 text-sm">Inversión:</span>
              <span className="font-bold text-white">
                {status?.current_investment ? `${status.current_investment} USDT` : '---'}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-white/70 text-sm">Apalancamiento:</span>
              <span className="font-bold text-white">
                {status?.current_leverage ? `${status.current_leverage}x` : '---'}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-white/70 text-sm">PnL Objetivo:</span>
              <span className="font-bold text-[#00ff88]">
                {status?.current_target_pnl ? `${status.current_target_pnl} USDT` : '---'}
              </span>
            </div>
          </NeoCard>

          <NeoCard
            title="Global Balance & PnL"
            value={status && status.global_balance !== undefined ? `$${status.global_balance.toFixed(2)}` : '...'}
            trend={{ value: 'USDT', direction: 'up' }}
          >
            <div className="flex justify-between items-center mt-2 border-t border-white/10 pt-2">
              <span className="text-white/70 text-sm">PnL del Día:</span>
              <span className={`font-bold ${status && status.daily_pnl >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                {status && status.daily_pnl >= 0 ? '+' : ''}{status ? status.daily_pnl.toFixed(2) : '0.00'} USDT
              </span>
            </div>
            <p className="text-white/50 text-[10px] mt-1">Modo: {status?.execution_mode || '...'}</p>
          </NeoCard>

          <NeoCard
            title="Posiciones Actuales"
            value={status?.open_positions?.length ? `${status.open_positions.length} Abierta(s)` : 'Ninguna'}
            trend={{
              value: 'EN VIVO',
              direction: status?.open_positions?.length ? 'up' : 'down'
            }}
          >
            <div className="mt-2 space-y-2 max-h-[100px] overflow-y-auto pr-1 custom-scrollbar">
              {!status?.open_positions?.length ? (
                <p className="text-white/50 text-xs">No hay posiciones activas en este momento.</p>
              ) : (
                status.open_positions.map((pos, idx) => {
                  const contractSize = pos.contractSize || 1;
                  const margin = (pos.contracts * contractSize * pos.entryPrice) / pos.leverage;
                  const roi = margin > 0 ? (pos.unrealizedPnl / margin) * 100 : 0;
                  const valueUsdt = pos.contracts * contractSize * pos.markPrice;
                  
                  return (
                    <div key={idx} className="bg-white/5 p-2 rounded border border-white/5 text-xs flex justify-between items-center">
                      <div>
                        <span className="font-bold text-white">{pos.symbol}</span>
                        <span className={`ml-2 px-1 rounded text-[9px] ${pos.side.toLowerCase() === 'buy' || pos.side.toLowerCase() === 'long' ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'bg-[#ff3366]/20 text-[#ff3366]'}`}>
                          {pos.side.toUpperCase()} {pos.leverage}x
                        </span>
                        <div className="text-white/70 mt-0.5 text-[10px]">
                          Cant: {pos.contracts} | Total: ${valueUsdt.toFixed(2)} | Inv. Neta: ${margin.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-mono">${pos.markPrice.toFixed(7)}</div>
                        <div className={`font-bold ${roi >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                          {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </NeoCard>
        </div>

        <div className="h-6" />

        <NeoCard
          title="Estado del Motor"
          value={status && status.is_running ? (status.status.toUpperCase() || 'PROCESANDO...') : 'DETENIDO'}
          trend={{
            value: status?.is_running ? 'EN LÍNEA' : 'OFFLINE',
            direction: status?.is_running ? 'up' : 'down'
          }}
        >
          <p className="text-white/70 text-xs mt-2">
            {status?.is_running 
              ? 'El bot está ejecutando este paso actualmente.' 
              : 'Enciende el motor para comenzar a operar.'}
          </p>
        </NeoCard>

        <div className="h-6" />
        <div className="flex flex-row justify-between items-center px-1 mb-4">
          <h2 className="text-white text-lg font-bold ml-1">Símbolos Operando</h2>
        </div>

        {status?.active_symbols && status.active_symbols.length > 0 ? (
          status.active_symbols.map((symbol) => {
            const isPaper = status.execution_mode === 'PAPER_TRADING';
            const position = status.open_positions?.find((p) => p.symbol === symbol);
            const standaloneOrders = status.open_orders?.filter(o => o.symbol === symbol) || [];
            
            const livePnl = position && position.unrealizedPnl !== undefined 
              ? position.unrealizedPnl 
              : 0;

            const handleClosePosition = async (e: React.MouseEvent, sym: string) => {
              e.stopPropagation();
              setClosingSymbol(sym);
              try {
                await closePosition(sym);
                const data = await getStatus();
                setStatus(data);
              } catch (err) {
                console.error(err);
                alert('Error cerrando la posición.');
              } finally {
                setClosingSymbol(null);
              }
            };
            
            return (
              <div key={symbol} className="mb-4">
                <div
                  className={`transition-opacity ${position ? 'cursor-pointer hover:opacity-80 active:opacity-70' : ''}`}
                  onClick={() => {
                    if (position) {
                      setSelectedPosition(position);
                      setChartModalVisible(true);
                    }
                  }}
                >
                  <NeoCard
                    title={symbol}
                    value={
                      position
                        ? (isPaper ? 'EN POSICIÓN (SIMULADO)' : 'EN POSICIÓN')
                        : (standaloneOrders.length > 0
                            ? (isPaper ? 'ORDEN PENDIENTE (SIMULADO)' : 'ÓRDENES PENDIENTES')
                            : 'MONITOREANDO')
                    }
                  >
                  <div className="absolute inset-0 bg-white/10 opacity-0 active:opacity-100 transition-opacity rounded-[var(--neo-radius)] pointer-events-none"></div>
                  {position ? (
                    <div className="mt-3 bg-white/5 backdrop-blur-md border border-white/10 p-3 rounded-lg relative shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                      <div className="absolute top-3 right-3 flex gap-2">
                        <NeoButton 
                          variant="secondary" 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/chart?symbol=${encodeURIComponent(symbol)}`);
                          }} 
                        >
                          Gráfico
                        </NeoButton>
                        <NeoButton 
                          variant="danger" 
                          size="small" 
                          onClick={(e) => handleClosePosition(e, position.symbol)} 
                          disabled={closingSymbol === position.symbol}
                        >
                          {closingSymbol === position.symbol ? 'Cerrando...' : 'Cerrar'}
                        </NeoButton>
                      </div>
                      <div className="flex flex-row items-center mb-1.5 mt-2">
                        <NeoBadge
                          label={isPaper ? '🧪 SIMULADO' : 'REAL'}
                          variant={isPaper ? 'warning' : 'primary'}
                        />
                      </div>
                      <p className="text-white/90 text-sm mb-1.5 mt-4">
                        <span className="font-bold text-[#4DA8DA]">PNL:</span>{' '}
                        <span className={`font-bold text-lg ${livePnl >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                          {livePnl >= 0 ? '+' : ''}{livePnl.toFixed(2)} USDT
                        </span>
                      </p>
                      <p className="text-white/90 text-sm mb-1"><span className="font-bold text-[#4DA8DA]">Lado:</span> {position.side.toLowerCase() === 'buy' || position.side.toLowerCase() === 'long' ? 'LONG' : 'SHORT'}</p>
                      <p className="text-white/90 text-sm mb-1"><span className="font-bold text-[#4DA8DA]">Entrada:</span> {position.entryPrice}</p>
                      <p className="text-white/90 text-sm mb-1"><span className="font-bold text-[#4DA8DA]">Actual:</span> {position.markPrice}</p>
                      <p className="text-white/90 text-sm mb-1"><span className="font-bold text-[#4DA8DA]">Apalancamiento:</span> {position.leverage}x</p>
                      
                      {position.orders && position.orders.length > 0 && (
                        <div className="mt-2 border-t border-white/10 pt-2">
                          <p className="font-bold text-[#4DA8DA]">Órdenes Pendientes de Salida:</p>
                          {position.orders.map((ord, idx) => {
                            let expectedPnL = 0;
                            const contractSize = position.contractSize || 1;
                            if (position.side.toLowerCase() === 'long' || position.side.toLowerCase() === 'buy') {
                              expectedPnL = (ord.price - position.entryPrice) * position.contracts * contractSize;
                            } else {
                              expectedPnL = (position.entryPrice - ord.price) * position.contracts * contractSize;
                            }
                            const isProfit = expectedPnL > 0;
                            
                            return (
                              <p key={idx} className="text-white/90 text-sm mb-1">
                                • {ord.type}: {ord.price.toFixed(7)} ({ord.distance_pct.toFixed(2)}%) 
                                <span className={isProfit ? 'text-[#26a69a]' : 'text-[#ef5350]'}>
                                  {' '}[PnL: {expectedPnL > 0 ? '+' : ''}{expectedPnL.toFixed(2)} USDT]
                                </span>
                              </p>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : standaloneOrders.length > 0 ? (
                    <div className="mt-3 bg-white/5 backdrop-blur-md border border-white/10 p-3 rounded-lg relative shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                      <div className="absolute top-3 right-3 flex gap-2">
                        <NeoButton 
                          variant="secondary" 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/chart?symbol=${encodeURIComponent(symbol)}`);
                          }} 
                        >
                          Gráfico
                        </NeoButton>
                      </div>
                      {status.latest_prices && status.latest_prices[symbol] && (
                          <div className="mb-4 bg-white/5 p-2.5 rounded-lg flex flex-col items-center">
                              <p className="text-[#A0A0A0] text-xs mt-2">Precio Actual</p>
                              <p className="font-bold text-white text-lg mt-1">
                                  {status.latest_prices[symbol].toFixed(7)}
                              </p>
                          </div>
                      )}
                      <div className="flex flex-row items-center mb-2 gap-2 mt-2">
                        <p className="font-bold text-[#4DA8DA]">Órdenes de Entrada Abiertas:</p>
                        <NeoBadge
                          label={isPaper ? '🧪 SIMULADO' : 'REAL'}
                          variant={isPaper ? 'warning' : 'primary'}
                        />
                      </div>
                      {standaloneOrders.map((ord, idx) => (
                        <div key={idx} className="mb-2.5">
                          <NeoBadge 
                            label={`${ord.side} ${ord.type}`} 
                            variant={ord.side === 'BUY' ? 'success' : 'danger'} 
                          />
                          <p className="text-white/90 text-sm mb-1 mt-1">Precio: {ord.price.toFixed(7)} | Cant: {ord.amount}</p>
                          <p className="text-white/70 text-xs mt-0.5">
                            Estado: {ord.status === 'pending (simulado)' ? 'Esperando que el precio la toque…' : ord.status}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-3 flex flex-col items-center relative mt-3 bg-white/5 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                      <div className="absolute top-2 right-2">
                        <NeoButton 
                          variant="secondary" 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/chart?symbol=${encodeURIComponent(symbol)}`);
                          }} 
                        >
                          Gráfico
                        </NeoButton>
                      </div>
                      <p className="text-[#A0A0A0] text-sm text-center">Estado Actual del Bot:</p>
                      <p className="font-bold text-[#4DA8DA] mt-2 text-center text-base">
                          {status.status.toUpperCase()}
                      </p>
                      
                      {status.latest_prices && status.latest_prices[symbol] && (
                          <div className="mt-4 bg-white/5 backdrop-blur-md border border-white/10 p-3 rounded-lg flex flex-col items-center w-full max-w-xs shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                              <p className="text-[#A0A0A0] text-xs">Precio Actual en Vivo</p>
                              <p className="font-bold text-white text-xl mt-1">
                                  {status.latest_prices[symbol].toFixed(7)}
                              </p>
                          </div>
                      )}
                    </div>
                  )}
                  </NeoCard>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-3 flex flex-col items-center">
            <p className="text-[#A0A0A0] text-sm text-center">Estado Actual del Bot:</p>
            <p className="font-bold text-[#4DA8DA] mt-2 text-center text-base">
                {status?.status?.toUpperCase() || 'ESPERANDO...'}
            </p>
          </div>
        )}

      </div>

      <PositionChartModal
        visible={chartModalVisible}
        onClose={() => {
          setChartModalVisible(false);
          setSelectedPosition(null);
        }}
        position={
          selectedPosition 
            ? status?.open_positions?.find(p => p.symbol === selectedPosition.symbol) || selectedPosition 
            : null
        }
      />

      <NeoModal
        open={isDropdownVisible}
        title="Seleccionar Símbolo"
        onClose={() => setDropdownVisible(false)}
        footer={
          <NeoButton variant="outline" size="md" onClick={() => setDropdownVisible(false)}>
            Cerrar
          </NeoButton>
        }
      >
        {status?.active_symbols && status.active_symbols.length > 0 ? (
          <div className="flex flex-col">
            {status.active_symbols.map((item) => (
              <button
                key={item}
                className={`py-3.5 border-b px-3 rounded-lg transition-colors ${
                  selectedSymbol === item 
                    ? 'border-[#34d8ff]/20 bg-[#34d8ff]/10 text-[#34d8ff] font-bold tracking-widest' 
                    : 'border-white/5 bg-transparent text-white/70 font-normal hover:bg-white/5'
                }`}
                onClick={() => {
                  setSelectedSymbol(item);
                  setDropdownVisible(false);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-white/70 text-xs mt-2">Ningún símbolo activo disponible.</p>
        )}
      </NeoModal>
    </NeoLayout>
  );
}
