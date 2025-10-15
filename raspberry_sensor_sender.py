#!/usr/bin/env python3
"""
Script para Raspberry Pi que lee datos del sensor BLE Sense 33
y los envía al servidor WebSocket del dashboard React.

Dependencias:
pip install websocket-client requests json

Hardware:
- Raspberry Pi
- Arduino Nano 33 BLE Sense conectado vía USB/Serial

Autor: Tu nombre
Fecha: Octubre 2025
"""

import json
import time
import asyncio
import websocket
import threading
import serial
import logging
from datetime import datetime

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SensorDataSender:
    def __init__(self, ws_url="ws://localhost:8080", serial_port="/dev/ttyUSB0", baud_rate=9600):
        self.ws_url = ws_url
        self.serial_port = serial_port
        self.baud_rate = baud_rate
        self.ws = None
        self.connected = False
        self.running = False
        self.serial_connection = None
        
    def on_ws_open(self, ws):
        """Callback cuando se abre la conexión WebSocket"""
        logger.info("Conexión WebSocket establecida")
        self.connected = True
        
        # Identificarse como Raspberry Pi
        identification = {
            "type": "identify",
            "client": "raspberry",
            "device": "Raspberry Pi + BLE Sense 33"
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
        self.connected = False
        
    def on_ws_close(self, ws, close_status_code, close_msg):
        """Callback cuando se cierra la conexión WebSocket"""
        logger.info("Conexión WebSocket cerrada")
        self.connected = False
        
    def connect_websocket(self):
        """Conectar al servidor WebSocket"""
        try:
            websocket.enableTrace(True)
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
            while not self.connected and timeout > 0:
                time.sleep(0.5)
                timeout -= 0.5
                
            if not self.connected:
                logger.error("No se pudo conectar al servidor WebSocket")
                return False
                
            logger.info("Conectado al servidor WebSocket")
            return True
            
        except Exception as e:
            logger.error(f"Error conectando WebSocket: {e}")
            return False
            
    def connect_serial(self):
        """Conectar al Arduino vía serial"""
        try:
            self.serial_connection = serial.Serial(
                self.serial_port, 
                self.baud_rate, 
                timeout=1
            )
            logger.info(f"Conectado al puerto serial {self.serial_port}")
            return True
        except Exception as e:
            logger.error(f"Error conectando al puerto serial: {e}")
            return False
            
    def read_sensor_data(self):
        """Leer datos del sensor desde Arduino"""
        try:
            if self.serial_connection and self.serial_connection.in_waiting > 0:
                line = self.serial_connection.readline().decode('utf-8').strip()
                if line:
                    # Intentar parsear como JSON
                    try:
                        sensor_data = json.loads(line)
                        return sensor_data
                    except json.JSONDecodeError:
                        # Si no es JSON válido, intentar parsear manualmente
                        return self.parse_sensor_string(line)
            return None
        except Exception as e:
            logger.error(f"Error leyendo datos del sensor: {e}")
            return None
            
    def parse_sensor_string(self, data_string):
        """Parsear string de datos del sensor si no viene en JSON"""
        # Ejemplo para datos en formato: "temp:25.5,hum:60.2,press:1013.2"
        try:
            data = {}
            pairs = data_string.split(',')
            for pair in pairs:
                key, value = pair.split(':')
                data[key.strip()] = float(value.strip())
            
            # Mapear a formato estándar
            return {
                "temperature": data.get("temp"),
                "humidity": data.get("hum"),
                "pressure": data.get("press"),
                "acceleration": {
                    "x": data.get("acc_x", 0),
                    "y": data.get("acc_y", 0),
                    "z": data.get("acc_z", 0)
                },
                "gyroscope": {
                    "x": data.get("gyro_x", 0),
                    "y": data.get("gyro_y", 0),
                    "z": data.get("gyro_z", 0)
                }
            }
        except Exception as e:
            logger.error(f"Error parseando datos: {e}")
            return None
            
    def generate_test_data(self):
        """Generar datos de prueba si no hay conexión serial"""
        import random
        return {
            "temperature": round(20 + random.uniform(-5, 15), 2),
            "humidity": round(50 + random.uniform(-20, 30), 2),
            "pressure": round(1013 + random.uniform(-10, 20), 2),
            "acceleration": {
                "x": round(random.uniform(-2, 2), 3),
                "y": round(random.uniform(-2, 2), 3),
                "z": round(random.uniform(-2, 2), 3)
            },
            "gyroscope": {
                "x": round(random.uniform(-50, 50), 3),
                "y": round(random.uniform(-50, 50), 3),
                "z": round(random.uniform(-50, 50), 3)
            }
        }
        
    def send_sensor_data(self, sensor_data):
        """Enviar datos del sensor al servidor WebSocket"""
        if self.connected and self.ws:
            try:
                message = {
                    "type": "sensor_data",
                    "timestamp": datetime.now().isoformat(),
                    **sensor_data
                }
                self.ws.send(json.dumps(message))
                logger.info(f"Datos enviados: {message}")
                return True
            except Exception as e:
                logger.error(f"Error enviando datos: {e}")
                return False
        return False
        
    def run(self, use_test_data=False):
        """Ejecutar el bucle principal"""
        logger.info("Iniciando sensor data sender...")
        self.running = True
        
        # Conectar WebSocket
        if not self.connect_websocket():
            logger.error("No se pudo conectar al WebSocket")
            return
            
        # Conectar serial si no usar datos de prueba
        if not use_test_data:
            if not self.connect_serial():
                logger.warning("No se pudo conectar al serial, usando datos de prueba")
                use_test_data = True
        
        logger.info("Iniciando envío de datos...")
        
        try:
            while self.running:
                # Leer datos del sensor
                if use_test_data:
                    sensor_data = self.generate_test_data()
                else:
                    sensor_data = self.read_sensor_data()
                
                # Enviar datos si están disponibles
                if sensor_data:
                    self.send_sensor_data(sensor_data)
                    
                # Esperar antes del siguiente envío
                time.sleep(2)  # Enviar cada 2 segundos
                
        except KeyboardInterrupt:
            logger.info("Deteniendo por interrupción del usuario...")
        except Exception as e:
            logger.error(f"Error en bucle principal: {e}")
        finally:
            self.stop()
            
    def stop(self):
        """Detener el sender"""
        logger.info("Deteniendo sensor data sender...")
        self.running = False
        
        if self.serial_connection:
            self.serial_connection.close()
            
        if self.ws:
            self.ws.close()
            
        logger.info("Sensor data sender detenido")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Enviar datos de sensor BLE Sense 33 vía WebSocket")
    parser.add_argument("--ws-url", default="ws://localhost:8080", help="URL del servidor WebSocket")
    parser.add_argument("--serial-port", default="/dev/ttyUSB0", help="Puerto serial del Arduino")
    parser.add_argument("--baud-rate", type=int, default=9600, help="Velocidad del puerto serial")
    parser.add_argument("--test-data", action="store_true", help="Usar datos de prueba en lugar de sensor real")
    
    args = parser.parse_args()
    
    sender = SensorDataSender(
        ws_url=args.ws_url,
        serial_port=args.serial_port,
        baud_rate=args.baud_rate
    )
    
    sender.run(use_test_data=args.test_data)