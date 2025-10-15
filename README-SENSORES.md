# Monitor de Sensores BLE Sense 33 en Tiempo Real

Este proyecto integra un Arduino Nano 33 BLE Sense con Raspberry Pi para mostrar datos de sensores en tiempo real en un dashboard React.

## 📋 Componentes del Sistema

1. **Arduino Nano 33 BLE Sense** - Lee datos de sensores
2. **Raspberry Pi** - Recibe datos vía serial y los envía por WebSocket
3. **Servidor WebSocket** - Intermediario entre Raspberry Pi y frontend
4. **Dashboard React** - Muestra datos en tiempo real con gráficos

## 🚀 Configuración y Ejecución

### 1. Preparar Arduino Nano 33 BLE Sense

1. **Instalar librerías** en Arduino IDE:
   ```
   - Arduino_HTS221 (Temperatura/Humedad)
   - Arduino_LPS22HB (Presión)
   - Arduino_LSM9DS1 (Acelerómetro/Giroscopio)
   ```

2. **Cargar el código**:
   - Abrir `arduino_ble_sense_reader.ino` en Arduino IDE
   - Seleccionar placa: "Arduino Nano 33 BLE"
   - Conectar Arduino y subir el código

3. **Verificar funcionamiento**:
   - Abrir Monitor Serie (9600 baud)
   - Deberías ver datos JSON cada 2 segundos

### 2. Configurar Raspberry Pi

1. **Instalar dependencias Python**:
   ```bash
   pip install websocket-client pyserial
   ```

2. **Conectar Arduino** al Raspberry Pi vía USB

3. **Identificar puerto serial**:
   ```bash
   ls /dev/tty*
   # Buscar /dev/ttyUSB0 o /dev/ttyACM0
   ```

4. **Configurar y ejecutar**:
   ```bash
   # Copiar el script al Raspberry Pi
   scp raspberry_sensor_sender.py pi@tu-raspberry-ip:~/
   
   # Ejecutar en Raspberry Pi
   python3 raspberry_sensor_sender.py --ws-url ws://TU-IP-PC:8080 --serial-port /dev/ttyUSB0
   
   # O usar datos de prueba para testing
   python3 raspberry_sensor_sender.py --test-data --ws-url ws://TU-IP-PC:8080
   ```

### 3. Ejecutar Servidor WebSocket

En tu PC (donde está el proyecto React):

```bash
# Instalar dependencias del servidor WebSocket
cd ruta/del/proyecto
npm install ws

# Ejecutar servidor WebSocket
node websocket-server.js
```

El servidor estará disponible en `ws://localhost:8080`

### 4. Ejecutar Dashboard React

```bash
# En otra terminal, ejecutar el frontend React
npm start
```

El dashboard estará disponible en: `http://localhost:3000/demos/admin-templates/materially/react/free`

### 5. Acceder al Monitor de Sensores

1. Abrir el dashboard React
2. En el menú lateral, ir a **"Sensores" → "Monitor BLE Sense 33"**
3. Verificar que el estado muestre "Conectado"
4. Los datos deberían actualizarse cada 2 segundos

## 📊 Datos Monitoreados

- **Temperatura** (°C)
- **Humedad** (%)
- **Presión Barométrica** (hPa)
- **Aceleración** (g) - Ejes X, Y, Z
- **Giroscopio** (°/s) - Ejes X, Y, Z
- **Gráficos históricos** en tiempo real

## 🔧 Solución de Problemas

### Arduino no se conecta
- Verificar que las librerías estén instaladas
- Comprobar conexión USB
- Revisar puerto serial en Raspberry Pi

### WebSocket no conecta
- Verificar que el servidor WebSocket esté ejecutándose
- Comprobar firewall (puerto 8080)
- Cambiar IP en Raspberry Pi por la IP real de tu PC

### No llegan datos al dashboard
- Verificar logs del servidor WebSocket
- Comprobar conexión Raspberry Pi → Servidor
- Revisar Monitor Serie de Arduino para datos

### Raspberry Pi no encuentra puerto serial
```bash
# Listar puertos disponibles
ls /dev/tty*

# Dar permisos al usuario
sudo usermod -a -G dialout $USER
sudo chmod 666 /dev/ttyUSB0  # o el puerto correcto
```

## 📝 Personalización

### Cambiar frecuencia de envío
- **Arduino**: Modificar `SEND_INTERVAL` en el código
- **Raspberry Pi**: Modificar `time.sleep(2)` en el bucle principal

### Agregar nuevos sensores
1. Modificar código Arduino para leer nuevos sensores
2. Actualizar formato JSON
3. Modificar componente React para mostrar nuevos datos

### Cambiar puerto WebSocket
- Modificar `PORT` en `websocket-server.js`
- Actualizar URL en `raspberry_sensor_sender.py`
- Cambiar URL en `useWebSocket.js`

## 🌐 Acceso Remoto

Para acceder desde otros dispositivos en la red:

1. **Servidor WebSocket**: Cambiar `localhost` por `0.0.0.0`
2. **React**: Configurar Vite para aceptar conexiones externas
3. **Firewall**: Abrir puertos 3000 y 8080

## 📦 Estructura de Archivos

```
proyecto/
├── src/
│   ├── hooks/useWebSocket.js          # Hook para WebSocket
│   ├── views/sensors/SensorDashboard.jsx  # Componente principal
│   └── ...
├── websocket-server.js                # Servidor WebSocket
├── raspberry_sensor_sender.py         # Script para Raspberry Pi
├── arduino_ble_sense_reader.ino      # Código Arduino
└── README-SENSORES.md                # Este archivo
```

## 🎯 Próximos Pasos

- [ ] Agregar alertas por valores fuera de rango
- [ ] Implementar base de datos para histórico
- [ ] Crear API REST para consultar datos
- [ ] Agregar autenticación al WebSocket
- [ ] Implementar múltiples sensores simultáneos

## 📞 Soporte

Si tienes problemas:
1. Verificar logs de cada componente
2. Comprobar conexiones físicas
3. Revisar configuración de red/firewall
4. Consultar la documentación oficial de cada librería