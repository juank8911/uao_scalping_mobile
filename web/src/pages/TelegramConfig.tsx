import { useState, useEffect } from 'react';
import { NeoCard, NeoBadge, NeoButton } from 'jeikei-design-system';
import { SafeNeoLayout } from '../components/SafeNeoLayout';
import { CheckCircle, Wifi, WifiOff, RefreshCw, Send } from 'lucide-react';

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
  is_monitored: boolean;
  expected_structure?: string;
  use_all?: boolean;
}

type ViewTab = 'settings' | 'messages';

interface TelegramMessage {
  id: string;
  chat_id: string;
  chat_title: string;
  sender: string;
  text: string;
  date: string;
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

  // Load current config on mount
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
    if (activeTab === 'messages' && isConnected) {
      loadMessages();
    }
  }, [activeTab, isConnected]);

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
          <NeoCard title={`Grupos y Canales (${groups.length})`} value="">
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
                          children={g.is_channel ? 'Canal' : 'Grupo'}
                          variant={g.is_channel ? 'accent' : 'success'}
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
        ) : (
          <NeoCard title="Últimos Mensajes" value="">
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <p className="text-white/50 text-sm">Mensajes recibidos de tus grupos monitoreados.</p>
                <button onClick={loadMessages} className="text-[#34d8ff] text-xs flex items-center gap-1" disabled={loadingMessages}>
                  <RefreshCw size={12} className={loadingMessages ? "animate-spin" : ""} /> Actualizar
                </button>
              </div>
              
              {!isConnected ? (
                <p className="text-white/40 text-sm py-4 text-center">Debes configurar y conectar Telegram primero.</p>
              ) : messages.length === 0 ? (
                <p className="text-white/40 text-sm py-4 text-center">No hay mensajes recientes.</p>
              ) : (
                <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-2">
                  {messages.map(msg => (
                    <div key={msg.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[#34d8ff] font-bold text-sm">{msg.chat_title}</span>
                          <span className="text-white/40 text-xs">por {msg.sender}</span>
                        </div>
                        <span className="text-white/40 text-xs">
                          {new Date(msg.date).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-white/80 text-sm whitespace-pre-wrap font-mono bg-black/20 p-2 rounded">
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </NeoCard>
        )}
      </div>
    </SafeNeoLayout>
  );
}
