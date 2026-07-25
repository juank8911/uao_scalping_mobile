# 📱 UAO Mobile App (JeiKei Ecosystem)

Esta es la aplicación móvil oficial para conectarse, monitorear y controlar el **Unidad Autónoma de Operación (UAO) - HFT Scalping Engine**. Está construida con **Expo (React Native)** y utiliza los componentes nativos del **JeiKei Design System v2**.

## ✨ Características Principales

* **Autenticación Biométrica Nativa:** Integración con `expo-local-authentication` para un acceso rápido y seguro, protegiendo acciones críticas (como el *Kill-Switch*).
* **Almacenamiento Seguro:** Manejo de sesiones y tokens usando `expo-secure-store`.
* **Motor Neural 3D:** Interfaz inmersiva con aceleración por GPU gracias a `@shopify/react-native-skia` y el diseño "Glass-Neon" proporcionado por `jeikei-design-system`.
* **Dashboard en Tiempo Real:** Visualización del estado del motor, balance general, PnL diario acumulado y símbolos monitorizados de la UAO.
* **Control Operativo Avanzado:** Botones de encendido (START), apagado de emergencia (KILL-SWITCH) y actualización dinámica de los parámetros de riesgo del bot (Max trades, Drawdown, Profit Target).

---

## ⚙️ Requisitos Previos

* Node.js (v18 o superior).
* La aplicación de **Expo Go** instalada en tu dispositivo físico iOS o Android, o un emulador configurado.
* (Opcional, pero recomendado): El servidor backend de `uao_scalping` ejecutándose de forma local (en el puerto 8000) o remota.

---

## 📦 Instalación

1. Clona el repositorio e ingresa a la carpeta del proyecto móvil:
   ```bash
   git clone <este_repositorio>
   cd mobile
   ```

2. Instala las dependencias principales usando `npm`:
   ```bash
   npm install --legacy-peer-deps
   ```

> **Nota:** Se utiliza `--legacy-peer-deps` porque la versión nativa del sistema de diseño puede presentar discrepancias temporales con algunas sub-dependencias puras de React.

---

## 🚀 Uso en Desarrollo Local

1. Levanta el servidor de desarrollo de Expo:
   ```bash
   npx expo start
   ```

2. Escanea el código QR que aparece en tu terminal con la cámara de tu iPhone o con la app de Expo Go en Android. Alternativamente, puedes presionar `i` para abrir el simulador de iOS o `a` para el emulador de Android (si los tienes configurados).

> **Aviso sobre Entorno Web:** Dado que esta aplicación hace uso profundo de librerías nativas puras (Skia nativo y SecureStore), **no está diseñada para ejecutarse en la web (`expo start --web`)**. Por favor, prueba siempre en un dispositivo móvil real o en un emulador nativo.

---

## 📁 Estructura del Proyecto

```
mobile/
├── src/
│   ├── components/      # (Componentes extra que extienden el Design System si son necesarios)
│   ├── navigation/      # Stack y Bottom Tab Navigator
│   │   ├── AppNavigator.tsx
│   │   └── MainTabs.tsx
│   ├── screens/         # Pantallas principales
│   │   ├── LoginScreen.tsx          # Pantalla de acceso y Biometría
│   │   ├── DashboardScreen.tsx      # Telemetría y estado (PnL)
│   │   └── ControlPanelScreen.tsx   # Panel de Configuración y Kill-Switch
│   ├── services/        # Cliente HTTP (fetch/axios) para conectarse a FastAPI
│   │   └── api.ts
│   └── utils/           # Módulos de utilidad
│       └── auth.ts      # Funciones para SecureStore y LocalAuthentication
├── App.tsx              # Raíz de la app móvil
└── package.json         # Dependencias e información de configuración
```

## 📝 Conexión al Backend

Por defecto, la app intentará hacer peticiones (como `start`, `stop`, `status` y `config`) hacia `http://localhost:8000/api/v1/control/`.
Si usas un dispositivo físico o tu backend está en otra IP, asegúrate de modificar la variable `BASE_URL` en `src/services/api.ts` con la IP de tu red local en lugar de `localhost`. (Ej: `http://192.168.1.5:8000/api/v1/control`).
