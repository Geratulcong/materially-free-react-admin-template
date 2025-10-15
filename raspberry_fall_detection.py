#!/usr/bin/env python3
"""
Script mejorado para Raspberry Pi que detecta caídas vía BLE del Arduino Nano 33 BLE Sense
y envía alertas al dashboard React a través de WebSocket.

Dependencias:
pip install bleak websocket-client asyncio requests

Hardware:
- Raspberry Pi con Bluetooth
- Arduino Nano 33 BLE Sense

Autor: Tu nombre
Fecha: Octubre 2025
"""

import asyncio
import json
import time
import websocket
import threading
import logging
import requests
from datetime import datetime
from bleak import BleakClient, BleakScanner

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuración BLE
DEVICE_NAME = "Nano33BLE"
UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"

# Configuración WebSocket
WS_URL = "ws://localhost:8080"  # Cambiar por la IP de tu PC si es necesario

# Configuración de alertas
WEBHOOK_URL = "https://tuappweb.com/alerta"  # URL opcional para webhook externo
USUARIO_ID = "cliente123"

class FallDetectionSystem:
    def __init__(self, ws_url=WS_URL, device_name=DEVICE_NAME):
        self.ws_url = ws_url
        self.device_name = device_name
        self.ws = None
        self.ws_connected = False
        self.ble_connected = False
        self.ble_client = None
        self.running = False
        self.fall_count = 0
        
    def on_ws_open(self, ws):
        """Callback cuando se abre la conexión WebSocket"""
        logger.info("Conexión WebSocket establecida")
        self.ws_connected = True
        
        # Identificarse como sistema de detección de caídas
        identification = {
            "type": "identify",
            "client": "raspberry_fall_detection",
            "device": "Raspberry Pi + Arduino BLE Fall Detector"
        }
        ws.send(json.dumps(identification))
        
    def on_ws_message(self, ws, message):
        """Callback cuando se recibe un mensaje del servidor"""
        try:
            data = json.loads(message)
            logger.info(f"Mensaje del servidor: {data}")
        except json.JSONDecodeError:
            logger.error(f"Error decodificando mensaje: {message}")
            
    def on_ws_error(self, ws, error):
        """Callback cuando hay un error en WebSocket"""
        logger.error(f"Error WebSocket: {error}")
        self.ws_connected = False
        
    def on_ws_close(self, ws, close_status_code, close_msg):
        """Callback cuando se cierra la conexión WebSocket"""
        logger.info("Conexión WebSocket cerrada")
        self.ws_connected = False
        
    def connect_websocket(self):
        """Conectar al servidor WebSocket"""
        try:
            logger.info(f"Conectando a WebSocket: {self.ws_url}")
            self.ws = websocket.WebSocketApp(
                self.ws_url,
                on_open=self.on_ws_open,
                on_message=self.on_ws_message,
                on_error=self.on_ws_error,
                on_close=self.on_ws_close
            )
            
            # Ejecutar en un hilo separado
            wst = threading.Thread(target=self.ws.run_forever)
            wst.daemon = True
            wst.start()
            
            # Esperar a que se conecte
            timeout = 10
            while not self.ws_connected and timeout > 0:
                time.sleep(0.5)
                timeout -= 0.5
                
            if not self.ws_connected:
                logger.error("No se pudo conectar al servidor WebSocket")
                return False
                
            logger.info("Conectado al servidor WebSocket")
            return True
            
        except Exception as e:
            logger.error(f"Error conectando WebSocket: {e}")
            return False
    
    async def notification_handler(self, sender, data):
        """Maneja las notificaciones BLE del Arduino"""
        try:
            msg = data.decode().strip()
            logger.info(f"Notificación BLE recibida: {msg}")
            
            # Intentar parsear como JSON primero
            if msg.startswith('{'):
                try:
                    json_data = json.loads(msg)
                    await self.process_json_message(json_data)
                except json.JSONDecodeError:
                    logger.warning(f"JSON inválido recibido: {msg}")
            elif msg == "CAIDA":
                await self.handle_fall_detection()
            elif msg == "OK" or msg == "CONNECTED":
                logger.info("Arduino conectado y funcionando")
                await self.send_status_update("connected")
            elif msg == "INIT":
                logger.info("Arduino inicializando...")
            else:
                logger.info(f"Mensaje desconocido: {msg}")
                
        except Exception as e:
            logger.error(f"Error procesando notificación BLE: {e}")
    
    async def process_json_message(self, json_data):
        """Procesa mensajes JSON del Arduino (formato compacto)"""
        try:
            msg_type = json_data.get('t') or json_data.get('type')  # Soportar ambos formatos
            
            if msg_type == "FALL" or msg_type == "FALL_ALERT":
                # Procesar alerta de caída con datos detallados
                severity = json_data.get('sev', json_data.get('severity', 'medium'))
                magnitude = json_data.get('mag', json_data.get('magnitude', 0))
                fall_count = json_data.get('fc', json_data.get('fall_count', 0))
                timestamp = json_data.get('ts', json_data.get('timestamp', 0))
                
                # Datos de aceleración
                acc_data = json_data.get('acc', [0, 0, 0])  # formato compacto [x,y,z]
                if not acc_data and 'acceleration' in json_data:
                    # formato extendido
                    acc = json_data['acceleration']
                    acc_data = [acc.get('x', 0), acc.get('y', 0), acc.get('z', 0)]
                
                # Datos ambientales
                env_data = json_data.get('env', [])  # formato compacto [temp, hum, press]
                if not env_data and 'environment' in json_data:
                    # formato extendido
                    env = json_data['environment']
                    env_data = [env.get('temperature', 0), env.get('humidity', 0), env.get('pressure', 0)]
                
                await self.handle_detailed_fall(severity, magnitude, fall_count, timestamp, acc_data, env_data)
                
            elif msg_type == "STATUS":
                # Procesar datos de estado del sistema
                system_active = json_data.get('sa', json_data.get('system_active', True))
                fall_count = json_data.get('fc', json_data.get('fall_count', 0))
                baseline = json_data.get('bl', json_data.get('baseline', 1.0))
                current_accel = json_data.get('ca', json_data.get('current_accel', 1.0))
                timestamp = json_data.get('ts', json_data.get('timestamp', 0))
                
                # Datos ambientales
                env_data = json_data.get('env', [])
                if not env_data and 'environment' in json_data:
                    env = json_data['environment']
                    env_data = [env.get('temperature', 0), env.get('humidity', 0), env.get('pressure', 0)]
                
                await self.handle_status_update(system_active, fall_count, baseline, current_accel, timestamp, env_data)
                
        except Exception as e:
            logger.error(f"Error procesando mensaje JSON: {e}")
    
    async def handle_detailed_fall(self, severity, magnitude, fall_count, timestamp, acc_data, env_data):
        """Maneja detección de caída con datos detallados"""
        global USUARIO_ID
        
        self.fall_count = fall_count
        current_time = datetime.now().isoformat()
        
        logger.warning(f"¡CAÍDA DETECTADA! Severidad: {severity}, Magnitud: {magnitude}")
        
        # Crear datos detallados de la alerta
        fall_alert = {
            "type": "fall_alert",
            "timestamp": current_time,
            "arduino_timestamp": timestamp,
            "alert_id": f"fall_{fall_count}_{int(time.time())}",
            "severity": severity,
            "magnitude": magnitude,
            "location": "Sensor BLE",
            "user_id": USUARIO_ID,
            "fall_count": fall_count,
            "device_status": "active",
            "sensor_data": {
                "acceleration": {
                    "x": acc_data[0] if len(acc_data) > 0 else 0,
                    "y": acc_data[1] if len(acc_data) > 1 else 0,
                    "z": acc_data[2] if len(acc_data) > 2 else 0
                },
                "environment": {
                    "temperature": env_data[0] if len(env_data) > 0 else None,
                    "humidity": env_data[1] if len(env_data) > 1 else None,
                    "pressure": env_data[2] if len(env_data) > 2 else None
                } if env_data else None
            }
        }
        
        # Enviar al WebSocket
        if self.ws_connected and self.ws:
            try:
                self.ws.send(json.dumps(fall_alert))
                logger.info("Alerta detallada enviada al dashboard")
            except Exception as e:
                logger.error(f"Error enviando alerta al WebSocket: {e}")
    
    async def handle_status_update(self, system_active, fall_count, baseline, current_accel, timestamp, env_data):
        """Maneja actualizaciones de estado del sistema"""
        global USUARIO_ID
        
        status_data = {
            "type": "system_status",
            "timestamp": datetime.now().isoformat(),
            "arduino_timestamp": timestamp,
            "user_id": USUARIO_ID,
            "system_active": bool(system_active),
            "fall_count": fall_count,
            "baseline_acceleration": baseline,
            "current_acceleration": current_accel,
            "sensor_data": {
                "environment": {
                    "temperature": env_data[0] if len(env_data) > 0 and env_data[0] != -999 else None,
                    "humidity": env_data[1] if len(env_data) > 1 and env_data[1] != -999 else None,
                    "pressure": env_data[2] if len(env_data) > 2 and env_data[2] != -999 else None
                } if env_data else None
            }
        }
        
        # Enviar al WebSocket
        if self.ws_connected and self.ws:
            try:
                self.ws.send(json.dumps(status_data))
                logger.info(f"Estado del sistema enviado - Temp: {env_data[0] if env_data else 'N/A'}°C")
            except Exception as e:
                logger.error(f"Error enviando estado al WebSocket: {e}")
    
    async def handle_fall_detection(self):
        """Maneja la detección de una caída"""
        global USUARIO_ID, WEBHOOK_URL
        
        self.fall_count += 1
        timestamp = datetime.now().isoformat()
        
        logger.warning(f"¡CAÍDA DETECTADA! (#{self.fall_count})")
        
        # Crear datos de la alerta
        fall_alert = {
            "type": "fall_alert",
            "timestamp": timestamp,
            "alert_id": f"fall_{self.fall_count}_{int(time.time())}",
            "severity": "high",
            "location": "Sensor BLE",
            "user_id": USUARIO_ID,
            "fall_count": self.fall_count,
            "device_status": "active"
        }
        
        # Enviar al WebSocket
        if self.ws_connected and self.ws:
            try:
                self.ws.send(json.dumps(fall_alert))
                logger.info("Alerta enviada al dashboard")
            except Exception as e:
                logger.error(f"Error enviando alerta al WebSocket: {e}")
        
        # Enviar a webhook externo (opcional)
        try:
            if WEBHOOK_URL and WEBHOOK_URL != "https://tuappweb.com/alerta":
                response = requests.post(
                    WEBHOOK_URL,
                    json={"evento": "caida", "usuario": USUARIO_ID, "timestamp": timestamp},
                    timeout=5
                )
                logger.info(f"Webhook enviado: {response.status_code}")
        except Exception as e:
            logger.warning(f"Error enviando webhook: {e}")
    
    async def send_status_update(self, status):
        """Envía actualización de estado al dashboard"""
        status_update = {
            "type": "system_status",
            "timestamp": datetime.now().isoformat(),
            "ble_status": status,
            "device_name": self.device_name,
            "fall_count": self.fall_count
        }
        
        if self.ws_connected and self.ws:
            try:
                self.ws.send(json.dumps(status_update))
                logger.info(f"Estado actualizado: {status}")
            except Exception as e:
                logger.error(f"Error enviando estado: {e}")
    
    async def find_ble_device(self):
        """Busca el dispositivo BLE Arduino"""
        logger.info(f"Buscando dispositivo BLE: {self.device_name}")
        
        try:
            devices = await BleakScanner.discover(timeout=10.0)
            target = next((d for d in devices if d.name == self.device_name), None)
            
            if target:
                logger.info(f"Dispositivo encontrado: {target.address}")
                return target
            else:
                logger.error(f"No se encontró el dispositivo: {self.device_name}")
                # Mostrar dispositivos disponibles para debugging
                logger.info("Dispositivos BLE disponibles:")
                for device in devices:
                    if device.name:
                        logger.info(f"  - {device.name} ({device.address})")
                return None
                
        except Exception as e:
            logger.error(f"Error buscando dispositivos BLE: {e}")
            return None
    
    async def connect_ble(self):
        """Conecta al dispositivo BLE"""
        device = await self.find_ble_device()
        if not device:
            return False
        
        try:
            self.ble_client = BleakClient(device.address)
            await self.ble_client.connect()
            
            if self.ble_client.is_connected:
                logger.info(f"Conectado a {self.device_name}")
                self.ble_connected = True
                
                # Suscribirse a notificaciones
                await self.ble_client.start_notify(TX_CHAR_UUID, self.notification_handler)
                logger.info("Suscrito a notificaciones BLE")
                
                await self.send_status_update("connected")
                return True
            else:
                logger.error("No se pudo conectar al dispositivo BLE")
                return False
                
        except Exception as e:
            logger.error(f"Error conectando BLE: {e}")
            return False
    
    async def run_ble_monitor(self):
        """Ejecuta el monitor BLE en bucle con reconexión automática"""
        while self.running:
            try:
                if not self.ble_connected:
                    logger.info("Intentando conectar BLE...")
                    if await self.connect_ble():
                        logger.info("BLE conectado, monitoreando...")
                    else:
                        logger.error("Fallo al conectar BLE, reintentando en 10s...")
                        await asyncio.sleep(10)
                        continue
                
                # Mantener conexión activa
                while self.ble_connected and self.running:
                    if self.ble_client and self.ble_client.is_connected:
                        await asyncio.sleep(1)
                    else:
                        logger.warning("Conexión BLE perdida")
                        self.ble_connected = False
                        await self.send_status_update("disconnected")
                        break
                        
            except Exception as e:
                logger.error(f"Error en monitor BLE: {e}")
                self.ble_connected = False
                await self.send_status_update("error")
                await asyncio.sleep(5)
    
    async def run(self):
        """Ejecutar el sistema completo"""
        logger.info("Iniciando sistema de detección de caídas...")
        self.running = True
        
        # Conectar WebSocket
        if not self.connect_websocket():
            logger.error("No se pudo conectar al WebSocket")
            return
        
        # Ejecutar monitor BLE
        try:
            await self.run_ble_monitor()
        except KeyboardInterrupt:
            logger.info("Deteniendo por interrupción del usuario...")
        except Exception as e:
            logger.error(f"Error en sistema principal: {e}")
        finally:
            await self.stop()
    
    async def stop(self):
        """Detener el sistema"""
        logger.info("Deteniendo sistema de detección de caídas...")
        self.running = False
        
        if self.ble_client and self.ble_client.is_connected:
            try:
                await self.ble_client.stop_notify(TX_CHAR_UUID)
                await self.ble_client.disconnect()
            except Exception as e:
                logger.error(f"Error desconectando BLE: {e}")
        
        if self.ws:
            self.ws.close()
        
        logger.info("Sistema detenido")

async def main():
    import argparse
    
    # Declarar global antes de usar
    global USUARIO_ID
    
    parser = argparse.ArgumentParser(description="Sistema de detección de caídas BLE")
    parser.add_argument("--ws-url", default=WS_URL, help="URL del servidor WebSocket")
    parser.add_argument("--device-name", default=DEVICE_NAME, help="Nombre del dispositivo BLE")
    parser.add_argument("--user-id", default=USUARIO_ID, help="ID del usuario")
    
    args = parser.parse_args()
    
    # Actualizar configuración global
    USUARIO_ID = args.user_id
    
    system = FallDetectionSystem(
        ws_url=args.ws_url,
        device_name=args.device_name
    )
    
    await system.run()

if __name__ == "__main__":
    asyncio.run(main())