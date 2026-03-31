# GymAI Mobile - Etapa 3

Aplicacion React Native (Expo) conectada al backend GymAI.

## Requisitos

- Node.js 20+
- Expo CLI (opcional)
- Android Studio o dispositivo fisico con Expo Go
- Backend corriendo en `http://<ip-local>:3000`

## Configuracion

1. Copia variables de entorno:

```bash
cp .env.example .env
```

2. Ajusta `EXPO_PUBLIC_API_BASE_URL` con la IP local de tu PC:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000
```

3. Instala dependencias:

```bash
npm install
```

4. Inicia Expo:

```bash
npm run start
```

## Flujo actual implementado

- Login
- Registro admin inicial
- Home
- Perfil (leer y actualizar)
- Generacion de rutina IA
- Chat con coach IA

## Siguiente iteracion (Stage 3.1)

- Persistencia segura de token (`expo-secure-store`)
- Pantalla de mediciones
- Pantalla de plan nutricional
- Historial IA
- Pulido UX y animaciones
