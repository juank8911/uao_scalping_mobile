\# 📱 Plan de Desarrollo: Aplicación Móvil de Trading (JeiKei Ecosystem)



\## 📌 1. Visión General

Desarrollo de una aplicación móvil multiplataforma (iOS y Android) creada con \*\*Expo (React Native)\*\* que se conecta al motor de trading / API backend en \*\*FastAPI\*\*. Incorpora la identidad visual del ecosistema \*\*JeiKei\*\*, autenticación segura biométrica y monitoreo/control en tiempo real.



\---



\## 🛠️ 2. Arquitectura y Tecnologías

\* \*\*Framework:\*\* Expo / React Native (TypeScript).

\* \*\*Estilo / UI:\*\* Sistema de diseño institucional \*\*JeiKei\*\* (Componentes modularizados, interfaz limpia, modo oscuro/claro, métricas de alto contraste).

\* \*\*Plataformas Objetivo:\*\* iOS y Android (vía Expo).

\* \*\*Backend Integration:\*\* API REST / WebSockets con FastAPI.

\* \*\*Seguridad:\*\* JWT (JSON Web Tokens) + \*\*Expo LocalAuthentication\*\* (Biometría: Face ID / Touch ID / Huella Dactilar) + \*\*Expo SecureStore\*\* para almacenamiento seguro.



\---



\## 🔐 3. Autenticación y Seguridad

1\. \*\*Flujo de Inicio de Sesión:\*\*

&#x20;  \* Login inicial con credenciales de usuario y contraseña o API Key.

&#x20;  \* Almacenamiento seguro del token JWT en hardware cifrado nativo (`SecureStore`).

&#x20;  \* Activación opcional de \*\*autenticación biométrica\*\* para accesos posteriores.

2\. \*\*Validación Biométrica:\*\*

&#x20;  \* Prompt nativo al abrir la app o reanudarla desde segundo plano.

&#x20;  \* Confirmación biométrica obligatoria para acciones críticas (Ej: Kill-Switch o cambios de apalancamiento).



\---



\## 🎛️ 4. Configuraciones Controlables del Bot / Motor

Desde la app móvil, el usuario podrá gestionar los parámetros clave del motor de trading:

\* \*\*Control Operativo:\*\* Botón de emergencia (\*Kill-Switch\*) para pausar el bot o cerrar todas las posiciones activas.

\* \*\*Selección de Estrategia:\*\* Conmutación entre motores (ej. UAO\_Grid, UAO\_Scalping, SignalKey).

\* \*\*Gestión de Riesgo:\*\*

&#x20; \* Apalancamiento (\*Leverage\*).

&#x20; \* Límite de Stop Loss / Take Profit global.

&#x20; \* Tamaño de posición por orden (\*Position Sizing\*) y exposición máxima.

\* \*\*Parámetros de Rejilla / Escalado:\*\* Rango de precios, espaciado de órdenes (\*Grid Step\*) y número de niveles activos.



\---



\## 📊 5. Panel de Control y Métricas en Tiempo Real (Dashboard)

La interfaz priorizará la lectura rápida y eficiente de métricas financieras:

\* \*\*Balance General:\*\* Valor total de la cuenta, margen utilizado y disponible.

\* \*\*PnL en Tiempo Real:\*\* Ganancia/Pérdida no realizada y realizada (diaria, semanal y acumulada).

\* \*\*Posiciones Abiertas:\*\* Lista activa de contratos/pares, precio de entrada, precio de liquidación y PnL actual.

\* \*\*Historial de Operaciones:\*\* Registro completo de órdenes ejecutadas con filtros por fecha y par.

\* \*\*Top Backtests \& Métricas:\*\* Visualización de los mejores resultados de backtesting y señales activas.



\---



\## 📁 6. Estructura Sugerida del Repositorio

```

/

├── mobile/                  # Aplicación Expo / React Native

│   ├── src/

│   │   ├── components/      # UI Kit estilo JeiKei

│   │   ├── navigation/      # Navegación por Stacks y Tabs

│   │   ├── screens/         # Login, Dashboard, Config, Estadísticas

│   │   ├── services/        # Cliente API FastAPI \& WebSockets

│   │   └── utils/           # Biometría, SecureStore y formateadores

│   └── App.tsx

├── MOBILE\_APP\_PLAN.md       # Este plan de desarrollo

└── ... (Backend FastAPI)

```



\---



\## 🚀 7. Hoja de Ruta de Implementación (4 Fases)

1\. \*\*Fase 1: Setup \& Autenticación (Semana 1)\*\*

&#x20;  \* Inicializar proyecto Expo TypeScript con componentes del estilo JeiKei.

&#x20;  \* Implementar Login, manejo de JWT con `SecureStore` e integración biométrica nativa (`LocalAuthentication`).

2\. \*\*Fase 2: Conexión FastAPI \& Dashboard (Semana 2)\*\*

&#x20;  \* Configurar servicios REST y conexión WebSocket para datos en tiempo real.

&#x20;  \* Diseñar pantalla principal con resumen de balance, PnL y posiciones activas.

3\. \*\*Fase 3: Panel de Control del Bot (Semana 3)\*\*

&#x20;  \* Desarrollar el formulario interactivo de parámetros de trading y Kill-Switch.

&#x20;  \* Requerir validación biométrica para aplicar cambios de riesgo alto.

4\. \*\*Fase 4: Testing \& Compilación EAS (Semana 4)\*\*

&#x20;  \* Pruebas integradas en iOS (TestFlight) y Android (APK / Play Console).

&#x20;  \* Ajustes de rendimiento y optimización de renderizado.



