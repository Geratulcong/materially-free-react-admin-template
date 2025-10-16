import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import fetch from 'node-fetch';

// Configuración
const API_BASE_URL = 'http://localhost/api'; // Cambiar según tu configuración de XAMPP

// Crear servidor HTTP
const server = createServer();

// Crear servidor WebSocket
const wss = new WebSocketServer({ server });

// Almacenar conexiones de clientes React
const reactClients = new Set();
// Almacenar conexiones de Raspberry Pi
const raspberryClients = new Set();
// Almacenar conexiones de sistemas de detección de caídas
const fallDetectionClients = new Set();
// Almacenar historial de alertas (en memoria)
const alertHistory = [];
const maxAlerts = 100;

wss.on('connection', (ws, req) => {
    console.log('Nueva conexión WebSocket');
    
    // Manejar mensajes
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('Mensaje recibido:', data);
            
            // Si es un mensaje de identificación
            if (data.type === 'identify') {
                if (data.client === 'react') {
                    reactClients.add(ws);
                    console.log('Cliente React conectado');
                    ws.send(JSON.stringify({
                        type: 'connection',
                        status: 'connected',
                        message: 'Conectado al servidor WebSocket'
                    }));
                    
                    // Enviar historial de alertas recientes
                    if (alertHistory.length > 0) {
                        ws.send(JSON.stringify({
                            type: 'alert_history',
                            alerts: alertHistory.slice(-10) // Últimas 10 alertas
                        }));
                    }
                } else if (data.client === 'raspberry') {
                    raspberryClients.add(ws);
                    console.log('Raspberry Pi conectado');
                    ws.send(JSON.stringify({
                        type: 'connection',
                        status: 'connected',
                        message: 'Raspberry Pi conectado al servidor'
                    }));
                } else if (data.client === 'raspberry_fall_detection') {
                    fallDetectionClients.add(ws);
                    console.log('Sistema de detección de caídas conectado');
                    ws.send(JSON.stringify({
                        type: 'connection',
                        status: 'connected',
                        message: 'Sistema de detección de caídas conectado'
                    }));
                }
            }
            // Si es datos del sensor desde Raspberry Pi
            else if (data.type === 'sensor_data') {
                console.log('Datos del sensor recibidos:', data);
                
                // Guardar en base de datos
                await saveSensorDataToDB(data);
                
                // Retransmitir a todos los clientes React
                reactClients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'sensor_data',
                            timestamp: new Date().toISOString(),
                            ...data
                        }));
                    }
                });
            }
            // Si es una alerta de caída
            else if (data.type === 'fall_alert') {
                console.log('🚨 ALERTA DE CAÍDA:', data);
                
                // Guardar en base de datos
                await saveFallAlertToDB(data);
                
                // Agregar al historial
                const alert = {
                    ...data,
                    receivedAt: new Date().toISOString()
                };
                alertHistory.push(alert);
                
                // Mantener solo las últimas alertas
                if (alertHistory.length > maxAlerts) {
                    alertHistory.shift();
                }
                
                // Retransmitir a todos los clientes React
                reactClients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(alert));
                    }
                });
            }
            // Si es actualización de estado del sistema
            else if (data.type === 'system_status') {
                console.log('Estado del sistema:', data);
                
                // Guardar en base de datos
                await saveSensorDataToDB(data);
                
                // Retransmitir a todos los clientes React
                reactClients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'system_status',
                            timestamp: new Date().toISOString(),
                            ...data
                        }));
                    }
                });
            }
        } catch (error) {
            console.error('Error procesando mensaje:', error);
        }
    });
    
    // Manejar desconexión
    ws.on('close', () => {
        console.log('Cliente desconectado');
        reactClients.delete(ws);
        raspberryClients.delete(ws);
        fallDetectionClients.delete(ws);
    });
    
    // Manejar errores
    ws.on('error', (error) => {
        console.error('Error WebSocket:', error);
        reactClients.delete(ws);
        raspberryClients.delete(ws);
        fallDetectionClients.delete(ws);
    });
});

// Función para enviar datos de prueba (útil para testing)
function sendTestData() {
    const testData = {
        type: 'sensor_data',
        temperature: (20 + Math.random() * 10).toFixed(2),
        humidity: (40 + Math.random() * 20).toFixed(2),
        pressure: (1000 + Math.random() * 20).toFixed(2),
        acceleration: {
            x: (Math.random() * 2 - 1).toFixed(3),
            y: (Math.random() * 2 - 1).toFixed(3),
            z: (Math.random() * 2 - 1).toFixed(3)
        },
        gyroscope: {
            x: (Math.random() * 100 - 50).toFixed(3),
            y: (Math.random() * 100 - 50).toFixed(3),
            z: (Math.random() * 100 - 50).toFixed(3)
        }
    };
    
    reactClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'sensor_data',
                timestamp: new Date().toISOString(),
                ...testData
            }));
        }
    });
}

// Enviar datos de prueba cada 2 segundos (comentar cuando uses datos reales)
// setInterval(sendTestData, 2000);

const PORT = process.env.WS_PORT || 8080;
server.listen(PORT, () => {
    console.log(`Servidor WebSocket ejecutándose en puerto ${PORT}`);
    console.log(`Clientes React: ws://localhost:${PORT}`);
    console.log(`Raspberry Pi: ws://localhost:${PORT}`);
});

// =====================================================
// Funciones para guardar datos en base de datos
// =====================================================

async function saveSensorDataToDB(data) {
    try {
        const response = await fetch(`${API_BASE_URL}/sensor-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                device_id: data.device_name || data.device_id || 'unknown',
                user_id: data.user_id || 'default_user',
                timestamp: data.timestamp || new Date().toISOString(),
                arduino_timestamp: data.arduino_timestamp,
                sensor_data: data.sensor_data || {},
                baseline_acceleration: data.baseline_acceleration,
                current_acceleration: data.current_acceleration,
                system_active: data.system_active !== undefined ? data.system_active : true,
                fall_count: data.fall_count || 0,
                data_source: data.platform === 'Windows' ? 'simulator' : 'arduino'
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Datos de sensor guardados en BD:', result.data.id);
        } else {
            console.error('❌ Error guardando datos de sensor:', response.status, await response.text());
        }
    } catch (error) {
        console.error('❌ Error conectando con API para datos de sensor:', error.message);
    }
}

async function saveFallAlertToDB(data) {
    try {
        const response = await fetch(`${API_BASE_URL}/fall-alert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                alert_id: data.alert_id || `fall_${Date.now()}`,
                device_id: data.device_name || data.device_id || 'unknown',
                user_id: data.user_id || 'default_user',
                timestamp: data.timestamp || new Date().toISOString(),
                arduino_timestamp: data.arduino_timestamp,
                severity: data.severity || 'medium',
                magnitude: data.magnitude,
                confidence_score: data.confidence_score || 0.85,
                sensor_data: data.sensor_data || {},
                data_source: data.platform === 'Windows' ? 'simulator' : 'arduino'
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('🚨 Alerta de caída guardada en BD:', result.data.alert_id);
        } else {
            console.error('❌ Error guardando alerta de caída:', response.status, await response.text());
        }
    } catch (error) {
        console.error('❌ Error conectando con API para alerta de caída:', error.message);
    }
}

// Función para obtener estadísticas de la base de datos
async function getDBStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats?days=1`);
        if (response.ok) {
            const stats = await response.json();
            console.log('📊 Estadísticas de BD (últimas 24h):', stats.data);
            return stats.data;
        }
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error.message);
    }
    return null;
}

// Mostrar estadísticas cada 10 minutos
setInterval(async () => {
    await getDBStats();
}, 10 * 60 * 1000);

// Manejar cierre graceful
process.on('SIGINT', () => {
    console.log('Cerrando servidor WebSocket...');
    wss.close(() => {
        server.close(() => {
            process.exit(0);
        });
    });
});