import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

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
    ws.on('message', (message) => {
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

// Manejar cierre graceful
process.on('SIGINT', () => {
    console.log('Cerrando servidor WebSocket...');
    wss.close(() => {
        server.close(() => {
            process.exit(0);
        });
    });
});