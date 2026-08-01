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
    // In a real scenario, you'd validate the password against the backend or a local hash.
    // For this migration, we assume any non-empty password passes the "biometric/PIN" check.
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
      <div className="flex flex-col gap-4">
        <p className="text-white/80 text-sm text-center">
          {promptMessage}
        </p>
        <NeoInput
          type="password"
          placeholder="Ingresa tu contraseña / PIN"
          value={password}
          onChange={(e: any) => setPassword(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-3 mt-4">
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
