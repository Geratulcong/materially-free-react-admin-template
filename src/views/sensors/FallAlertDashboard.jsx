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
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Badge,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from '@mui/material';
import {
    Warning,
    Refresh,
    Bluetooth,
    BluetoothDisabled,
    NotificationImportant,
    History,
    Person,
    AccessTime,
    ExpandMore,
    Emergency,
    CheckCircle,
    Error as ErrorIcon
} from '@mui/icons-material';
import useWebSocket from '../../hooks/useWebSocket';

const FallAlertDashboard = () => {
    const { isConnected, sensorData, connectionStatus, error } = useWebSocket();
    const [alerts, setAlerts] = useState([]);
    const [systemStatus, setSystemStatus] = useState({
        ble_status: 'unknown',
        device_name: 'N/A',
        fall_count: 0
    });
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [unreadAlerts, setUnreadAlerts] = useState(0);

    // Procesar datos del WebSocket para alertas de caída y estado del sistema
    useEffect(() => {
        if (sensorData) {
            console.log('FallAlertDashboard - Datos recibidos:', sensorData);
            
            if (sensorData.type === 'fall_alert') {
                handleNewAlert(sensorData);
            } else if (sensorData.type === 'sensor_data') {
                // Actualizar estado del sistema con datos de sensores
                setSystemStatus(prev => ({
                    ...prev,
                    ble_status: isConnected ? 'connected' : 'disconnected',
                    device_name: 'Nano33BLE-FallDetector',
                    fall_count: sensorData.fall_count || prev.fall_count,
                    system_active: sensorData.system_active,
                    last_update: new Date().toISOString()
                }));
            }
        }
    }, [sensorData, isConnected]);

    const handleNewAlert = (alert) => {
        setAlerts(prev => {
            const newAlerts = [alert, ...prev];
            // Mantener solo las últimas 50 alertas
            return newAlerts.slice(0, 50);
        });
        setUnreadAlerts(prev => prev + 1);
        
        // Mostrar notificación del navegador si está permitido
        if (Notification.permission === 'granted') {
            new Notification('¡Alerta de Caída Detectada!', {
                body: `Caída detectada en ${new Date(alert.timestamp).toLocaleString()}`,
                icon: '/favicon.svg',
                requireInteraction: true
            });
        }
    };

    const handleAlertClick = (alert) => {
        setSelectedAlert(alert);
        setDialogOpen(true);
    };

    const markAlertsAsRead = () => {
        setUnreadAlerts(0);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'connected': return 'success';
            case 'disconnected': return 'error';
            case 'error': return 'error';
            default: return 'warning';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'connected': return <Bluetooth />;
            case 'disconnected': return <BluetoothDisabled />;
            case 'error': return <ErrorIcon />;
            default: return <Warning />;
        }
    };

    const formatTimeAgo = (timestamp) => {
        const now = new Date();
        const alertTime = new Date(timestamp);
        const diffMs = now - alertTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
        if (diffHours > 0) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
        if (diffMins > 0) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
        return 'Ahora mismo';
    };

    // Solicitar permisos de notificación al cargar
    useEffect(() => {
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" component="h1">
                    Sistema de Detección de Caídas
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                    <Chip
                        icon={getStatusIcon(systemStatus.ble_status)}
                        label={`BLE: ${systemStatus.ble_status}`}
                        color={getStatusColor(systemStatus.ble_status)}
                        variant={systemStatus.ble_status === 'connected' ? "filled" : "outlined"}
                    />
                    <Chip
                        label={connectionStatus}
                        color={isConnected ? 'success' : 'error'}
                        variant={isConnected ? "filled" : "outlined"}
                    />
                </Box>
            </Box>

            {/* Error Alert */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Tarjetas de estadísticas */}
            <Grid container spacing={3} mb={3}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Box>
                                    <Typography color="textSecondary" gutterBottom>
                                        Total de Caídas
                                    </Typography>
                                    <Typography variant="h4" color="error">
                                        {systemStatus.fall_count}
                                    </Typography>
                                </Box>
                                <Emergency color="error" sx={{ fontSize: 40 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Box>
                                    <Typography color="textSecondary" gutterBottom>
                                        Alertas Hoy
                                    </Typography>
                                    <Typography variant="h4" color="warning.main">
                                        {alerts.filter(alert => {
                                            const today = new Date().toDateString();
                                            const alertDate = new Date(alert.timestamp).toDateString();
                                            return today === alertDate;
                                        }).length}
                                    </Typography>
                                </Box>
                                <NotificationImportant color="warning" sx={{ fontSize: 40 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Box>
                                    <Typography color="textSecondary" gutterBottom>
                                        Estado del Sistema
                                    </Typography>
                                    <Typography variant="h6" color={getStatusColor(systemStatus.ble_status) + '.main'}>
                                        {systemStatus.ble_status === 'connected' ? 'Activo' : 'Inactivo'}
                                    </Typography>
                                </Box>
                                {systemStatus.ble_status === 'connected' ? 
                                    <CheckCircle color="success" sx={{ fontSize: 40 }} /> :
                                    <ErrorIcon color="error" sx={{ fontSize: 40 }} />
                                }
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Box>
                                    <Typography color="textSecondary" gutterBottom>
                                        Dispositivo
                                    </Typography>
                                    <Typography variant="h6">
                                        {systemStatus.device_name}
                                    </Typography>
                                </Box>
                                <Person color="primary" sx={{ fontSize: 40 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Historial de alertas */}
            <Card>
                <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6">
                            <Badge badgeContent={unreadAlerts} color="error">
                                Historial de Alertas
                            </Badge>
                        </Typography>
                        <Button 
                            startIcon={<History />} 
                            onClick={markAlertsAsRead}
                            disabled={unreadAlerts === 0}
                        >
                            Marcar como leídas
                        </Button>
                    </Box>
                    
                    <Divider sx={{ mb: 2 }} />
                    
                    {alerts.length === 0 ? (
                        <Box textAlign="center" py={4}>
                            <CheckCircle color="success" sx={{ fontSize: 60, mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                No hay alertas registradas
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                El sistema está monitoreando activamente
                            </Typography>
                        </Box>
                    ) : (
                        <List>
                            {alerts.map((alert, index) => (
                                <React.Fragment key={alert.alert_id || index}>
                                    <ListItem 
                                        button 
                                        onClick={() => handleAlertClick(alert)}
                                        sx={{ 
                                            bgcolor: index < unreadAlerts ? 'error.light' : 'transparent',
                                            '&:hover': { bgcolor: 'action.hover' }
                                        }}
                                    >
                                        <ListItemIcon>
                                            <Emergency color="error" />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <Typography variant="subtitle1" color="error">
                                                        Caída Detectada
                                                    </Typography>
                                                    <Chip 
                                                        label={alert.severity || 'high'} 
                                                        color="error" 
                                                        size="small" 
                                                    />
                                                </Box>
                                            }
                                            secondary={
                                                <Box>
                                                    <Typography variant="body2" color="text.secondary">
                                                        <AccessTime sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                                                        {new Date(alert.timestamp).toLocaleString()} ({formatTimeAgo(alert.timestamp)})
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Usuario: {alert.user_id} | Ubicación: {alert.location}
                                                    </Typography>
                                                </Box>
                                            }
                                        />
                                    </ListItem>
                                    {index < alerts.length - 1 && <Divider />}
                                </React.Fragment>
                            ))}
                        </List>
                    )}
                </CardContent>
            </Card>

            {/* Dialog de detalles de alerta */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    <Box display="flex" alignItems="center" gap={1}>
                        <Emergency color="error" />
                        Detalles de la Alerta
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {selectedAlert && (
                        <Box>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="text.secondary">
                                        Fecha y Hora
                                    </Typography>
                                    <Typography variant="body1" mb={2}>
                                        {new Date(selectedAlert.timestamp).toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="text.secondary">
                                        Severidad
                                    </Typography>
                                    <Chip 
                                        label={selectedAlert.severity || 'high'} 
                                        color="error" 
                                        sx={{ mb: 2 }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="text.secondary">
                                        Usuario
                                    </Typography>
                                    <Typography variant="body1" mb={2}>
                                        {selectedAlert.user_id}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" color="text.secondary">
                                        Ubicación
                                    </Typography>
                                    <Typography variant="body1" mb={2}>
                                        {selectedAlert.location}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" color="text.secondary">
                                        ID de Alerta
                                    </Typography>
                                    <Typography variant="body2" fontFamily="monospace" mb={2}>
                                        {selectedAlert.alert_id}
                                    </Typography>
                                </Grid>
                            </Grid>
                            
                            <Accordion>
                                <AccordionSummary expandIcon={<ExpandMore />}>
                                    <Typography>Datos Técnicos</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                                        {JSON.stringify(selectedAlert, null, 2)}
                                    </pre>
                                </AccordionDetails>
                            </Accordion>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>
                        Cerrar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default FallAlertDashboard;