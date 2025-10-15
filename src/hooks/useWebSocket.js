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
                    
                    if (data.type === 'sensor_data') {
                        setSensorData({
                            ...data,
                            receivedAt: new Date().toISOString()
                        });
                    } else if (data.type === 'connection') {
                        setConnectionStatus(data.message);
                    }
                } catch (error) {
                    console.error('Error parseando mensaje WebSocket:', error);
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