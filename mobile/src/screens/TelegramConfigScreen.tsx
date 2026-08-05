import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { NeoLayout, NeoCard, NeoBadge, NeoButton } from 'jeikei-design-system/native';
import { apiFetchTelegram } from '../services/api';

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

  // Messages
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    apiFetchTelegram('/config').then((data) => {
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
      const data = await apiFetchTelegram('/messages');
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
      const data: Group[] = await apiFetchTelegram('/groups');
      setGroups(data);
      const monitored = new Set(data.filter(g => g.is_monitored).map(g => g.id));
      setSelectedGroups(monitored);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      await apiFetchTelegram('/config', {
        method: 'POST',
        body: JSON.stringify({ api_id: apiId, api_hash: apiHash, phone, password: password || undefined }),
      });
      Alert.alert('Configuración guardada', 'Enviando código a Telegram...');
      await apiFetchTelegram('/auth/send_code', { method: 'POST' });
      Alert.alert('Éxito', 'Código enviado a tu app de Telegram. Ingrésalo a continuación.');
      setStep('verify');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    try {
      await apiFetchTelegram('/auth/verify_code', {
        method: 'POST',
        body: JSON.stringify({
          code,
          password: needs2fa ? twoFaPassword : undefined,
        }),
      });
      setIsConnected(true);
      Alert.alert('Éxito', 'Telegram conectado exitosamente.');
      setStep('groups');
      loadGroups();
    } catch (e: any) {
      if (e.message && e.message.includes('2FA')) {
        setNeeds2fa(true);
        Alert.alert('Atención', 'Se requiere contraseña 2FA.');
      } else {
        Alert.alert('Error', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGroup = (id: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedGroups(newSelected);
  };

  const handleUpdateGroupAttr = (id: string, attr: 'expected_structure' | 'use_all', value: any) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, [attr]: value } : g));
  };

  const handleSaveGroups = async () => {
    setLoading(true);
    try {
      const selectedData = groups
        .filter(g => selectedGroups.has(g.id))
        .map(g => ({
          id: g.id,
          expected_structure: g.expected_structure,
          use_all: g.use_all
        }));

      await apiFetchTelegram('/groups', {
        method: 'POST',
        body: JSON.stringify({ group_ids: Array.from(selectedGroups), group_settings: selectedData }),
      });
      Alert.alert('Éxito', 'Configuración de grupos guardada y monitor activado.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <NeoLayout>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Motor de Telegram 🚀</Text>
          <Text style={styles.subtitle}>Conecta tu cuenta para extraer señales de trading automáticamente.</Text>
        </View>

        <View style={styles.connectionStatus}>
          {isConnected ? (
            <NeoBadge label="Conectado a Telegram" variant="success" />
          ) : (
            <NeoBadge label="Desconectado" variant="danger" />
          )}
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
            onPress={() => setActiveTab('settings')}
          >
            <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>Configuración</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
            onPress={() => setActiveTab('messages')}
          >
            <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>Mensajes (Debug)</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'settings' ? (
          <View>
            {step === 'config' && (
              <NeoCard title="1. Credenciales de la API">
                <View style={styles.formGroup}>
                  <Text style={styles.label}>API ID</Text>
                  <TextInput
                    style={styles.input}
                    value={apiId}
                    onChangeText={setApiId}
                    placeholder="Ej: 1234567"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="numeric"
                  />

                  <Text style={styles.label}>API Hash</Text>
                  <TextInput
                    style={styles.input}
                    value={apiHash}
                    onChangeText={setApiHash}
                    placeholder="Ej: abc123def456"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                  />

                  <Text style={styles.label}>Número de Teléfono</Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+57 300 000 0000"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="phone-pad"
                  />

                  <Text style={styles.label}>Contraseña 2FA (opcional)</Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Solo si tienes 2FA activo"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    secureTextEntry
                  />

                  <View style={styles.buttonWrapper}>
                    <NeoButton variant="primary" size="lg" onPress={handleSaveConfig} disabled={loading}>
                      {loading ? 'Guardando...' : '📱 Guardar y Enviar Código'}
                    </NeoButton>
                  </View>
                </View>
              </NeoCard>
            )}

            {step === 'verify' && (
              <NeoCard title="2. Verificar Código">
                <View style={styles.formGroup}>
                  <Text style={styles.infoText}>Revisa tu app de Telegram — te llegó un mensaje con el código de verificación.</Text>

                  <Text style={styles.label}>Código de Verificación</Text>
                  <TextInput
                    style={[styles.input, styles.centerText]}
                    value={code}
                    onChangeText={setCode}
                    placeholder="Ej: 12345"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="number-pad"
                  />

                  {needs2fa && (
                    <>
                      <Text style={styles.label}>Contraseña 2FA</Text>
                      <TextInput
                        style={styles.input}
                        value={twoFaPassword}
                        onChangeText={setTwoFaPassword}
                        placeholder="Contraseña de verificación en dos pasos"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        secureTextEntry
                      />
                    </>
                  )}

                  <View style={styles.buttonsRow}>
                    <View style={styles.halfBtn}>
                      <NeoButton variant="secondary" size="md" onPress={() => setStep('config')} disabled={loading}>
                        ← Atrás
                      </NeoButton>
                    </View>
                    <View style={styles.halfBtn}>
                      <NeoButton variant="primary" size="md" onPress={handleVerifyCode} disabled={loading}>
                        {loading ? 'Verificando...' : 'Verificar'}
                      </NeoButton>
                    </View>
                  </View>
                </View>
              </NeoCard>
            )}

            {step === 'groups' && (
              <NeoCard title={`3. Grupos y Canales (${groups.length})`}>
                <View style={styles.groupsHeader}>
                  <Text style={styles.groupsCount}>{selectedGroups.size} seleccionados para monitorear</Text>
                  <TouchableOpacity onPress={loadGroups}>
                    <Text style={styles.refreshText}>Actualizar</Text>
                  </TouchableOpacity>
                </View>

                {groups.length === 0 ? (
                  <Text style={styles.infoTextCenter}>Cargando grupos...</Text>
                ) : (
                  <View style={styles.groupsList}>
                    {groups.map(g => (
                      <View key={g.id} style={styles.groupItemContainer}>
                        <TouchableOpacity
                          style={[styles.groupItem, selectedGroups.has(g.id) && styles.groupItemSelected]}
                          onPress={() => handleToggleGroup(g.id)}
                        >
                          <View style={styles.groupItemLeft}>
                            <View style={[styles.checkbox, selectedGroups.has(g.id) && styles.checkboxSelected]}>
                              {selectedGroups.has(g.id) && <Text style={styles.checkMark}>✓</Text>}
                            </View>
                            <Text style={styles.groupTitle} numberOfLines={1}>{g.title}</Text>
                          </View>
                          <NeoBadge
                            label={g.is_channel ? 'Canal' : 'Grupo'}
                            variant={g.is_channel ? 'info' : 'success'}
                          />
                        </TouchableOpacity>

                        {selectedGroups.has(g.id) && (
                          <View style={styles.groupSettings}>
                            <TouchableOpacity
                              style={styles.useAllRow}
                              onPress={() => handleUpdateGroupAttr(g.id, 'use_all', !g.use_all)}
                            >
                              <View style={[styles.checkboxSmall, g.use_all && styles.checkboxSelected]}>
                                {g.use_all && <Text style={styles.checkMarkSmall}>✓</Text>}
                              </View>
                              <Text style={styles.useAllText}>Procesar todos los mensajes (ignorar estructura)</Text>
                            </TouchableOpacity>

                            {!g.use_all && (
                              <View style={styles.structureContainer}>
                                <Text style={styles.label}>Estructura esperada</Text>
                                <TextInput
                                  style={styles.textArea}
                                  value={g.expected_structure || ''}
                                  onChangeText={(text) => handleUpdateGroupAttr(g.id, 'expected_structure', text)}
                                  placeholder="Ej: BUY BTC\nTP: 60000\nSL: 55000"
                                  placeholderTextColor="rgba(255,255,255,0.4)"
                                  multiline
                                  numberOfLines={3}
                                />
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.buttonsRow}>
                  <View style={styles.halfBtn}>
                    <NeoButton variant="secondary" size="md" onPress={() => { setStep('config'); setIsConnected(false); }} disabled={loading}>
                      Reconfigurar
                    </NeoButton>
                  </View>
                  <View style={styles.halfBtn}>
                    <NeoButton variant="primary" size="md" onPress={handleSaveGroups} disabled={loading}>
                      {loading ? 'Guardando...' : 'Activar Monitoreo'}
                    </NeoButton>
                  </View>
                </View>
              </NeoCard>
            )}
          </View>
        ) : (
          <NeoCard title="Últimos Mensajes">
            <View style={styles.messagesHeader}>
              <Text style={styles.groupsCount}>Mensajes recibidos de tus grupos monitoreados.</Text>
              <TouchableOpacity onPress={loadMessages} disabled={loadingMessages}>
                <Text style={styles.refreshText}>{loadingMessages ? 'Actualizando...' : 'Actualizar'}</Text>
              </TouchableOpacity>
            </View>

            {!isConnected ? (
              <Text style={styles.infoTextCenter}>Debes configurar y conectar Telegram primero.</Text>
            ) : messages.length === 0 ? (
              <Text style={styles.infoTextCenter}>No hay mensajes recientes.</Text>
            ) : (
              <View style={styles.messagesList}>
                {messages.map(msg => (
                  <View key={msg.id} style={styles.messageItem}>
                    <View style={styles.messageHeader}>
                      <Text style={styles.messageChatTitle}>{msg.chat_title} <Text style={styles.messageSender}>por {msg.sender}</Text></Text>
                      <Text style={styles.messageDate}>{new Date(msg.date).toLocaleString()}</Text>
                    </View>
                    <View style={styles.messageBody}>
                      <Text style={styles.messageText}>{msg.text}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </NeoCard>
        )}
      </ScrollView>
    </NeoLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 64,
    paddingBottom: 128,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  connectionStatus: {
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: 'rgba(52, 216, 255, 0.1)',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#34d8ff',
  },
  formGroup: {
    marginTop: 16,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 16,
  },
  textArea: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  centerText: {
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 4,
  },
  buttonWrapper: {
    marginTop: 8,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  halfBtn: {
    flex: 0.48,
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginBottom: 16,
  },
  infoTextCenter: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  groupsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  groupsCount: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  refreshText: {
    color: '#34d8ff',
    fontSize: 12,
  },
  groupsList: {
    maxHeight: 400,
  },
  groupItemContainer: {
    marginBottom: 8,
  },
  groupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  groupItemSelected: {
    backgroundColor: 'rgba(52, 216, 255, 0.1)',
    borderColor: 'rgba(52, 216, 255, 0.4)',
  },
  groupItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#34d8ff',
    borderColor: '#34d8ff',
  },
  checkMark: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  groupTitle: {
    color: '#ffffff',
    fontSize: 14,
    flex: 1,
  },
  groupSettings: {
    paddingLeft: 32,
    paddingRight: 8,
    paddingBottom: 8,
    paddingTop: 8,
  },
  useAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkboxSmall: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMarkSmall: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  useAllText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  structureContainer: {
    marginTop: 4,
  },
  messagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  messagesList: {
    flexDirection: 'column',
  },
  messageItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  messageChatTitle: {
    color: '#34d8ff',
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  messageSender: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    fontWeight: 'normal',
  },
  messageDate: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
  },
  messageBody: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 8,
    borderRadius: 4,
  },
  messageText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontFamily: 'monospace',
  }
});
