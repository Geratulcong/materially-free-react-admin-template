import React, { useState, useEffect } from 'react';
import {
    Box,
    Grid,
    Card,
    CardContent,
    Typography,
    Chip,
    Alert,
    IconButton,
    Divider,
    LinearProgress
} from '@mui/material';
import {
    Wifi,
    WifiOff,
    Refresh,
    DeviceThermostat,
    WaterDrop,
    Speed,
    RotateRight
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import useWebSocket from '../../hooks/useWebSocket';

const SensorDashboard = () => {
    const { isConnected, sensorData, connectionStatus, error, connect, disconnect } = useWebSocket();
    const [historicalData, setHistoricalData] = useState([]);
    const [maxDataPoints] = useState(50); // Máximo de puntos en el gráfico

    // Actualizar datos históricos cuando llegan nuevos datos
    useEffect(() => {
        if (sensorData) {
            setHistoricalData(prev => {
                const newData = {
                    time: new Date(sensorData.timestamp || sensorData.receivedAt).toLocaleTimeString(),
                    temperature: parseFloat(sensorData.temperature) || 0,
                    humidity: parseFloat(sensorData.humidity) || 0,
                    pressure: parseFloat(sensorData.pressure) || 0,
                    timestamp: sensorData.timestamp || sensorData.receivedAt
                };
                
                const updated = [...prev, newData];
                // Mantener solo los últimos maxDataPoints
                return updated.slice(-maxDataPoints);
            });
        }
    }, [sensorData, maxDataPoints]);

    const formatValue = (value, unit = '') => {
        if (value === null || value === undefined) return 'N/A';
        return `${parseFloat(value).toFixed(2)}${unit}`;
    };

    const getConnectionColor = () => {
        if (isConnected) return 'success';
        if (error) return 'error';
        return 'warning';
    };

    const DataCard = ({ title, value, unit, icon: Icon, color = 'primary' }) => (
        <Card elevation={2} sx={{ height: '100%' }}>
            <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="h6" color="text.secondary">
                        {title}
                    </Typography>
                    <Icon color={color} />
                </Box>
                <Typography variant="h4" component="div" color={color}>
                    {formatValue(value, unit)}
                </Typography>
                {sensorData && (
                    <Typography variant="caption" color="text.secondary">
                        Actualizado: {new Date(sensorData.receivedAt).toLocaleTimeString()}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );

    const AccelerationCard = ({ data }) => (
        <Card elevation={2}>
            <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6" color="text.secondary">
                        Aceleración (g)
                    </Typography>
                    <RotateRight color="info" />
                </Box>
                <Grid container spacing={2}>
                    <Grid item xs={4}>
                        <Typography variant="body2" color="text.secondary">X</Typography>
                        <Typography variant="h6" color="info">
                            {formatValue(data?.x)}
                        </Typography>
                    </Grid>
                    <Grid item xs={4}>
                        <Typography variant="body2" color="text.secondary">Y</Typography>
                        <Typography variant="h6" color="info">
                            {formatValue(data?.y)}
                        </Typography>
                    </Grid>
                    <Grid item xs={4}>
                        <Typography variant="body2" color="text.secondary">Z</Typography>
                        <Typography variant="h6" color="info">
                            {formatValue(data?.z)}
                        </Typography>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );

    const GyroscopeCard = ({ data }) => (
        <Card elevation={2}>
            <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6" color="text.secondary">
                        Giroscopio (°/s)
                    </Typography>
                    <RotateRight color="secondary" />
                </Box>
                <Grid container spacing={2}>
                    <Grid item xs={4}>
                        <Typography variant="body2" color="text.secondary">X</Typography>
                        <Typography variant="h6" color="secondary">
                            {formatValue(data?.x)}
                        </Typography>
                    </Grid>
                    <Grid item xs={4}>
                        <Typography variant="body2" color="text.secondary">Y</Typography>
                        <Typography variant="h6" color="secondary">
                            {formatValue(data?.y)}
                        </Typography>
                    </Grid>
                    <Grid item xs={4}>
                        <Typography variant="body2" color="text.secondary">Z</Typography>
                        <Typography variant="h6" color="secondary">
                            {formatValue(data?.z)}
                        </Typography>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" component="h1">
                    Monitor de Sensores BLE Sense 33
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                    <Chip
                        icon={isConnected ? <Wifi /> : <WifiOff />}
                        label={connectionStatus}
                        color={getConnectionColor()}
                        variant={isConnected ? "filled" : "outlined"}
                    />
                    <IconButton onClick={connect} disabled={isConnected}>
                        <Refresh />
                    </IconButton>
                </Box>
            </Box>

            {/* Error Alert */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Loading cuando no hay conexión */}
            {!isConnected && !error && (
                <LinearProgress sx={{ mb: 2 }} />
            )}

            {/* Cards de datos en tiempo real */}
            <Grid container spacing={3} mb={3}>
                <Grid item xs={12} sm={6} md={3}>
                    <DataCard
                        title="Temperatura"
                        value={sensorData?.temperature}
                        unit="°C"
                        icon={DeviceThermostat}
                        color="error"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <DataCard
                        title="Humedad"
                        value={sensorData?.humidity}
                        unit="%"
                        icon={WaterDrop}
                        color="primary"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <DataCard
                        title="Presión"
                        value={sensorData?.pressure}
                        unit=" hPa"
                        icon={Speed}
                        color="warning"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card elevation={2} sx={{ height: '100%' }}>
                        <CardContent>
                            <Typography variant="h6" color="text.secondary" mb={1}>
                                Estado
                            </Typography>
                            <Typography variant="h6" color={isConnected ? 'success.main' : 'error.main'}>
                                {isConnected ? 'En línea' : 'Desconectado'}
                            </Typography>
                            {sensorData && (
                                <Typography variant="caption" color="text.secondary">
                                    Último dato: {new Date(sensorData.receivedAt).toLocaleString()}
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Cards de aceleración y giroscopio */}
            <Grid container spacing={3} mb={3}>
                <Grid item xs={12} md={6}>
                    <AccelerationCard data={sensorData?.acceleration} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <GyroscopeCard data={sensorData?.gyroscope} />
                </Grid>
            </Grid>

            {/* Gráfico histórico */}
            <Card elevation={2}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Tendencias Históricas
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Box height={400}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={historicalData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                    dataKey="time" 
                                    interval="preserveStartEnd"
                                    fontSize={12}
                                />
                                <YAxis fontSize={12} />
                                <Tooltip 
                                    labelFormatter={(value) => `Hora: ${value}`}
                                    formatter={(value, name) => {
                                        const units = {
                                            temperature: '°C',
                                            humidity: '%',
                                            pressure: 'hPa'
                                        };
                                        return [`${value}${units[name] || ''}`, name];
                                    }}
                                />
                                <Legend />
                                <Line 
                                    type="monotone" 
                                    dataKey="temperature" 
                                    stroke="#f44336" 
                                    strokeWidth={2}
                                    dot={false}
                                    name="Temperatura"
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="humidity" 
                                    stroke="#2196f3" 
                                    strokeWidth={2}
                                    dot={false}
                                    name="Humedad"
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="pressure" 
                                    stroke="#ff9800" 
                                    strokeWidth={2}
                                    dot={false}
                                    name="Presión"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
};

export default SensorDashboard;