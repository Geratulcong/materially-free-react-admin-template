<?php
/**
 * API REST para Sistema de Detección de Caídas
 * Arduino Nano 33 BLE Sense + Raspberry Pi + React + MySQL
 * 
 * Endpoints:
 * POST /api/sensor-data    - Guardar datos de sensores
 * POST /api/fall-alert     - Guardar alerta de caída
 * GET  /api/history        - Obtener datos históricos
 * GET  /api/stats          - Obtener estadísticas
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configuración de base de datos
class DatabaseConfig {
    const HOST = 'localhost';
    const USERNAME = 'root';
    const PASSWORD = '';  // Cambiar si tienes contraseña en XAMPP
    const DATABASE = 'fall_detection_system';
    const CHARSET = 'utf8mb4';
}

class FallDetectionAPI {
    private $pdo;
    
    public function __construct() {
        try {
            $dsn = sprintf(
                'mysql:host=%s;dbname=%s;charset=%s',
                DatabaseConfig::HOST,
                DatabaseConfig::DATABASE,
                DatabaseConfig::CHARSET
            );
            
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ];
            
            $this->pdo = new PDO($dsn, DatabaseConfig::USERNAME, DatabaseConfig::PASSWORD, $options);
        } catch (PDOException $e) {
            $this->sendError(500, 'Error de conexión a base de datos: ' . $e->getMessage());
        }
    }
    
    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $uri = rtrim($uri, '/');
        
        // Remover prefijo si existe
        $uri = preg_replace('#^/api#', '', $uri);
        
        switch ($method . ' ' . $uri) {
            case 'POST /sensor-data':
                $this->saveSensorData();
                break;
                
            case 'POST /fall-alert':
                $this->saveFallAlert();
                break;
                
            case 'GET /history':
                $this->getHistory();
                break;
                
            case 'GET /stats':
                $this->getStats();
                break;
                
            case 'GET /recent-alerts':
                $this->getRecentAlerts();
                break;
                
            case 'GET /devices':
                $this->getDevices();
                break;
                
            case 'GET /users':
                $this->getUsers();
                break;
                
            default:
                $this->sendError(404, 'Endpoint no encontrado');
        }
    }
    
    private function saveSensorData() {
        $input = $this->getJsonInput();
        
        if (!$input) {
            $this->sendError(400, 'Datos JSON inválidos');
            return;
        }
        
        try {
            // Extraer datos del formato WebSocket
            $deviceId = $input['device_id'] ?? 'unknown';
            $userId = $input['user_id'] ?? null;
            $timestamp = $input['timestamp'] ?? date('Y-m-d H:i:s');
            $arduinoTimestamp = $input['arduino_timestamp'] ?? null;
            
            // Datos de sensores
            $sensorData = $input['sensor_data'] ?? [];
            $environment = $sensorData['environment'] ?? [];
            $acceleration = $sensorData['acceleration'] ?? [];
            
            $sql = "INSERT INTO sensor_data (
                device_id, user_id, timestamp, arduino_timestamp,
                acceleration_x, acceleration_y, acceleration_z, acceleration_magnitude,
                temperature, humidity, pressure,
                baseline_acceleration, current_acceleration, system_active, fall_count,
                data_source
            ) VALUES (
                :device_id, :user_id, :timestamp, :arduino_timestamp,
                :acc_x, :acc_y, :acc_z, :acc_mag,
                :temperature, :humidity, :pressure,
                :baseline, :current_accel, :system_active, :fall_count,
                :data_source
            )";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                'device_id' => $deviceId,
                'user_id' => $userId,
                'timestamp' => $timestamp,
                'arduino_timestamp' => $arduinoTimestamp,
                'acc_x' => $acceleration['x'] ?? null,
                'acc_y' => $acceleration['y'] ?? null,
                'acc_z' => $acceleration['z'] ?? null,
                'acc_mag' => $this->calculateMagnitude($acceleration),
                'temperature' => $environment['temperature'],
                'humidity' => $environment['humidity'],
                'pressure' => $environment['pressure'],
                'baseline' => $input['baseline_acceleration'] ?? null,
                'current_accel' => $input['current_acceleration'] ?? null,
                'system_active' => $input['system_active'] ?? true,
                'fall_count' => $input['fall_count'] ?? 0,
                'data_source' => $input['data_source'] ?? 'arduino'
            ]);
            
            // Actualizar last_seen del dispositivo
            $this->updateDeviceLastSeen($deviceId);
            
            $this->sendSuccess([
                'message' => 'Datos de sensor guardados exitosamente',
                'id' => $this->pdo->lastInsertId(),
                'timestamp' => $timestamp
            ]);
            
        } catch (PDOException $e) {
            $this->sendError(500, 'Error guardando datos: ' . $e->getMessage());
        }
    }
    
    private function saveFallAlert() {
        $input = $this->getJsonInput();
        
        if (!$input) {
            $this->sendError(400, 'Datos JSON inválidos');
            return;
        }
        
        try {
            $alertId = $input['alert_id'] ?? uniqid('fall_', true);
            $deviceId = $input['device_id'] ?? 'unknown';
            $userId = $input['user_id'] ?? null;
            $timestamp = $input['timestamp'] ?? date('Y-m-d H:i:s');
            
            // Datos de la caída
            $sensorData = $input['sensor_data'] ?? [];
            $acceleration = $sensorData['acceleration'] ?? [];
            $environment = $sensorData['environment'] ?? [];
            
            $sql = "INSERT INTO fall_alerts (
                alert_id, device_id, user_id, fall_timestamp, arduino_timestamp,
                severity, magnitude, confidence_score,
                acceleration_x, acceleration_y, acceleration_z,
                temperature, humidity, pressure,
                status, notification_sent
            ) VALUES (
                :alert_id, :device_id, :user_id, :fall_timestamp, :arduino_timestamp,
                :severity, :magnitude, :confidence_score,
                :acc_x, :acc_y, :acc_z,
                :temperature, :humidity, :pressure,
                :status, :notification_sent
            )";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                'alert_id' => $alertId,
                'device_id' => $deviceId,
                'user_id' => $userId,
                'fall_timestamp' => $timestamp,
                'arduino_timestamp' => $input['arduino_timestamp'] ?? null,
                'severity' => $input['severity'] ?? 'medium',
                'magnitude' => $input['magnitude'] ?? null,
                'confidence_score' => $input['confidence_score'] ?? 0.85,
                'acc_x' => $acceleration['x'] ?? null,
                'acc_y' => $acceleration['y'] ?? null,
                'acc_z' => $acceleration['z'] ?? null,
                'temperature' => $environment['temperature'] ?? null,
                'humidity' => $environment['humidity'] ?? null,
                'pressure' => $environment['pressure'] ?? null,
                'status' => 'pending',
                'notification_sent' => false
            ]);
            
            // Actualizar contador de caídas del dispositivo
            $this->updateDeviceFallCount($deviceId);
            
            $this->sendSuccess([
                'message' => 'Alerta de caída guardada exitosamente',
                'alert_id' => $alertId,
                'id' => $this->pdo->lastInsertId(),
                'timestamp' => $timestamp
            ]);
            
        } catch (PDOException $e) {
            $this->sendError(500, 'Error guardando alerta: ' . $e->getMessage());
        }
    }
    
    private function getHistory() {
        $deviceId = $_GET['device_id'] ?? null;
        $userId = $_GET['user_id'] ?? null;
        $hours = (int)($_GET['hours'] ?? 24);
        $limit = min((int)($_GET['limit'] ?? 100), 1000); // Máximo 1000 registros
        
        try {
            $conditions = ["timestamp >= DATE_SUB(NOW(), INTERVAL :hours HOUR)"];
            $params = ['hours' => $hours];
            
            if ($deviceId) {
                $conditions[] = "device_id = :device_id";
                $params['device_id'] = $deviceId;
            }
            
            if ($userId) {
                $conditions[] = "user_id = :user_id";
                $params['user_id'] = $userId;
            }
            
            $sql = "SELECT * FROM sensor_data 
                    WHERE " . implode(' AND ', $conditions) . "
                    ORDER BY timestamp DESC 
                    LIMIT :limit";
            
            $stmt = $this->pdo->prepare($sql);
            
            // Bind parameters
            foreach ($params as $key => $value) {
                $stmt->bindValue(":$key", $value);
            }
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            
            $stmt->execute();
            $data = $stmt->fetchAll();
            
            $this->sendSuccess([
                'data' => $data,
                'count' => count($data),
                'filters' => [
                    'device_id' => $deviceId,
                    'user_id' => $userId,
                    'hours' => $hours,
                    'limit' => $limit
                ]
            ]);
            
        } catch (PDOException $e) {
            $this->sendError(500, 'Error obteniendo historial: ' . $e->getMessage());
        }
    }
    
    private function getStats() {
        $deviceId = $_GET['device_id'] ?? null;
        $days = (int)($_GET['days'] ?? 7);
        
        try {
            $conditions = [];
            $params = ['days' => $days];
            
            if ($deviceId) {
                $conditions[] = "device_id = :device_id";
                $params['device_id'] = $deviceId;
            }
            
            $whereClause = $conditions ? 'WHERE ' . implode(' AND ', $conditions) . ' AND' : 'WHERE';
            
            // Estadísticas generales
            $sql = "SELECT 
                        COUNT(*) as total_readings,
                        AVG(temperature) as avg_temperature,
                        MIN(temperature) as min_temperature,
                        MAX(temperature) as max_temperature,
                        AVG(humidity) as avg_humidity,
                        MIN(humidity) as min_humidity,
                        MAX(humidity) as max_humidity,
                        AVG(pressure) as avg_pressure,
                        MIN(pressure) as min_pressure,
                        MAX(pressure) as max_pressure,
                        AVG(acceleration_magnitude) as avg_acceleration,
                        MAX(acceleration_magnitude) as max_acceleration
                    FROM sensor_data 
                    $whereClause timestamp >= DATE_SUB(NOW(), INTERVAL :days DAY)";
            
            $stmt = $this->pdo->prepare($sql);
            foreach ($params as $key => $value) {
                $stmt->bindValue(":$key", $value);
            }
            $stmt->execute();
            $stats = $stmt->fetch();
            
            // Alertas en el período
            $alertSql = "SELECT 
                            COUNT(*) as total_alerts,
                            SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_severity,
                            SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium_severity,
                            SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low_severity,
                            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_alerts
                         FROM fall_alerts 
                         $whereClause fall_timestamp >= DATE_SUB(NOW(), INTERVAL :days DAY)";
            
            $alertStmt = $this->pdo->prepare($alertSql);
            foreach ($params as $key => $value) {
                $alertStmt->bindValue(":$key", $value);
            }
            $alertStmt->execute();
            $alertStats = $alertStmt->fetch();
            
            $this->sendSuccess([
                'sensor_stats' => $stats,
                'alert_stats' => $alertStats,
                'period_days' => $days,
                'device_id' => $deviceId
            ]);
            
        } catch (PDOException $e) {
            $this->sendError(500, 'Error obteniendo estadísticas: ' . $e->getMessage());
        }
    }
    
    private function getRecentAlerts() {
        $limit = min((int)($_GET['limit'] ?? 10), 50);
        
        try {
            $sql = "SELECT * FROM recent_alerts LIMIT :limit";
            $stmt = $this->pdo->prepare($sql);
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
            
            $this->sendSuccess([
                'alerts' => $stmt->fetchAll(),
                'count' => $stmt->rowCount()
            ]);
            
        } catch (PDOException $e) {
            $this->sendError(500, 'Error obteniendo alertas: ' . $e->getMessage());
        }
    }
    
    private function getDevices() {
        try {
            $sql = "SELECT d.*, u.name as user_name 
                    FROM devices d 
                    LEFT JOIN users u ON d.user_id = u.user_id 
                    ORDER BY d.last_seen DESC";
            $stmt = $this->pdo->query($sql);
            
            $this->sendSuccess([
                'devices' => $stmt->fetchAll()
            ]);
            
        } catch (PDOException $e) {
            $this->sendError(500, 'Error obteniendo dispositivos: ' . $e->getMessage());
        }
    }
    
    private function getUsers() {
        try {
            $sql = "SELECT u.*, COUNT(d.id) as device_count 
                    FROM users u 
                    LEFT JOIN devices d ON u.user_id = d.user_id 
                    GROUP BY u.id 
                    ORDER BY u.created_at DESC";
            $stmt = $this->pdo->query($sql);
            
            $this->sendSuccess([
                'users' => $stmt->fetchAll()
            ]);
            
        } catch (PDOException $e) {
            $this->sendError(500, 'Error obteniendo usuarios: ' . $e->getMessage());
        }
    }
    
    // Métodos auxiliares
    private function updateDeviceLastSeen($deviceId) {
        $sql = "UPDATE devices SET last_seen = NOW(), status = 'online' WHERE device_id = :device_id";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(['device_id' => $deviceId]);
    }
    
    private function updateDeviceFallCount($deviceId) {
        // Se podría implementar un contador en la tabla devices si se desea
    }
    
    private function calculateMagnitude($acceleration) {
        if (!isset($acceleration['x'], $acceleration['y'], $acceleration['z'])) {
            return null;
        }
        return sqrt(
            pow($acceleration['x'], 2) + 
            pow($acceleration['y'], 2) + 
            pow($acceleration['z'], 2)
        );
    }
    
    private function getJsonInput() {
        $input = file_get_contents('php://input');
        return json_decode($input, true);
    }
    
    private function sendSuccess($data) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'timestamp' => date('c'),
            'data' => $data
        ], JSON_PRETTY_PRINT);
        exit();
    }
    
    private function sendError($code, $message) {
        http_response_code($code);
        echo json_encode([
            'success' => false,
            'error' => $message,
            'timestamp' => date('c')
        ], JSON_PRETTY_PRINT);
        exit();
    }
}

// Inicializar y manejar la request
try {
    $api = new FallDetectionAPI();
    $api->handleRequest();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error interno del servidor: ' . $e->getMessage(),
        'timestamp' => date('c')
    ]);
}
?>