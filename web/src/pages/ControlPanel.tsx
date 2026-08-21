import React, { useState, useEffect } from 'react';
import { NeoLayout, NeoCard, NeoInput, NeoButton, NeoBadge, NeoModal } from 'jeikei-design-system';
import { startEngine, stopEngine, updateConfig, getConfig, getCredentials, saveCredentials, resetPaperBalance } from '../services/api';
import type { CredentialResponse } from '../services/api';
import { authenticateBiometrically } from '../utils/auth';

export default function ControlPanelScreen() {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [maxTrades, setMaxTrades] = useState('5');
  const [profitTarget, setProfitTarget] = useState('0.5');
  const [maxDrawdown, setMaxDrawdown] = useState('50');
  const [maxSlLoss, setMaxSlLoss] = useState('2');
  const [investmentAmount, setInvestmentAmount] = useState('50');
  const [leverage, setLeverage] = useState('20');
  
  const [demoApiKey, setDemoApiKey] = useState('');
  const [demoApiSecret, setDemoApiSecret] = useState('');
  const [demoApiPassword, setDemoApiPassword] = useState('');
  
  const [realApiKey, setRealApiKey] = useState('');
  const [realApiSecret, setRealApiSecret] = useState('');
  const [realApiPassword, setRealApiPassword] = useState('');
  
  const [executionMode, setExecutionMode] = useState('PAPER_TRADING');
  const [exchangeId, setExchangeId] = useState('binance');
  const [isExchangeModalVisible, setIsExchangeModalVisible] = useState(false);

  const [credentials, setCredentials] = useState<CredentialResponse[]>([]);

  const EXCHANGES = ['binance', 'okx', 'bybit', 'kucoin', 'bitget', 'kraken', 'huobi', 'gateio', 'coinbase', 'bitmex'];

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [configData, credsData] = await Promise.all([
          getConfig(),
          getCredentials()
        ]);
        
        setMaxTrades(configData.max_concurrent_trades.toString());
        setProfitTarget(configData.min_profit_target_usdt.toString());
        setMaxDrawdown(configData.max_drawdown_usdt.toString());
        setMaxSlLoss(configData.max_sl_loss_usdt?.toString() || '2');
        setInvestmentAmount(configData.investment_amount_usdt?.toString() || '50');
        setLeverage(configData.leverage?.toString() || '20');
        setExecutionMode(configData.execution_mode);
        
        setCredentials(credsData);
        if (credsData.length > 0) {
           setExchangeId(credsData[0].exchange_id);
        }
      } catch (err) {
        console.error('Error fetching config', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isEditing]);

  const hasCredential = (env: string) => {
    return credentials.some(c => c.environment === env && c.exchange_id === exchangeId && c.is_active);
  };

  const handleStart = async () => {
    const success = await authenticateBiometrically('Confirmar inicio del motor');
    if (success) {
      const response = await startEngine();
      alert(`Start Engine: ${response.message}`);
    }
  };

  const handleStop = async () => {
    const success = await authenticateBiometrically('Confirmar parada de emergencia (Kill-Switch)');
    if (success) {
      const response = await stopEngine();
      alert(`Stop Engine: ${response.message}`);
    }
  };

  const handleResetPaper = async () => {
    const success = await authenticateBiometrically('Confirmar reinicio de Paper Trading');
    if (success) {
      try {
        const res = await resetPaperBalance();
        alert(`Éxito: ${res.message}`);
        window.location.reload();
      } catch (err) {
        alert('Error al reiniciar Paper Trading');
      }
    }
  };

  const handleUpdateConfig = async () => {
    const success = await authenticateBiometrically('Confirmar cambios de configuración');
    if (success) {
      try {
        await updateConfig({
          max_concurrent_trades: parseInt(maxTrades, 10),
          min_profit_target_usdt: parseFloat(profitTarget),
          max_drawdown_usdt: parseFloat(maxDrawdown),
          max_sl_loss_usdt: parseFloat(maxSlLoss),
          investment_amount_usdt: parseFloat(investmentAmount),
          leverage: parseInt(leverage, 10),
          execution_mode: executionMode,
          exchange_id: exchangeId
        });
        
        if (demoApiKey && demoApiSecret) {
          await saveCredentials(exchangeId, 'sandbox', demoApiKey, demoApiSecret, demoApiPassword);
        }
        if (realApiKey && realApiSecret) {
          await saveCredentials(exchangeId, 'real', realApiKey, realApiSecret, realApiPassword);
        }

        alert('Configuración guardada correctamente.');
        setIsEditing(false);
        
        setDemoApiKey(''); setDemoApiSecret(''); setDemoApiPassword('');
        setRealApiKey(''); setRealApiSecret(''); setRealApiPassword('');
      } catch (e) {
        alert('Hubo un error al guardar la configuración.');
      }
    }
  };

  const renderSummaryRow = (label: string, value: string | React.ReactNode) => (
    <div className="flex flex-row justify-between items-center py-3 border-b border-white/5">
      <span className="text-white/70 text-sm">{label}</span>
      {typeof value === 'string' ? <span className="text-white text-sm font-bold">{value}</span> : value}
    </div>
  );

  return (
    <NeoLayout>
      <div className="p-6 pt-16 md:p-10 pb-32 max-w-4xl mx-auto w-full">
        <NeoCard title="Engine Control" value="" trend={{ value: 'DANGER ZONE', direction: 'down' }}>
          <div className="flex flex-row mt-4 justify-between gap-4">
            <div className="flex-1">
              <NeoButton variant="primary" size="md" onClick={handleStart}>
                START ENGINE
              </NeoButton>
            </div>
            <div className="flex-1">
              <NeoButton variant="secondary" size="md" onClick={handleStop}>
                KILL-SWITCH
              </NeoButton>
            </div>
          </div>
        </NeoCard>

        <div className="h-6" />

        {!isEditing ? (
          <NeoCard title="System Configuration" value="SUMMARY" trend={{ value: 'ACTIVE', direction: 'up' }}>
            {isLoading ? (
              <p className="text-white/70 text-sm mt-4">Cargando...</p>
            ) : (
              <div className="mt-4">
                {renderSummaryRow('Exchange', exchangeId.toUpperCase())}
                {renderSummaryRow('Execution Mode', executionMode)}
                {renderSummaryRow('Max Concurrent Trades', maxTrades)}
                {renderSummaryRow('Min Profit Target', `${profitTarget} USDT`)}
                {renderSummaryRow('Max Drawdown', `${maxDrawdown} USDT`)}
                {renderSummaryRow('Max SL Loss', `${maxSlLoss} USDT`)}
                {renderSummaryRow('Investment Amount', `${investmentAmount} USDT`)}
                {renderSummaryRow('Leverage', `${leverage}x`)}
                
                <div className="h-4" />
                <h3 className="text-white/70 text-[10px] font-bold mb-2 mt-2 tracking-widest uppercase">API Credentials Status</h3>
                
                {renderSummaryRow(
                  'TESTNET / DEMO Keys', 
                  <NeoBadge label={hasCredential('sandbox') ? 'Definido' : 'No Definido'} variant={hasCredential('sandbox') ? 'success' : 'danger'} />
                )}
                {renderSummaryRow(
                  'LIVE / REAL Keys', 
                  <NeoBadge label={hasCredential('real') ? 'Definido' : 'No Definido'} variant={hasCredential('real') ? 'success' : 'danger'} />
                )}
                
                <div className="h-6" />
                <div className="flex flex-col gap-3">
                  <NeoButton variant="outline" size="md" onClick={() => setIsEditing(true)}>
                    Editar Configuración
                  </NeoButton>
                  <NeoButton variant="secondary" size="md" onClick={handleResetPaper}>
                    Reiniciar Paper Trading e Historial
                  </NeoButton>
                </div>
              </div>
            )}
          </NeoCard>
        ) : (
          <NeoCard title="Edit Configuration" value="EDITING" trend={{ value: 'UNSAVED', direction: 'down' }}>
            <div className="mt-4 flex flex-col gap-4">
              <h3 className="text-white/70 text-[10px] font-bold tracking-widest uppercase mb-1">Exchange Settings</h3>
              
              <button 
                className="border border-white/25 rounded-lg p-3 bg-white/5 text-white text-sm text-left w-full" 
                onClick={() => setIsExchangeModalVisible(true)}
              >
                {exchangeId.toUpperCase()}
              </button>

              <h3 className="text-white/70 text-[10px] font-bold tracking-widest uppercase mb-1 mt-2">Execution Mode</h3>
              <div className="flex flex-row justify-between gap-2">
                <div className="flex-1">
                  <NeoButton variant={executionMode === 'PAPER_TRADING' ? 'primary' : 'outline'} size="md" onClick={() => setExecutionMode('PAPER_TRADING')}>
                    PAPER
                  </NeoButton>
                </div>
                <div className="flex-1">
                  <NeoButton variant={executionMode === 'TESTNET' ? 'primary' : 'outline'} size="md" onClick={() => setExecutionMode('TESTNET')}>
                    DEMO
                  </NeoButton>
                </div>
                <div className="flex-1">
                  <NeoButton variant={executionMode === 'LIVE' ? 'primary' : 'outline'} size="md" onClick={() => setExecutionMode('LIVE')}>
                    REAL
                  </NeoButton>
                </div>
              </div>
              
              <h3 className="text-white/70 text-[10px] font-bold tracking-widest uppercase mb-1 mt-2">Risk Manager</h3>
              <NeoInput
                label="Max Concurrent Trades"
                placeholder="e.g. 5"
                value={maxTrades}
                onChange={(e: any) => setMaxTrades(e.target.value)}
                type="number"
              />
              <NeoInput
                label="Min Profit Target (USDT)"
                placeholder="e.g. 0.5"
                value={profitTarget}
                onChange={(e: any) => setProfitTarget(e.target.value)}
                type="number"
              />
              <NeoInput
                label="Max Drawdown (USDT)"
                placeholder="e.g. 50"
                value={maxDrawdown}
                onChange={(e: any) => setMaxDrawdown(e.target.value)}
                type="number"
              />
              <NeoInput
                label="Max SL Loss (USDT)"
                placeholder="e.g. 2"
                value={maxSlLoss}
                onChange={(e: any) => setMaxSlLoss(e.target.value)}
                type="number"
                min="0.01"
                step="0.01"
              />
              <NeoInput
                label="Investment Amount (USDT)"
                placeholder="e.g. 2.5"
                value={investmentAmount}
                onChange={(e: any) => setInvestmentAmount(e.target.value)}
                type="number"
              />
              <NeoInput
                label="Leverage (x)"
                placeholder="e.g. 30"
                value={leverage}
                onChange={(e: any) => setLeverage(e.target.value)}
                type="number"
              />
              
              <h3 className="text-white/70 text-[10px] font-bold tracking-widest uppercase mb-1 mt-2">Update API Keys (Dejar vacío si no hay cambios)</h3>
              <NeoInput
                label="DEMO API Key"
                placeholder="YOUR_DEMO_KEY"
                value={demoApiKey}
                onChange={(e: any) => setDemoApiKey(e.target.value)}
              />
              <NeoInput
                label="DEMO API Secret"
                placeholder="YOUR_DEMO_SECRET"
                value={demoApiSecret}
                onChange={(e: any) => setDemoApiSecret(e.target.value)}
              />
              <NeoInput
                label="DEMO Password (OKX/KuCoin)"
                placeholder="Optional API Password"
                value={demoApiPassword}
                onChange={(e: any) => setDemoApiPassword(e.target.value)}
              />
              
              <div className="h-4" />
              
              <NeoInput
                label="REAL API Key"
                placeholder="YOUR_REAL_KEY"
                value={realApiKey}
                onChange={(e: any) => setRealApiKey(e.target.value)}
              />
              <NeoInput
                label="REAL API Secret"
                placeholder="YOUR_REAL_SECRET"
                value={realApiSecret}
                onChange={(e: any) => setRealApiSecret(e.target.value)}
              />
              <NeoInput
                label="REAL Password (OKX/KuCoin)"
                placeholder="Optional API Password"
                value={realApiPassword}
                onChange={(e: any) => setRealApiPassword(e.target.value)}
              />

              <div className="flex flex-row justify-between mt-6 gap-4">
                <div className="flex-1">
                  <NeoButton variant="secondary" size="md" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </NeoButton>
                </div>
                <div className="flex-1">
                  <NeoButton variant="primary" size="md" onClick={handleUpdateConfig}>
                    Guardar
                  </NeoButton>
                </div>
              </div>
            </div>
          </NeoCard>
        )}

        <NeoModal 
          open={isExchangeModalVisible} 
          title="Select Exchange" 
          onClose={() => setIsExchangeModalVisible(false)}
          footer={
            <NeoButton variant="outline" size="md" onClick={() => setIsExchangeModalVisible(false)}>
              Cancel
            </NeoButton>
          }
        >
          <div className="flex flex-col">
            {EXCHANGES.map((item) => (
              <button
                key={item}
                className={`py-3.5 border-b px-3 rounded-lg transition-colors text-left ${
                  exchangeId === item 
                    ? 'border-[#34d8ff]/20 bg-[#34d8ff]/10 text-[#34d8ff] font-bold tracking-widest text-center' 
                    : 'border-white/5 bg-transparent text-white/70 font-normal hover:bg-white/5 text-center'
                }`}
                onClick={() => {
                  setExchangeId(item);
                  setIsExchangeModalVisible(false);
                }}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
        </NeoModal>
      </div>
    </NeoLayout>
  );
}
