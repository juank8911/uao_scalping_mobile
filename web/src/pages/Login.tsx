import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NeoLayout, NeoCard, NeoInput, NeoButton } from 'jeikei-design-system';
import { login } from '../services/api';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas. Verifica usuario y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <NeoLayout>
      <div className="flex flex-col justify-center items-center min-h-screen p-6">
        <div className="w-full max-w-[420px] relative z-10">
          {/* Logo / título */}
          <div className="text-center mb-8">
            <p className="text-[var(--neo-accent)] font-mono text-[11px] tracking-widest mb-2 font-bold uppercase">
              UAO SCALPING ENGINE
            </p>
            <h1 className="text-white text-[28px] font-extrabold m-0 tracking-tight">JeiKei Access</h1>
            <p className="text-white/40 text-[13px] mt-2">Autenticación segura al motor de trading</p>
          </div>

          <NeoCard title="CREDENCIALES" value="" trend={{ value: 'SECURE', direction: 'up' }}>
            <div className="flex flex-col gap-4 mt-4">
              <NeoInput
                label="Usuario"
                placeholder="Ingresa tu usuario"
                value={username}
                onChange={(e: any) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <NeoInput
                label="Contraseña"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e: any) => setPassword(e.target.value)}
                type="password"
                onKeyDown={handleKeyDown}
              />

              {error && (
                <div className="bg-[#ef5350]/10 border border-[#ef5350]/30 rounded-lg px-3.5 py-2.5">
                  <p className="text-[#ef5350] text-[13px] m-0 font-medium">⚠ {error}</p>
                </div>
              )}

              <div className="mt-2">
                <NeoButton variant="primary" size="md" onClick={handleLogin} disabled={loading || !username || !password}>
                  {loading ? 'Conectando...' : 'Iniciar Sesión'}
                </NeoButton>
              </div>
            </div>
          </NeoCard>

          <p className="text-white/20 text-[11px] text-center mt-6 font-mono tracking-widest">
            NEURAL // NEON // LIVING_INTERFACE
          </p>
        </div>
      </div>
    </NeoLayout>
  );
}
