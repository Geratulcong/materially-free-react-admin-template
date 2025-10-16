-- =====================================================
-- Base de Datos para Sistema de Detección de Caídas
-- Arduino Nano 33 BLE Sense + Raspberry Pi + React
-- =====================================================

CREATE DATABASE IF NOT EXISTS fall_detection_system 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE fall_detection_system;

-- =====================================================
-- Tabla: Usuarios/Clientes
-- =====================================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    emergency_contact VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
);

-- =====================================================
-- Tabla: Dispositivos Arduino
-- =====================================================
CREATE TABLE devices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    device_id VARCHAR(50) UNIQUE NOT NULL,
    device_name VARCHAR(100),
    device_type VARCHAR(50) DEFAULT 'Arduino_Nano_33_BLE',
    user_id VARCHAR(50),
    mac_address VARCHAR(17),
    firmware_version VARCHAR(20),
    location VARCHAR(100),
    installation_date DATE,
    last_seen TIMESTAMP,
    battery_level TINYINT,
    status ENUM('online', 'offline', 'maintenance') DEFAULT 'offline',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_device_id (device_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_last_seen (last_seen)
);

-- =====================================================
-- Tabla: Datos de Sensores (Histórico)
-- =====================================================
CREATE TABLE sensor_data (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    device_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50),
    timestamp TIMESTAMP NOT NULL,
    arduino_timestamp BIGINT,
    
    -- Datos de acelerómetro
    acceleration_x DECIMAL(8,4),
    acceleration_y DECIMAL(8,4),
    acceleration_z DECIMAL(8,4),
    acceleration_magnitude DECIMAL(8,4),
    
    -- Datos de giroscopio
    gyroscope_x DECIMAL(8,4),
    gyroscope_y DECIMAL(8,4),
    gyroscope_z DECIMAL(8,4),
    
    -- Datos ambientales
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    pressure DECIMAL(7,2),
    
    -- Estado del sistema
    baseline_acceleration DECIMAL(8,4),
    current_acceleration DECIMAL(8,4),
    system_active BOOLEAN DEFAULT TRUE,
    fall_count INT DEFAULT 0,
    
    -- Metadatos
    data_source ENUM('arduino', 'simulator', 'manual') DEFAULT 'arduino',
    data_quality ENUM('excellent', 'good', 'fair', 'poor') DEFAULT 'good',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    
    INDEX idx_device_timestamp (device_id, timestamp),
    INDEX idx_user_timestamp (user_id, timestamp),
    INDEX idx_timestamp (timestamp),
    INDEX idx_fall_count (fall_count),
    INDEX idx_data_source (data_source)
);

-- =====================================================
-- Tabla: Alertas de Caídas
-- =====================================================
CREATE TABLE fall_alerts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    alert_id VARCHAR(100) UNIQUE NOT NULL,
    device_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50),
    
    -- Datos de la caída
    fall_timestamp TIMESTAMP NOT NULL,
    arduino_timestamp BIGINT,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    magnitude DECIMAL(8,4),
    confidence_score DECIMAL(3,2) DEFAULT 0.85,
    
    -- Datos del contexto
    acceleration_x DECIMAL(8,4),
    acceleration_y DECIMAL(8,4),
    acceleration_z DECIMAL(8,4),
    gyroscope_x DECIMAL(8,4),
    gyroscope_y DECIMAL(8,4),
    gyroscope_z DECIMAL(8,4),
    
    -- Datos ambientales en el momento de la caída
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    pressure DECIMAL(7,2),
    
    -- Estado de la alerta
    status ENUM('pending', 'acknowledged', 'resolved', 'false_positive') DEFAULT 'pending',
    response_time INT, -- segundos hasta respuesta
    resolved_at TIMESTAMP NULL,
    resolved_by VARCHAR(100),
    notes TEXT,
    
    -- Notificaciones
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_methods JSON, -- ["sms", "email", "call", "dashboard"]
    emergency_contacted BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    
    INDEX idx_alert_id (alert_id),
    INDEX idx_device_timestamp (device_id, fall_timestamp),
    INDEX idx_user_timestamp (user_id, fall_timestamp),
    INDEX idx_status (status),
    INDEX idx_severity (severity),
    INDEX idx_pending_alerts (status, fall_timestamp)
);

-- =====================================================
-- Tabla: Estadísticas Diarias
-- =====================================================
CREATE TABLE daily_stats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    device_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50),
    date DATE NOT NULL,
    
    -- Contadores
    total_readings INT DEFAULT 0,
    total_falls INT DEFAULT 0,
    false_positives INT DEFAULT 0,
    uptime_minutes INT DEFAULT 0,
    
    -- Promedios ambientales
    avg_temperature DECIMAL(5,2),
    min_temperature DECIMAL(5,2),
    max_temperature DECIMAL(5,2),
    avg_humidity DECIMAL(5,2),
    min_humidity DECIMAL(5,2),
    max_humidity DECIMAL(5,2),
    avg_pressure DECIMAL(7,2),
    min_pressure DECIMAL(7,2),
    max_pressure DECIMAL(7,2),
    
    -- Estadísticas de movimiento
    avg_acceleration DECIMAL(8,4),
    max_acceleration DECIMAL(8,4),
    activity_level ENUM('low', 'moderate', 'high') DEFAULT 'moderate',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_device_date (device_id, date),
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    
    INDEX idx_device_date (device_id, date),
    INDEX idx_user_date (user_id, date),
    INDEX idx_date (date)
);

-- =====================================================
-- Tabla: Configuración del Sistema
-- =====================================================
CREATE TABLE system_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    description TEXT,
    data_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================================
-- Datos Iniciales
-- =====================================================

-- Usuario de prueba
INSERT INTO users (user_id, name, email, phone, emergency_contact) VALUES
('cliente123', 'Usuario de Prueba', 'usuario@test.com', '+1234567890', '+0987654321'),
('geronimo_windows_test', 'Geronimo Windows Test', 'geronimo@test.com', '+1111111111', '+2222222222');

-- Dispositivo de prueba
INSERT INTO devices (device_id, device_name, user_id, location, status) VALUES
('Nano33BLE-FallDetector', 'Arduino Sensor Principal', 'cliente123', 'Casa Principal', 'online'),
('WindowsSimulator', 'Simulador Windows', 'geronimo_windows_test', 'PC Windows', 'online');

-- Configuración inicial
INSERT INTO system_config (config_key, config_value, description, data_type) VALUES
('fall_threshold', '2.5', 'Umbral de detección de caída', 'number'),
('high_impact_threshold', '3.5', 'Umbral de impacto alto', 'number'),
('notification_delay', '30', 'Segundos antes de enviar notificación', 'number'),
('data_retention_days', '365', 'Días para retener datos históricos', 'number'),
('emergency_phone', '+911', 'Número de emergencia', 'string'),
('system_name', 'Sistema de Detección de Caídas', 'Nombre del sistema', 'string');

-- =====================================================
-- Vistas para Consultas Frecuentes
-- =====================================================

-- Vista: Alertas recientes con información del usuario
CREATE VIEW recent_alerts AS
SELECT 
    fa.id,
    fa.alert_id,
    fa.fall_timestamp,
    fa.severity,
    fa.status,
    fa.magnitude,
    u.name as user_name,
    u.phone as user_phone,
    u.emergency_contact,
    d.device_name,
    d.location,
    fa.temperature,
    fa.humidity,
    fa.pressure
FROM fall_alerts fa
JOIN devices d ON fa.device_id = d.device_id
JOIN users u ON fa.user_id = u.user_id
WHERE fa.fall_timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY fa.fall_timestamp DESC;

-- Vista: Estadísticas del último mes
CREATE VIEW monthly_summary AS
SELECT 
    u.user_id,
    u.name,
    d.device_id,
    d.device_name,
    COUNT(fa.id) as total_falls,
    AVG(sd.temperature) as avg_temperature,
    AVG(sd.humidity) as avg_humidity,
    AVG(sd.pressure) as avg_pressure,
    MAX(sd.timestamp) as last_reading
FROM users u
JOIN devices d ON u.user_id = d.user_id
LEFT JOIN fall_alerts fa ON d.device_id = fa.device_id 
    AND fa.fall_timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
LEFT JOIN sensor_data sd ON d.device_id = sd.device_id 
    AND sd.timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY u.user_id, d.device_id;

-- =====================================================
-- Índices adicionales para optimización
-- =====================================================

-- Índice compuesto para consultas de rango temporal
CREATE INDEX idx_sensor_data_device_time_range 
ON sensor_data (device_id, timestamp, temperature, humidity, pressure);

-- Índice para alertas pendientes
CREATE INDEX idx_pending_alerts_priority 
ON fall_alerts (status, severity, fall_timestamp) 
WHERE status = 'pending';

-- =====================================================
-- Comentarios finales
-- =====================================================

-- Esta base de datos está optimizada para:
-- 1. Almacenar grandes volúmenes de datos de sensores
-- 2. Consultas rápidas de alertas y estadísticas
-- 3. Escalabilidad para múltiples usuarios y dispositivos
-- 4. Análisis histórico y reportes
-- 5. Integridad referencial y consistencia de datos

SELECT 'Base de datos fall_detection_system creada exitosamente!' as status;