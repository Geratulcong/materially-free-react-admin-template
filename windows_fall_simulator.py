#!/usr/bin/env python3
"""
Simulador de detección de caídas para Windows - Testing local
Este script simula el comportamiento del Raspberry Pi para pruebas.

Dependencias para Windows:
pip install websocket-client requests

Uso:
python windows_fall_simulator.py --ws-url ws://localhost:8080

Autor: Geronimo
Fecha: Octubre 2025
"""

import json
import time
import threading
import logging
import random
from datetime import datetime
import argparse

# Intentar importar websocket
try:
    import websocket
except ImportError:
    print("❌ Error: websocket-client no está instalado")
    print("Ejecuta: pip install websocket-client requests")
    exit(1)

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuración por defecto
DEFAULT_WS_URL = "ws://localhost:8080"
DEFAULT_USER_ID = "geronimo_windows_test"

class WindowsFallSimulator:
    def __init__(self, ws_url=DEFAULT_WS_URL, user_id=DEFAULT_USER_ID):
        self.ws_url = ws_url
        self.user_id = user_id
        self.ws = None
        self.connected = False
        self.running = False
        self.fall_count = 0
        self.last_status_update = 0
        
    def on_ws_open(self, ws):
        """Cuando se abre la conexión WebSocket"""
        logger.info("🔗 Conexión WebSocket establecida")
        self.connected = True
        
        # Identificarse como simulador de Windows
        identification = {
            "type": "identify",
            "client": "raspberry_fall_detection",
            "device": "Windows Fall Simulator",
            "platform": "Windows Testing"
        }
        ws.send(json.dumps(identification))
        
    def on_ws_message(self, ws, message):
        """Recibir mensajes del servidor"""
        try:
            data = json.loads(message)
            if data.get('type') == 'connection':
                logger.info(f"✅ Servidor responde: {data.get('message', 'Conectado')}")
        except Exception as e:
            logger.debug(f"Mensaje del servidor: {message}")
            
    def on_ws_error(self, ws, error):
        """Error en WebSocket"""
        logger.error(f"❌ Error WebSocket: {error}")
        self.connected = False
        
    def on_ws_close(self, ws, close_status_code, close_msg):
        """Conexión cerrada"""
        logger.info("🔌 Conexión WebSocket cerrada")
        self.connected = False
        
    def connect_websocket(self):
        """Conectar al servidor WebSocket"""
        try:
            logger.info(f"🔄 Conectando a: {self.ws_url}")
            self.ws = websocket.WebSocketApp(
                self.ws_url,
                on_open=self.on_ws_open,
                on_message=self.on_ws_message,
                on_error=self.on_ws_error,
                on_close=self.on_ws_close
            )
            
            # Ejecutar en hilo separado
            wst = threading.Thread(target=self.ws.run_forever)
            wst.daemon = True
            wst.start()
            
            # Esperar conexión (timeout 10 segundos)
            timeout = 10
            while not self.connected and timeout > 0:
                time.sleep(0.5)
                timeout -= 0.5
                
            if self.connected:
                logger.info("🎉 Conectado al servidor WebSocket")
            else:
                logger.error("⏰ Timeout: No se pudo conectar al servidor")
                
            return self.connected
            
        except Exception as e:
            logger.error(f"💥 Error conectando: {e}")
            return False
    
    def simulate_fall_detection(self, manual=False):
        """Simular detección de caída"""
        self.fall_count += 1
        timestamp = datetime.now().isoformat()
        
        alert_type = "MANUAL" if manual else "AUTOMÁTICA"
        logger.warning(f"🚨 CAÍDA {alert_type} DETECTADA! (#{self.fall_count})")
        
        # Simular datos de acelerómetro realistas
        fall_magnitude = random.uniform(2.8, 4.5)  # Magnitud de caída
        
        # Crear alerta completa
        fall_alert = {
            "type": "fall_alert",
            "timestamp": timestamp,
            "alert_id": f"fall_win_{self.fall_count}_{int(time.time())}",
            "severity": "high" if fall_magnitude > 3.5 else "medium",
            "location": "Windows Simulator",
            "user_id": self.user_id,
            "fall_count": self.fall_count,
            "device_status": "simulating",
            "simulation_data": {
                "fall_magnitude": round(fall_magnitude, 2),
                "trigger_type": alert_type.lower(),
                "platform": "Windows"
            }
        }
        
        # Enviar alerta
        if self.connected and self.ws:
            try:
                self.ws.send(json.dumps(fall_alert))
                logger.info(f"📤 Alerta enviada al dashboard (Severidad: {fall_alert['severity']})")
            except Exception as e:
                logger.error(f"❌ Error enviando alerta: {e}")
        else:
            logger.warning("⚠️  No hay conexión WebSocket para enviar alerta")
    
    def send_status_update(self):
        """Enviar actualización de estado periódica"""
        current_time = time.time()
        
        # Solo enviar cada 30 segundos
        if current_time - self.last_status_update < 30:
            return
            
        self.last_status_update = current_time
        
        status_update = {
            "type": "system_status",
            "timestamp": datetime.now().isoformat(),
            "ble_status": "simulated",
            "device_name": "WindowsSimulator",
            "fall_count": self.fall_count,
            "platform": "Windows",
            "status": "active"
        }
        
        if self.connected and self.ws:
            try:
                self.ws.send(json.dumps(status_update))
                logger.debug("📊 Estado del sistema actualizado")
            except Exception as e:
                logger.error(f"❌ Error enviando estado: {e}")
    
    def run_simulation(self):
        """Ejecutar simulación principal"""
        logger.info("🎮 Iniciando simulador de caídas para Windows...")
        logger.info("💡 Controles:")
        logger.info("   - Presiona ENTER para simular caída manual")
        logger.info("   - Presiona Ctrl+C para salir")
        logger.info("   - Caídas automáticas cada 60-120 segundos")
        
        self.running = True
        
        # Conectar WebSocket
        if not self.connect_websocket():
            logger.error("❌ No se pudo conectar al WebSocket")
            logger.info("💡 Asegúrate de que el servidor WebSocket esté ejecutándose:")
            logger.info("   node websocket-server.js")
            return
        
        # Hilo para simular caídas automáticas
        auto_fall_thread = threading.Thread(target=self._auto_fall_simulator)
        auto_fall_thread.daemon = True
        auto_fall_thread.start()
        
        # Bucle principal - escuchar input del usuario
        try:
            while self.running:
                # Enviar estado periódicamente
                self.send_status_update()
                
                # Simular input no bloqueante (simplificado para Windows)
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("\n⚠️  Interrupción detectada...")
            self.simulate_fall_detection(manual=True)
            logger.info("👋 Saliendo del simulador...")
        except Exception as e:
            logger.error(f"💥 Error en simulación: {e}")
        finally:
            self.stop()
            
    def _auto_fall_simulator(self):
        """Hilo para simular caídas automáticas"""
        while self.running:
            # Esperar entre 60-120 segundos para próxima caída automática
            wait_time = random.randint(60, 120)
            
            for _ in range(wait_time):
                if not self.running:
                    break
                time.sleep(1)
            
            if self.running:
                self.simulate_fall_detection(manual=False)
            
    def stop(self):
        """Detener simulador"""
        logger.info("🛑 Deteniendo simulador...")
        self.running = False
        
        if self.ws:
            try:
                # Enviar mensaje de desconexión
                disconnect_msg = {
                    "type": "system_status",
                    "timestamp": datetime.now().isoformat(),
                    "status": "disconnecting",
                    "fall_count": self.fall_count
                }
                self.ws.send(json.dumps(disconnect_msg))
            except:
                pass
            self.ws.close()
        
        logger.info("✅ Simulador detenido")

def main():
    parser = argparse.ArgumentParser(
        description="Simulador de detección de caídas para Windows",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos de uso:
  python windows_fall_simulator.py
  python windows_fall_simulator.py --ws-url ws://localhost:8080
  python windows_fall_simulator.py --user-id "test_user" --ws-url ws://192.168.1.100:8080

Asegúrate de tener el servidor WebSocket ejecutándose:
  node websocket-server.js
        """
    )
    
    parser.add_argument(
        "--ws-url", 
        default=DEFAULT_WS_URL, 
        help=f"URL del servidor WebSocket (default: {DEFAULT_WS_URL})"
    )
    parser.add_argument(
        "--user-id", 
        default=DEFAULT_USER_ID, 
        help=f"ID del usuario (default: {DEFAULT_USER_ID})"
    )
    
    args = parser.parse_args()
    
    print("🎯 Simulador de Detección de Caídas - Windows")
    print("=" * 50)
    print(f"📡 WebSocket: {args.ws_url}")
    print(f"👤 Usuario: {args.user_id}")
    print("=" * 50)
    
    simulator = WindowsFallSimulator(
        ws_url=args.ws_url,
        user_id=args.user_id
    )
    
    simulator.run_simulation()

if __name__ == "__main__":
    main()