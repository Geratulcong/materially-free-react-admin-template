import { useState, useEffect, useRef, useCallback } from 'react';

const useWebSocket = (url = 'ws://localhost:8080') => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [sensorData, setSensorData] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('Desconectado');
    const [error, setError] = useState(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    const connect = useCallback(() => {
        try {
            console.log('Intentando conectar a WebSocket:', url);
            const ws = new WebSocket(url);

            ws.onopen = () => {
                console.log('WebSocket conectado');
                setIsConnected(true);
                setConnectionStatus('Conectado');
                setError(null);
                reconnectAttempts.current = 0;
                
                // Identificarse como cliente React
                ws.send(JSON.stringify({
                    type: 'identify',
                    client: 'react'
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('Datos recibidos:', data);
                    
                    // Procesar mensajes del formato antiguo
                    if (data.type === 'sensor_data') {
                        setSensorData({
                            ...data,
                            receivedAt: new Date().toISOString()
                        });
                    } 
                    // Procesar mensajes del formato compacto del Arduino
                    else if (data.t === 'STATUS' || data.type === 'system_status') {
                        // Convertir formato compacto a formato extendido
                        const processedData = {
                            type: 'sensor_data',
                            timestamp: data.ts || data.timestamp || Date.now(),
                            system_active: data.sa !== undefined ? Boolean(data.sa) : data.system_active,
                            fall_count: data.fc || data.fall_count || 0,
                            baseline: data.bl || data.baseline_acceleration || 1.0,
                            current_accel: data.ca || data.current_acceleration || 1.0,
                            receivedAt: new Date().toISOString()
                        };
                        
                        // Procesar datos ambientales
                        if (data.env && Array.isArray(data.env) && data.env.length >= 3) {
                            // Formato compacto: [temp, hum, press]
                            processedData.temperature = data.env[0] !== -999 ? data.env[0] : null;
                            processedData.humidity = data.env[1] !== -999 ? data.env[1] : null;
                            processedData.pressure = data.env[2] !== -999 ? data.env[2] : null;
                        } else if (data.sensor_data?.environment) {
                            // Formato extendido de Python
                            const env = data.sensor_data.environment;
                            processedData.temperature = env.temperature;
                            processedData.humidity = env.humidity;
                            processedData.pressure = env.pressure;
                        }
                        
                        setSensorData(processedData);
                    }
                    // Procesar alertas de caída
                    else if (data.t === 'FALL' || data.type === 'fall_alert') {
                        const fallData = {
                            type: 'fall_alert',
                            timestamp: data.ts || data.timestamp || Date.now(),
                            fall_count: data.fc || data.fall_count || 0,
                            severity: data.sev || data.severity || 'medium',
                            magnitude: data.mag || data.magnitude || 0,
                            receivedAt: new Date().toISOString()
                        };
                        
                        // Procesar datos de aceleración
                        if (data.acc && Array.isArray(data.acc) && data.acc.length >= 3) {
                            fallData.acceleration = {
                                x: data.acc[0],
                                y: data.acc[1],
                                z: data.acc[2]
                            };
                        } else if (data.sensor_data?.acceleration) {
                            fallData.acceleration = data.sensor_data.acceleration;
                        }
                        
                        // Procesar datos ambientales
                        if (data.env && Array.isArray(data.env) && data.env.length >= 3) {
                            fallData.temperature = data.env[0] !== -999 ? data.env[0] : null;
                            fallData.humidity = data.env[1] !== -999 ? data.env[1] : null;
                            fallData.pressure = data.env[2] !== -999 ? data.env[2] : null;
                        } else if (data.sensor_data?.environment) {
                            const env = data.sensor_data.environment;
                            fallData.temperature = env.temperature;
                            fallData.humidity = env.humidity;
                            fallData.pressure = env.pressure;
                        }
                        
                        setSensorData(fallData);
                    }
                    else if (data.type === 'connection') {
                        setConnectionStatus(data.message);
                    }
                } catch (error) {
                    console.error('Error parseando mensaje WebSocket:', error, 'Datos recibidos:', event.data);
                    setError('Error procesando datos del servidor');
                }
            };

            ws.onclose = (event) => {
                console.log('WebSocket desconectado', event.code, event.reason);
                setIsConnected(false);
                setConnectionStatus('Desconectado');
                setSocket(null);
                
                // Intentar reconectar si no fue un cierre intencional
                if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
                    const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
                    setConnectionStatus(`Reconectando en ${timeout/1000}s...`);
                    
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts.current += 1;
                        connect();
                    }, timeout);
                }
            };

            ws.onerror = (error) => {
                console.error('Error WebSocket:', error);
                setError('Error de conexión WebSocket');
                setConnectionStatus('Error de conexión');
            };

            setSocket(ws);
        } catch (error) {
            console.error('Error creando WebSocket:', error);
            setError('No se pudo crear la conexión WebSocket');
            setConnectionStatus('Error al conectar');
        }
    }, [url]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close(1000, 'Desconexión manual');
        }
        
        setSocket(null);
        setIsConnected(false);
        setConnectionStatus('Desconectado');
    }, [socket]);

    const sendMessage = useCallback((message) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
            return true;
        }
        return false;
    }, [socket]);

    // Conectar automáticamente al montar el componente
    useEffect(() => {
        connect();

        // Cleanup al desmontar
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (socket) {
                socket.close();
            }
        };
    }, []);

    // Cleanup del timeout
    useEffect(() => {
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, []);

    return {
        isConnected,
        sensorData,
        connectionStatus,
        error,
        connect,
        disconnect,
        sendMessage,
        reconnectAttempts: reconnectAttempts.current
    };
};

export default useWebSocket;