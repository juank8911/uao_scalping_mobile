import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NeoLayout, NeoCard, NeoInput, NeoButton } from 'jeikei-design-system';
import { authenticateBiometrically } from '../utils/auth';
import { login } from '../services/api';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError('');
    
    try {
      const bioSuccess = await authenticateBiometrically('Autenticación requerida para acceder');
      
      if (!bioSuccess) {
        setError('Autenticación fallida.');
        return;
      }
      
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas.');
    }
  };

  return (
    <NeoLayout>
      <div className="flex flex-col flex-1 justify-center p-6 h-screen">
        <NeoCard title="UAO Access" value="" trend={{ value: 'SECURE', direction: 'up' }}>
          <div className="mt-4 flex flex-col gap-4">
            <NeoInput
              label="Username"
              placeholder="Enter username"
              value={username}
              onChange={(e: any) => setUsername(e.target.value)}
            />
            <NeoInput
              label="Password"
              placeholder="Enter password"
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
              type="password"
            />

            {error ? <p className="text-[#ff4d4f] mt-3 text-xs">{error}</p> : null}

            <div className="mt-6">
              <NeoButton variant="primary" size="md" onClick={handleLogin}>
                Log In
              </NeoButton>
            </div>
          </div>
        </NeoCard>
      </div>
    </NeoLayout>
  );
}
