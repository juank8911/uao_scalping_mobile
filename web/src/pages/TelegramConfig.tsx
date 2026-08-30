import { useState, useEffect, useRef } from 'react';
import { NeoCard, NeoBadge, NeoButton } from 'jeikei-design-system';
import { SafeNeoLayout } from '../components/SafeNeoLayout';
import { CheckCircle, Wifi, WifiOff, RefreshCw, Send } from 'lucide-react';
import { useEngineWebSocket, subscribeCandles, unsubscribeCandles } from '../hooks/useEngineWebSocket';
import { createChart, ColorType, CrosshairMode, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { useEngineStore } from '../store/useEngineStore';
import {
  getTelegramPaperConfig,
  updateTelegramPaperConfig,
  getTelegramPaperStatus,
  getTelegramPaperOperations,
  fetchChartData,
  type TelegramPaperStatus,
  type TelegramPaperOperation,
} from '../services/api';

const API_BASE = '/api/v1/telegram';
import { getToken } from '../utils/auth';

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error desconocido' }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

type Step = 'config' | 'verify' | 'groups';

interface Group {
  id: string;
  title: string;
  is_group: boolean;
  is_channel: boolean;
  is_chat: boolean;
  is_monitored: boolean;
  expected_structure?: string;
  use_all?: boolean;
}

type ViewTab = 'settings' | 'messages' | 'paper';

interface AiResponse {
  approved?: boolean | null;
  is_signal?: boolean | null;
  reason?: string | null;
  confidence?: number | null;
  symbol?: string | null;
  direction?: string | null;
  entry_price?: number | null;
  stop_loss?: number | null;
}

interface TelegramMessage {
  id: string;
  telegram_message_id: number;
  chat_id: string;
  chat_title: string;
  sender: string | null;
  text: string;
  date: string;
  received_at?: string | null;
  order_status?: string | null;
  rejection_reason?: string | null;
  order_symbol?: string | null;
  order_direction?: string | null;
  ai_response?: AiResponse | null;
}


function PaperChart({
  symbol, operations,
}: {
  symbol: string;
  operations: TelegramPaperOperation[];
}) {
  const [timeframe, setTimeframe] = useState<string>('1h');
  const [loading, setLoading] = useState(false);

  const candlesSnapshot = useEngineStore((state) => state.candlesSnapshot);
  const latestCandle = useEngineStore((state) => state.latestCandle);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<any[]>([]);

  // Init Lightweight Charts
  useEffect(() => {
    if (chartContainerRef.current) {
      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      };

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#020202' },
          textColor: '#d1d4dc',
        },
        grid: {
          vertLines: { color: 'rgba(52, 216, 255, 0.04)' },
          horzLines: { color: 'rgba(52, 216, 255, 0.04)' },
        },
        crosshair: { mode: CrosshairMode.Normal },
        timeScale: { timeVisible: true, secondsVisible: false },
        width: chartContainerRef.current.clientWidth,
        height: 280,
      });

      chartRef.current = chart;

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#4ade80',
        downColor: '#f87171',
        borderVisible: false,
        wickUpColor: '#4ade80',
        wickDownColor: '#f87171',
        priceFormat: {
          type: 'price',
          precision: 6,
          minMove: 0.000001,
        },
      });

      candlestickSeriesRef.current = candlestickSeries;
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
        chartRef.current = null;
        candlestickSeriesRef.current = null;
      };
    }
  }, [symbol]);

  // Subscribe candles WS & fallback REST
  useEffect(() => {
    if (!symbol || !candlestickSeriesRef.current) return;

    setLoading(true);
    subscribeCandles(symbol, timeframe, 'TELEGRAM');

    fetchChartData(symbol, timeframe).then((data) => {
      if (candlestickSeriesRef.current && data && data.length > 0) {
        candlestickSeriesRef.current.setData(data);
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    return () => {
      if (symbol) {
        unsubscribeCandles(symbol, 'TELEGRAM');
      }
    };
  }, [symbol, timeframe]);

  // Live ticker ticks listener to update last candle in real-time
  useEffect(() => {
    const handleWsMessage = (e: Event) => {
      const payload = (e as CustomEvent).detail;
      if (payload?.event === 'ticker_update' && payload.symbol === symbol && candlestickSeriesRef.current) {
        const price = Number(payload.data?.last ?? payload.data?.close ?? payload.data?.price);
        if (Number.isFinite(price) && price > 0) {
          const snapshot = useEngineStore.getState().candlesSnapshot;
          if (snapshot && snapshot.length > 0) {
            const last = snapshot[snapshot.length - 1];
            candlestickSeriesRef.current.update({
              time: last.time,
              open: last.open,
              high: Math.max(last.high, price),
              low: Math.min(last.low, price),
              close: price,
            });
          }
        }
      }
    };

    window.addEventListener('ws:message', handleWsMessage);
    return () => window.removeEventListener('ws:message', handleWsMessage);
  }, [symbol]);

  // Update candles from store snapshot/update
  useEffect(() => {
    if (candlesSnapshot && candlestickSeriesRef.current) {
      candlestickSeriesRef.current.setData(candlesSnapshot);
    }
  }, [candlesSnapshot]);

  useEffect(() => {
    if (latestCandle && candlestickSeriesRef.current) {
      candlestickSeriesRef.current.update(latestCandle);
    }
  }, [latestCandle]);

  // Draw overlay price lines (Entry & TPs) & markers for executed orders
  useEffect(() => {
    const series = candlestickSeriesRef.current;
    if (!series) return;

    priceLinesRef.current.forEach((line) => series.removePriceLine(line));
    priceLinesRef.current = [];

    const activeOps = operations.filter(
      (op) => op.status !== 'REJECTED' && op.status !== 'CLOSED' && op.status !== 'CANCELED'
    );

    activeOps.forEach((op) => {
      const ep = op.entry_price ?? op.requested_entry_price;
      if (ep) {
        const line = series.createPriceLine({
          price: ep,
          color: op.direction === 'LONG' ? '#34d8ff' : '#f59e42',
          lineWidth: 2,
          lineStyle: 0,
          title: `Entrada ${op.direction}`,
        });
        priceLinesRef.current.push(line);
      }
      op.targets.forEach((t) => {
        if (t.status === 'CANCELED') return;
        const line = series.createPriceLine({
          price: t.price,
          color: t.status === 'HIT' ? '#4ade80' : '#22c55e',
          lineWidth: 1,
          lineStyle: 2,
          title: `TP${t.sequence}`,
        });
        priceLinesRef.current.push(line);
      });
    });

    // Markers for filled orders
    const markers: any[] = [];
    operations.forEach((op) => {
      if (op.filled_at && op.entry_price) {
        const filledTime = Math.floor(new Date(op.filled_at).getTime() / 1000);
        if (Number.isFinite(filledTime) && filledTime > 0) {
          markers.push({
            time: filledTime,
            position: op.direction === 'LONG' ? 'belowBar' : 'aboveBar',
            color: op.direction === 'LONG' ? '#34d8ff' : '#f59e42',
            shape: op.direction === 'LONG' ? 'arrowUp' : 'arrowDown',
            text: `Ejecutada ${op.direction}`,
          });
        }
      }
    });

    if (markers.length > 0) {
      markers.sort((a, b) => a.time - b.time);
      try {
        series.setMarkers(markers);
      } catch { /* ignorar descalce de timestamp de mercado */ }
    } else {
      series.setMarkers([]);
    }
  }, [operations, symbol]);

  return (
    <div className="flex flex-col w-full">
      <div className="flex justify-between items-center mb-2 px-1">
        <span className="text-white/70 text-xs font-bold">Temporalidad:</span>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          className="bg-[#34d8ff]/10 px-2.5 py-1 rounded border border-[#34d8ff]/20 text-[#34d8ff] font-bold text-xs outline-none"
        >
          <option value="1m" className="bg-black text-[#34d8ff]">1m</option>
          <option value="5m" className="bg-black text-[#34d8ff]">5m</option>
          <option value="15m" className="bg-black text-[#34d8ff]">15m</option>
          <option value="1h" className="bg-black text-[#34d8ff]">1h</option>
          <option value="4h" className="bg-black text-[#34d8ff]">4h</option>
          <option value="1d" className="bg-black text-[#34d8ff]">1d</option>
        </select>
      </div>
      <div className="relative w-full border border-white/10 rounded-lg overflow-hidden bg-[#020202]">
        {loading && (
          <div className="absolute inset-0 flex justify-center items-center bg-black/50 z-10">
            <div className="w-6 h-6 border-2 border-white/10 border-t-[#34d8ff] rounded-full animate-spin"></div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full" style={{ height: 280 }} />
      </div>
    </div>
  );
}

export default function TelegramConfigScreen() {

  const [activeTab, setActiveTab] = useState<ViewTab>('settings');
  // Step state
  const [step, setStep] = useState<Step>('config');

  // Config form
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Verify form
  const [code, setCode] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [twoFaPassword, setTwoFaPassword] = useState('');

  // Groups
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  // Status
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Messages
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

  // Telegram Paper (separate from HFT and prdictor)
  const [paperStatus, setPaperStatus] = useState<TelegramPaperStatus | null>(null);
  const [paperOperations, setPaperOperations] = useState<TelegramPaperOperation[]>([]);
  const [paperEnabled, setPaperEnabled] = useState(false);
  const [paperMaxPositions, setPaperMaxPositions] = useState(3);
  const [paperMaxLoss, setPaperMaxLoss] = useState(10);
  const [paperInvestmentAmount, setPaperInvestmentAmount] = useState('50.0');
  const [paperLeverage, setPaperLeverage] = useState('10');
  const [selectedPaperSymbol, setSelectedPaperSymbol] = useState<string | null>(null);
  const selectedPaperSymbolRef = useRef<string | null>(null);
  selectedPaperSymbolRef.current = selectedPaperSymbol;

  useEngineWebSocket(selectedPaperSymbol);

  const loadPaperData = async () => {
    try {
      const [config, status, operations] = await Promise.all([
        getTelegramPaperConfig(),
        getTelegramPaperStatus(),
        getTelegramPaperOperations(),
      ]);
      setPaperStatus(status);
      setPaperOperations(operations);
      setPaperEnabled(config.enabled);
      setPaperMaxPositions(config.max_positions);
      setPaperMaxLoss(config.max_realized_loss_usdt);
      if (config.investment_amount_usdt != null) {
        setPaperInvestmentAmount(config.investment_amount_usdt.toString());
      }
      if (config.leverage != null) {
        setPaperLeverage(config.leverage.toString());
      }
      if (!selectedPaperSymbolRef.current) {
        const activeItem = operations.find(
          (item) => item.symbol && item.status !== 'CLOSED' && item.status !== 'REJECTED' && item.status !== 'CANCELED'
        ) || operations.find((item) => item.symbol);
        if (activeItem?.symbol) {
          setSelectedPaperSymbol(activeItem.symbol);
        }
      }
    } catch (error) {
      console.error('Error cargando Telegram Paper:', error);
    }
  };

  const savePaperConfig = async () => {
    setMessage(null);

    const investment = parseFloat(paperInvestmentAmount);
    if (isNaN(investment) || investment <= 0) {
      setMessage({ text: 'El monto a invertir debe ser un número mayor a 0.', type: 'error' });
      return;
    }

    const lev = parseInt(paperLeverage, 10);
    if (isNaN(lev) || lev < 1 || lev > 125) {
      setMessage({ text: 'El apalancamiento base debe ser un entero entre 1 y 125.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await updateTelegramPaperConfig({
        enabled: paperEnabled,
        max_positions: paperMaxPositions,
        max_realized_loss_usdt: paperMaxLoss,
        investment_amount_usdt: investment,
        leverage: lev,
      });
      setMessage({ text: 'Configuración Telegram Paper guardada exitosamente.', type: 'success' });
      await loadPaperData();
    } catch (e: any) {
      setMessage({ text: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaperData();
    const timer = window.setInterval(loadPaperData, 5000);
    return () => window.clearInterval(timer);
  }, []);


  useEffect(() => {
    apiFetch('/config').then((data) => {
      if (data.configured) {
        setApiId(data.api_id || '');
        setApiHash(data.api_hash || '');
        setPhone(data.phone || '');
        setIsConnected(data.is_connected);
        if (data.is_connected) {
          setStep('groups');
          loadGroups();
        }
      }
    }).catch(() => {});
  }, []);

  const loadMessages = async () => {
    setLoadingMessages(true);
    try {
      const data = await apiFetch('/messages');
      setMessages(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'messages') {
      loadMessages();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleTelegramMessage = (event: Event) => {
      const payload = (event as CustomEvent).detail;
      if (payload?.event === 'telegram_paper_order_update' && payload.data) {
        loadPaperData();
        return;
      }
      if (payload?.event !== 'new_telegram_message' || !payload.data) return;

      const data = payload.data;
      const telegramMessageId = Number(data.telegram_message_id);
      const incoming: TelegramMessage = {
        id: `live-${data.chat_id}-${telegramMessageId || Date.now()}`,
        telegram_message_id: telegramMessageId,
        chat_id: String(data.chat_id || ''),
        chat_title: String(data.chat_title || 'Desconocido'),
        sender: data.sender_name ? String(data.sender_name) : null,
        text: String(data.text || ''),
        date: data.date || new Date().toISOString(),
        received_at: new Date().toISOString(),
      };

      setMessages((previous) => {
        const isDuplicate = telegramMessageId > 0 && previous.some(
          (message) => message.chat_id === incoming.chat_id
            && message.telegram_message_id === telegramMessageId,
        );
        if (isDuplicate) return previous;
        return [incoming, ...previous].slice(0, 500);
      });
    };

    window.addEventListener('ws:message', handleTelegramMessage);
    return () => window.removeEventListener('ws:message', handleTelegramMessage);
  }, []);

  const loadGroups = async () => {
    try {
      const data: Group[] = await apiFetch('/groups');
      setGroups(data);
      const monitored = new Set(data.filter(g => g.is_monitored).map(g => g.id));
      setSelectedGroups(monitored);
    } catch (e: any) {
      setMessage({ text: e.message, type: 'error' });
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch('/config', {
        method: 'POST',
        body: JSON.stringify({ api_id: apiId, api_hash: apiHash, phone, password: password || undefined }),
      });
      setMessage({ text: 'Configuración guardada. Enviando código a Telegram...', type: 'info' });
      await apiFetch('/auth/send_code', { method: 'POST' });
      setMessage({ text: '📱 Código enviado a tu app de Telegram. Ingrésalo abajo.', type: 'success' });
      setStep('verify');
    } catch (e: any) {
      setMessage({ text: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch('/auth/verify_code', {
        method: 'POST',
        body: JSON.stringify({
          code,
          password: needs2fa ? twoFaPassword : undefined,
        }),
      });
      setIsConnected(true);
      setMessage({ text: '✅ ¡Conectado con éxito!', type: 'success' });
      setStep('groups');
      await loadGroups();
    } catch (e: any) {
      if (e.message.includes('SessionPasswordNeededError')) {
        setNeeds2fa(true);
        setMessage({ text: '🔐 Tu cuenta tiene 2FA activo. Ingresa tu contraseña de Telegram.', type: 'info' });
      } else {
        setMessage({ text: e.message, type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGroup = (id: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpdateGroupAttr = (id: string, attr: 'expected_structure' | 'use_all', value: any) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, [attr]: value } : g));
  };

  const handleSaveGroups = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const payloadGroups = Array.from(selectedGroups).map(id => {
        const g = groups.find(x => x.id === id);
        return {
          group_id: id,
          expected_structure: g?.expected_structure || null,
          use_all: g?.use_all || false,
        };
      });

      await apiFetch('/groups/monitor', {
        method: 'POST',
        body: JSON.stringify({ groups: payloadGroups }),
      });
      setMessage({ text: `✅ ${selectedGroups.size} grupos siendo monitoreados`, type: 'success' });
    } catch (e: any) {
      setMessage({ text: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

    const msgColor = message?.type === 'error' ? 'text-red-400' : message?.type === 'success' ? 'text-green-400' : 'text-[#34d8ff]';
  const paperSymbols = Array.from(new Set(
    paperOperations
      .filter((item) => item.status !== 'CLOSED' && item.status !== 'REJECTED' && item.status !== 'CANCELED')
      .map((item) => item.symbol)
      .filter((symbol): symbol is string => Boolean(symbol))
  ));
  const selectedPaperOperations = paperOperations.filter((item) => item.symbol === selectedPaperSymbol);

  return (

    <SafeNeoLayout>
      <div className="flex flex-col flex-1 pt-16 pb-28 h-full max-w-2xl mx-auto w-full px-4">
        {/* Header */}
        <div className="flex flex-row justify-between items-center mb-6">
          <div>
            <h1 className="text-white text-2xl font-bold">Telegram</h1>
            <p className="text-white/50 text-xs mt-0.5">Monitoreo de grupos y señales</p>
          </div>
          <div className="flex items-center gap-2">
            {isConnected
              ? <><Wifi size={16} className="text-green-400" /><span className="text-green-400 text-xs font-bold">CONECTADO</span></>
              : <><WifiOff size={16} className="text-red-400" /><span className="text-red-400 text-xs font-bold">DESCONECTADO</span></>
            }
          </div>
        </div>

        {/* Tabs Selector */}
        <div className="flex border-b border-white/10 mb-6">
          <button 
            className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'settings' ? 'border-[#34d8ff] text-[#34d8ff]' : 'border-transparent text-white/50 hover:text-white'}`}
            onClick={() => setActiveTab('settings')}
          >
            Configuración
          </button>
                    <button 
            className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'messages' ? 'border-[#34d8ff] text-[#34d8ff]' : 'border-transparent text-white/50 hover:text-white'}`}
            onClick={() => setActiveTab('messages')}
          >
            Mensajes Recientes
          </button>
          <button 
            className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'paper' ? 'border-[#34d8ff] text-[#34d8ff]' : 'border-transparent text-white/50 hover:text-white'}`}
            onClick={() => setActiveTab('paper')}
          >
            Paper
          </button>

        </div>

        {activeTab === 'settings' ? (
          <>
        {/* Step Indicator */}
        <div className="flex gap-2 mb-6">
          {(['config', 'verify', 'groups'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${step === s ? 'bg-[#34d8ff] text-black border-[#34d8ff]' : isConnected && i < 2 ? 'bg-green-400/20 text-green-400 border-green-400/40' : 'bg-white/5 text-white/30 border-white/10'}`}>
                {isConnected && i < 2 ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span className={`text-xs font-bold tracking-widest ${step === s ? 'text-[#34d8ff]' : 'text-white/30'}`}>
                {s === 'config' ? 'CREDENCIALES' : s === 'verify' ? 'VERIFICAR' : 'GRUPOS'}
              </span>
              {i < 2 && <div className="flex-1 h-px bg-white/10" />}
            </div>
          ))}
        </div>

        {/* Feedback message */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg border border-current/20 text-sm font-medium ${msgColor}`}>
            {message.text}
          </div>
        )}

        {/* STEP 1: Config */}
        {step === 'config' && (
          <NeoCard title="Credenciales de API Telegram" value="">
            <div className="mt-4 flex flex-col gap-4">
              <div className="bg-[#34d8ff]/5 border border-[#34d8ff]/20 rounded-lg p-3 text-xs text-white/60">
                <p className="font-bold text-[#34d8ff] mb-1">¿Cómo obtenerlas?</p>
                <p>Ve a <span className="text-[#34d8ff]">my.telegram.org</span> → API Development Tools → Crea una app y copia tu <strong>API ID</strong> y <strong>API Hash</strong>.</p>
              </div>

              <div>
                <label className="text-white/60 text-xs font-bold tracking-widest mb-1 block">API ID</label>
                <input
                  value={apiId}
                  onChange={e => setApiId(e.target.value)}
                  placeholder="Ej: 12345678"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#34d8ff]/50"
                />
              </div>
              <div>
                <label className="text-white/60 text-xs font-bold tracking-widest mb-1 block">API Hash</label>
                <input
                  value={apiHash}
                  onChange={e => setApiHash(e.target.value)}
                  placeholder="Ej: abc123def456..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#34d8ff]/50"
                />
              </div>
              <div>
                <label className="text-white/60 text-xs font-bold tracking-widest mb-1 block">Número de Teléfono</label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+57 300 000 0000"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#34d8ff]/50"
                />
              </div>
              <div>
                <label className="text-white/60 text-xs font-bold tracking-widest mb-1 block">Contraseña 2FA (opcional)</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Solo si tienes 2FA activo"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#34d8ff]/50"
                />
              </div>
              <NeoButton variant="primary" size="lg" onClick={handleSaveConfig} disabled={loading}>
                {loading ? 'Guardando...' : '📱 Guardar y Enviar Código'}
              </NeoButton>
            </div>
          </NeoCard>
        )}

        {/* STEP 2: Verify Code */}
        {step === 'verify' && (
          <NeoCard title="Verificar Código" value="">
            <div className="mt-4 flex flex-col gap-4">
              <p className="text-white/60 text-sm">Revisa tu app de Telegram — te llegó un mensaje con el código de verificación.</p>
              <div>
                <label className="text-white/60 text-xs font-bold tracking-widest mb-1 block">Código de Verificación</label>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="Ej: 12345"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#34d8ff]/50 text-center text-xl tracking-widest"
                />
              </div>
              {needs2fa && (
                <div>
                  <label className="text-white/60 text-xs font-bold tracking-widest mb-1 block">Contraseña 2FA</label>
                  <input
                    type="password"
                    value={twoFaPassword}
                    onChange={e => setTwoFaPassword(e.target.value)}
                    placeholder="Contraseña de verificación en dos pasos"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#34d8ff]/50"
                  />
                </div>
              )}
              <div className="flex gap-3">
                <NeoButton variant="outline" size="md" onClick={() => setStep('config')} disabled={loading}>
                  ← Atrás
                </NeoButton>
                <NeoButton variant="primary" size="md" onClick={handleVerifyCode} disabled={loading}>
                  {loading ? 'Verificando...' : <><CheckCircle size={16} className="inline mr-1" />Verificar</>}
                </NeoButton>
              </div>
            </div>
          </NeoCard>
        )}

        {/* STEP 3: Groups */}
        {step === 'groups' && (
          <NeoCard title={`Grupos, canales y chats (${groups.length})`} value="">
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/50 text-xs">{selectedGroups.size} seleccionados para monitorear</p>
                <button onClick={loadGroups} className="text-[#34d8ff] text-xs flex items-center gap-1">
                  <RefreshCw size={12} /> Actualizar
                </button>
              </div>

              {groups.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-6">Cargando grupos...</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
                  {groups.map(g => (
                    <div key={g.id} className="flex flex-col gap-1">
                      <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        selectedGroups.has(g.id)
                          ? 'bg-[#34d8ff]/10 border-[#34d8ff]/40 text-[#34d8ff]'
                          : 'bg-white/3 border-white/10 text-white/70 hover:bg-white/6'
                      }`}>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggleGroup(g.id)}
                            className={`w-4 h-4 rounded flex items-center justify-center border ${selectedGroups.has(g.id) ? 'bg-[#34d8ff] border-[#34d8ff]' : 'border-white/30 bg-transparent'}`}
                          >
                            {selectedGroups.has(g.id) && <CheckCircle size={12} className="text-black" />}
                          </button>
                          <span className="text-sm font-medium text-left">{g.title}</span>
                        </div>
                        <NeoBadge
                          children={g.is_chat ? 'Chat' : g.is_channel ? 'Canal' : 'Grupo'}
                          variant={g.is_chat ? 'accent' : g.is_channel ? 'accent' : 'success'}
                        />
                      </div>
                      
                      {selectedGroups.has(g.id) && (
                        <div className="mt-2 pl-8 pr-2 pb-2 flex flex-col gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={g.use_all || false}
                              onChange={(e) => handleUpdateGroupAttr(g.id, 'use_all', e.target.checked)}
                              className="w-4 h-4 rounded bg-white/10 border-white/20 text-[#34d8ff] focus:ring-[#34d8ff]"
                            />
                            <span className="text-white/70 text-xs font-medium">Procesar todos los mensajes (ignorar estructura)</span>
                          </label>
                          
                          {!g.use_all && (
                            <div>
                              <label className="text-white/60 text-xs font-bold tracking-widest mb-1 block">Estructura esperada</label>
                              <textarea
                                value={g.expected_structure || ''}
                                onChange={(e) => handleUpdateGroupAttr(g.id, 'expected_structure', e.target.value)}
                                placeholder="Ej: BUY BTC\nTP: 60000\nSL: 55000"
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-[#34d8ff]/50 min-h-[60px]"
                                rows={2}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <NeoButton variant="outline" size="md" onClick={() => { setStep('config'); setIsConnected(false); }} disabled={loading}>
                  Reconfigurar
                </NeoButton>
                <NeoButton variant="primary" size="md" onClick={handleSaveGroups} disabled={loading}>
                  {loading ? 'Guardando...' : <><Send size={14} className="inline mr-1.5" />Activar Monitoreo</>}
                </NeoButton>
              </div>
            </div>
          </NeoCard>
                )}

          </>
        ) : activeTab === 'messages' ? (
          <NeoCard title="Mensajes Persistidos" value="">

            <div className="mt-4 flex flex-col gap-4">
              <div className="flex justify-between items-center gap-4">
                <p className="text-white/50 text-sm">Mensajes admitidos y guardados en la base de datos.</p>
                <button onClick={loadMessages} className="text-[#34d8ff] text-xs flex items-center gap-1 shrink-0" disabled={loadingMessages}>
                  <RefreshCw size={12} className={loadingMessages ? "animate-spin" : ""} /> Actualizar
                </button>
              </div>

              {!isConnected && messages.length > 0 && (
                <p className="text-amber-300/80 text-xs border border-amber-300/20 rounded-lg px-3 py-2">
                  Telegram está desconectado. Se muestran los mensajes que ya quedaron persistidos.
                </p>
              )}

              {loadingMessages ? (
                <p className="text-white/40 text-sm py-4 text-center">Cargando mensajes...</p>
              ) : messages.length === 0 ? (
                <p className="text-white/40 text-sm py-4 text-center">
                  {isConnected ? 'No hay mensajes admitidos todavía.' : 'No hay mensajes persistidos. Configura y conecta Telegram para iniciar la prueba.'}
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto rounded-lg border border-white/10">
                  <table className="w-full min-w-[820px] text-left text-xs">
                    <thead className="sticky top-0 bg-[#101010] text-white/50 uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-3 font-bold">Fecha</th>
                        <th className="px-3 py-3 font-bold">Grupo / canal</th>
                        <th className="px-3 py-3 font-bold">Remitente</th>
                        <th className="px-3 py-3 font-bold">Mensaje</th>
                        <th className="px-3 py-3 font-bold">IA</th>
                        <th className="px-3 py-3 font-bold">Orden</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {messages.map(msg => {
                        const ai = msg.ai_response;
                        const hasOrder = !!msg.order_status;
                        const orderApproved = msg.order_status && msg.order_status !== 'REJECTED';

                        return (
                          <tr key={msg.id} className="align-top hover:bg-white/5">
                            <td className="px-3 py-3 whitespace-nowrap text-white/50">
                              {new Date(msg.date).toLocaleString()}
                            </td>
                            <td className="px-3 py-3 text-[#34d8ff] font-bold max-w-[160px] break-words">
                              {msg.chat_title}
                            </td>
                            <td className="px-3 py-3 text-white/60 max-w-[120px] break-words">
                              {msg.sender || 'Desconocido'}
                            </td>
                            <td className="px-3 py-3 text-white/80 whitespace-pre-wrap break-words font-mono min-w-[220px] max-w-[280px]">
                              {msg.text}
                            </td>

                            {/* Columna IA */}
                            <td className="px-3 py-3 min-w-[180px]">
                              {ai ? (
                                <div className="flex flex-col gap-1">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit ${
                                    ai.approved === true
                                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                      : ai.is_signal === false
                                      ? 'bg-white/10 text-white/50 border border-white/15'
                                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                  }`}>
                                    {ai.approved === true ? '✅ Aprobada' : ai.is_signal === false ? '⬜ No es señal' : '❌ Rechazada'}
                                  </span>
                                  {ai.symbol && (
                                    <span className="text-[#34d8ff] font-bold text-[10px]">{ai.symbol} {ai.direction}</span>
                                  )}
                                  {ai.entry_price && (
                                    <span className="text-white/50 text-[10px]">Entrada: {ai.entry_price} · SL: {ai.stop_loss ?? '—'}</span>
                                  )}
                                  {ai.confidence != null && (
                                    <span className="text-white/40 text-[10px]">Confianza: {(Number(ai.confidence) * 100).toFixed(0)}%</span>
                                  )}
                                  {ai.reason && (
                                    <span className="text-amber-300/80 text-[10px] break-words max-w-[170px]">{ai.reason}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-white/25 text-[10px]">—</span>
                              )}
                            </td>

                            {/* Columna Orden */}
                            <td className="px-3 py-3 min-w-[140px]">
                              {hasOrder ? (
                                <div className="flex flex-col gap-1">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit ${
                                    orderApproved
                                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                  }`}>
                                    {orderApproved ? '📈 Orden colocada' : '🚫 Rechazada'}
                                  </span>
                                  {msg.order_symbol && (
                                    <span className="text-white/70 font-bold text-[10px]">{msg.order_symbol} · {msg.order_direction}</span>
                                  )}
                                  {msg.order_status && (
                                    <span className={`text-[10px] font-mono ${
                                      msg.order_status === 'OPEN' ? 'text-green-300'
                                      : msg.order_status === 'CLOSED' ? 'text-white/50'
                                      : 'text-red-300/80'
                                    }`}>{msg.order_status}</span>
                                  )}
                                  {msg.rejection_reason && (
                                    <span className="text-red-300/70 text-[10px] break-words max-w-[130px]">{msg.rejection_reason}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-white/25 text-[10px]">Sin proceso</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
                    </NeoCard>
        ) : (
          <div className="flex flex-col gap-4">
            <NeoCard title="Configuración Telegram Paper" value={paperStatus?.blocked_by_loss ? 'BLOQUEADO' : paperStatus?.enabled ? 'ACTIVO' : 'INACTIVO'}>
              <div className="mt-4 flex flex-col gap-4">
                <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-white/65">
                  <p className="font-bold text-amber-200 mb-1">Ruta adicional, separada de HFT</p>
                  <p>Solo acepta futuros. El mensaje con precio crea LIMIT; sin precio crea MARKET Paper. La validación usa velas 10s/1m/3m agregado/5m/15m, sin llamar a prdictor ni modificar el scalping de alta frecuencia.</p>
                </div>
                <label className="flex items-center justify-between gap-3 text-sm text-white/80 cursor-pointer">
                  <span>Habilitar ejecución Telegram Paper (directamente)</span>
                  <input type="checkbox" checked={paperEnabled} onChange={(event) => setPaperEnabled(event.target.checked)} className="w-4 h-4 accent-[#34d8ff] cursor-pointer" />
                </label>
                <div>
                  <label className="text-white/60 text-xs font-bold tracking-widest mb-1 block">Máximo de posiciones abiertas</label>
                  <input type="number" min={1} max={3} value={paperMaxPositions} onChange={(event) => setPaperMaxPositions(Math.min(3, Math.max(1, Number(event.target.value) || 1)))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#34d8ff]/50" />
                  <p className="text-white/40 text-xs mt-1">Máximo confirmado: 3. Solo cuentan posiciones Telegram abiertas.</p>
                </div>
                <div>
                  <label className="text-white/60 text-xs font-bold tracking-widest mb-1 block">Límite de pérdida realizada Telegram (USDT)</label>
                  <input type="number" min={0.01} step={0.01} value={paperMaxLoss} onChange={(event) => setPaperMaxLoss(Math.max(0.01, Number(event.target.value) || 10))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#34d8ff]/50" />
                  <p className="text-white/40 text-xs mt-1">Bloquea nuevas entradas al alcanzar −{paperMaxLoss.toFixed(2)} USDT; no cuenta PnL abierto ni órdenes pendientes.</p>
                </div>
                <div>
                  <label className="text-white/60 text-xs font-bold tracking-widest mb-1 block">Monto a Invertir por Operación (USDT)</label>
                  <input type="number" min={0.01} step={0.01} value={paperInvestmentAmount} onChange={(event) => setPaperInvestmentAmount(event.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#34d8ff]/50" />
                  <p className="text-white/40 text-xs mt-1">Cantidad en USDT que se asignará como margen para cada señal ejecutada de Telegram.</p>
                </div>
                <div>
                  <label className="text-white/60 text-xs font-bold tracking-widest mb-1 block">Apalancamiento Base (x)</label>
                  <input type="number" min={1} max={125} step={1} value={paperLeverage} onChange={(event) => setPaperLeverage(event.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#34d8ff]/50" />
                  <p className="text-white/40 text-xs mt-1">Apalancamiento que se aplicará cuando la señal recibida no especifique su propio apalancamiento.</p>
                </div>
                {paperStatus && <div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded border border-white/10 p-2"><span className="block text-white/40">Abiertas</span><strong className="text-white">{paperStatus.open_positions}</strong></div><div className="rounded border border-white/10 p-2"><span className="block text-white/40">Pendientes</span><strong className="text-white">{paperStatus.pending_orders}</strong></div><div className="rounded border border-white/10 p-2"><span className="block text-white/40">PnL realizado</span><strong className={paperStatus.realized_pnl < 0 ? 'text-red-300' : 'text-green-300'}>{paperStatus.realized_pnl.toFixed(4)}</strong></div></div>}
                <NeoButton variant="primary" size="md" onClick={savePaperConfig} disabled={loading}>{loading ? 'Guardando...' : 'Guardar Configuración'}</NeoButton>
              </div>
            </NeoCard>

            <NeoCard title="Operaciones Telegram Paper" value={paperStatus?.blocked_by_loss ? 'BLOQUEADO −10 USDT' : `${paperStatus?.open_positions || 0}/3 abiertas`}>
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-white/50 text-xs">Órdenes y posiciones aisladas del HFT.</p>
                  <button onClick={loadPaperData} className="text-[#34d8ff] text-xs flex items-center gap-1"><RefreshCw size={12} /> Actualizar</button>
                </div>
                {paperSymbols.length > 0 && <div className="flex gap-2 overflow-x-auto pb-1">{paperSymbols.map((symbol) => <button key={symbol} onClick={() => setSelectedPaperSymbol(symbol)} className={`px-3 py-1.5 rounded border text-xs font-bold whitespace-nowrap ${selectedPaperSymbol === symbol ? 'border-[#34d8ff] text-[#34d8ff] bg-[#34d8ff]/10' : 'border-white/10 text-white/60'}`}>{symbol}</button>)}</div>}
                {selectedPaperSymbol && (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <div className="flex items-center justify-between mb-1 px-1">
                      <span className="text-[#34d8ff] font-bold text-sm">{selectedPaperSymbol}</span>
                    </div>
                    <PaperChart
                      symbol={selectedPaperSymbol}
                      operations={selectedPaperOperations}
                    />
                  </div>
                )}
                {selectedPaperOperations.length === 0 ? <p className="text-white/40 text-sm text-center py-6">Aún no hay operaciones Telegram Paper.</p> : <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto">{selectedPaperOperations.map((operation) => {
                  const latestPrice = selectedPaperSymbol ? useEngineStore.getState().latestPrices[selectedPaperSymbol] : null;
                  const entryP = operation.entry_price ?? operation.requested_entry_price;
                  const isLong = (operation.direction || operation.side || '').toUpperCase() === 'LONG' || (operation.direction || operation.side || '').toUpperCase() === 'BUY';
                  const lev = operation.leverage || Number(paperLeverage) || 1;
                  const inv = Number(paperInvestmentAmount) || 50;

                  let liveUnrealizedPnl: number | null = null;
                  if (operation.status === 'FILLED' || operation.status === 'OPEN' || operation.status === 'PARTIALLY_FILLED') {
                    if (entryP && latestPrice && entryP > 0) {
                      const returnPct = isLong ? (latestPrice - entryP) / entryP : (entryP - latestPrice) / entryP;
                      liveUnrealizedPnl = returnPct * inv * lev;
                    }
                  }

                  return (
                    <div key={operation.id} className="rounded-lg border border-white/10 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white">{operation.direction || operation.side} · {operation.entry_type}</span>
                        <span className={operation.status === 'CLOSED' ? 'text-white/50' : operation.status === 'REJECTED' ? 'text-red-300' : 'text-green-300'}>{operation.status}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-white/60">
                        <span>Entrada: {entryP ?? '—'}</span>
                        <span>Leverage: {lev}x</span>
                        <span>Pendiente: {operation.remaining_amount ?? '—'}</span>
                        <span>
                          {liveUnrealizedPnl != null ? (
                            <span className={liveUnrealizedPnl >= 0 ? 'text-[#00ff88] font-bold' : 'text-[#ff3366] font-bold'}>
                              PnL Flotante: {liveUnrealizedPnl >= 0 ? '+' : ''}{liveUnrealizedPnl.toFixed(4)} USDT
                            </span>
                          ) : (
                            <span>PnL Realizado: {Number(operation.realized_pnl || 0).toFixed(4)} USDT</span>
                          )}
                        </span>
                      </div>
                      {operation.rejection_reason && <p className="text-red-300/80 mt-2">{operation.rejection_reason}</p>}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {operation.targets.map((target) => <span key={target.id} className="rounded bg-white/5 px-2 py-1 text-white/55">TP{target.sequence}: {target.price} ({target.allocation_pct}%) · {target.status}</span>)}
                      </div>
                    </div>
                  );
                })}</div>}
              </div>
            </NeoCard>
          </div>
        )}
      </div>

    </SafeNeoLayout>
  );
}
