import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { NeoLayout, NeoCard, NeoInput, NeoButton } from 'jeikei-design-system/native';
import { authenticateBiometrically, saveToken } from '../utils/auth';
import { login } from '../services/api';

export default function LoginScreen({ navigation }: any) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    
    try {
      const bioSuccess = await authenticateBiometrically('Autenticación Biométrica requerida para acceder');
      
      if (!bioSuccess) {
        setError('Autenticación biométrica fallida.');
        return;
      }
      
      await login(username, password);
      navigation.replace('MainDrawer');
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas.');
    }
  };

  return (
    <NeoLayout>
      <View style={styles.container}>
        <NeoCard title="UAO Access" value="" trend={{ value: 'SECURE', direction: 'up' }}>
          <View style={styles.form}>
            <NeoInput
              label="Username"
              placeholder="Enter username"
              value={username}
              onChangeText={setUsername}
            />
            <View style={{ height: 16 }} />
            <NeoInput
              label="Password"
              placeholder="Enter password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={{ height: 24 }} />
            <NeoButton variant="primary" size="md" onPress={handleLogin}>
              Log In
            </NeoButton>
          </View>
        </NeoCard>
      </View>
    </NeoLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  form: {
    marginTop: 16,
  },
  error: {
    color: '#ff4d4f',
    marginTop: 12,
    fontSize: 12,
  }
});
