import React, { useEffect, useState } from 'react';
import { NeoModal } from './NeoModal';
import { NeoButton, NeoInput } from 'jeikei-design-system';

export const AuthModal = () => {
  const [visible, setVisible] = useState(false);
  const [promptMessage, setPromptMessage] = useState('');
  const [password, setPassword] = useState('');
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

  useEffect(() => {
    const handleRequireAuth = (event: Event) => {
      const customEvent = event as CustomEvent;
      setPromptMessage(customEvent.detail.promptMessage);
      setResolvePromise(() => customEvent.detail.resolve);
      setVisible(true);
      setPassword('');
    };
    window.addEventListener('require-auth-modal', handleRequireAuth);
    return () => window.removeEventListener('require-auth-modal', handleRequireAuth);
  }, []);

  const handleConfirm = () => {
    if (password.length > 0) {
      if (resolvePromise) resolvePromise(true);
      setVisible(false);
    }
  };

  const handleCancel = () => {
    if (resolvePromise) resolvePromise(false);
    setVisible(false);
  };

  return (
    <NeoModal visible={visible} title="Autorización Requerida" onClose={handleCancel}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center', margin: 0 }}>
          {promptMessage}
        </p>
        <NeoInput
          type="password"
          placeholder="Ingresa tu contraseña / PIN"
          value={password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleConfirm(); }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          <NeoButton variant="outline" onClick={handleCancel}>
            Cancelar
          </NeoButton>
          <NeoButton variant="primary" onClick={handleConfirm} disabled={password.length === 0}>
            Confirmar
          </NeoButton>
        </div>
      </div>
    </NeoModal>
  );
};
