import React from 'react';
import { Modal, View, StyleSheet, ModalProps, Text, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { NeuralBackground } from 'jeikei-design-system/native'; // Asegúrate de la ruta correcta

interface NeoModalProps extends ModalProps {
  children: React.ReactNode;
  title?: string;
  onClose?: () => void;
  fullHeight?: boolean;
}

export const NeoModal = ({ children, title, onClose, fullHeight, ...props }: NeoModalProps) => {
  return (
    <Modal transparent animationType="fade" {...props}>
      {/* Fondo blur oscuro */}
      <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
      
      {/* Red neuronal Skia de fondo */}
      <View style={StyleSheet.absoluteFill}>
        <NeuralBackground />
      </View>

      {/* Contenedor principal con borde neon */}
      <View style={styles.container}>
        <View style={[styles.content, fullHeight && { flex: 1 }]}>
          {/* Marcadores HUD (Esquinas) */}
          <View style={[styles.hudCorner, styles.topLeft]} />
          <View style={[styles.hudCorner, styles.topRight]} />
          <View style={[styles.hudCorner, styles.bottomLeft]} />
          <View style={[styles.hudCorner, styles.bottomRight]} />
          
          {(title || onClose) && (
            <View style={styles.header}>
              {title ? (
                <Text style={styles.title}>{title}</Text>
              ) : <View />}
              {onClose && (
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {children}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(2, 4, 10, 0.85)', // Fondo oscuro translúcido
  },
  content: {
    width: '100%',
    backgroundColor: 'transparent',
    borderColor: 'rgba(52, 216, 255, 0.15)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    overflow: 'hidden',
  },
  hudCorner: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderColor: '#34d8ff',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  topRight: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#34d8ff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 18,
  },
});
